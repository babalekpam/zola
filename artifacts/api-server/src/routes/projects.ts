// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Router } from "express";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "../lib/supabase";
import { DEFAULT_MODEL_ID } from "../lib/ai/models";
import { fetchRepoFiles } from "../lib/github";

const router = Router();

// Resolve the workspace a new project should live in: the explicit org_id when
// the caller is a member of it, otherwise their personal workspace. Returns
// null only when the user has no workspace at all (should not happen post-migration).
async function resolveOrgId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  requested?: string | null,
): Promise<string | null> {
  if (requested) {
    const { data } = await supabase
      .from("organization_members")
      .select("org_id")
      .eq("org_id", requested)
      .eq("user_id", userId)
      .maybeSingle();
    if (data) return requested;
  }
  const { data: personal } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_id", userId)
    .eq("personal", true)
    .maybeSingle();
  return personal?.id ?? null;
}

router.post("/projects/import", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { repoUrl, org_id } = req.body as { repoUrl?: string; org_id?: string };
  if (!repoUrl || typeof repoUrl !== "string") {
    res.status(400).json({ error: "repoUrl is required" });
    return;
  }
  const orgId = await resolveOrgId(supabase, userData.user.id, org_id);

  let imported: { name: string; files: { path: string; content: string }[] };
  try {
    imported = await fetchRepoFiles(repoUrl);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Import failed" });
    return;
  }

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      name: imported.name,
      description: `Imported from ${repoUrl.trim()}`,
      owner_id: userData.user.id,
      org_id: orgId,
      default_model: DEFAULT_MODEL_ID,
    })
    .select("*")
    .single();

  if (error || !project) {
    res.status(500).json({ error: error?.message ?? "Failed to create project" });
    return;
  }

  const rows = imported.files.map((f) => ({
    project_id: project.id,
    path: f.path,
    content: f.content,
  }));
  for (let i = 0; i < rows.length; i += 100) {
    const { error: fileErr } = await supabase
      .from("project_files")
      .insert(rows.slice(i, i + 100));
    if (fileErr) {
      // Compensate: drop the half-imported project so no broken shell remains
      // (project_files cascade on delete).
      await supabase.from("projects").delete().eq("id", project.id);
      res.status(500).json({ error: fileErr.message });
      return;
    }
  }

  res.json({ project, fileCount: rows.length });
});

router.get("/projects", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const orgId = req.query.org as string | undefined;
  let query = supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });
  if (orgId) query = query.eq("org_id", orgId);

  const { data, error } = await query;

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ projects: data });
});

router.post("/projects", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = req.body as {
    name?: string;
    description?: string;
    org_id?: string;
    template?: string;
    attachments?: { path?: string; content?: string }[];
  };
  const sample = body.template
    ? SAMPLE_PROJECTS.find((s) => s.id === body.template)
    : undefined;
  const name = (body.name ?? "").trim() || sample?.name || "Untitled project";
  const orgId = await resolveOrgId(supabase, userData.user.id, body.org_id);

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      name,
      description: body.description ?? sample?.description ?? null,
      owner_id: userData.user.id,
      org_id: orgId,
      default_model: DEFAULT_MODEL_ID,
    })
    .select("*")
    .single();

  if (error || !project) {
    res.status(500).json({ error: error?.message ?? "Failed to create" });
    return;
  }

  // Collect files by path so duplicate inputs (e.g. two attachments with the
  // same name) can't poison the upsert batch — last write wins.
  const byPath = new Map<string, string>();
  const base = sample ? sample.files() : starterFiles();
  for (const [path, content] of Object.entries(base)) byPath.set(path, content);

  // Attach user-provided reference files under attachments/ so the AI (and the
  // file tree) can use them. Text is stored verbatim; oversized files are skipped.
  if (Array.isArray(body.attachments)) {
    for (const a of body.attachments) {
      const fileName = (a?.path ?? "").trim().replace(/^\/+/, "");
      if (!fileName || typeof a?.content !== "string") continue;
      if (a.content.length > 200_000) continue;
      byPath.set(`attachments/${fileName}`, a.content);
    }
  }

  const rows = Array.from(byPath, ([path, content]) => ({
    project_id: project.id as string,
    path,
    content,
  }));

  const { error: filesErr } = await supabase
    .from("project_files")
    .upsert(rows, { onConflict: "project_id,path" });

  if (filesErr) {
    // Don't leave a project shell with no files behind (files cascade on delete).
    await supabase.from("projects").delete().eq("id", project.id);
    res.status(500).json({ error: filesErr.message });
    return;
  }

  res.json({ project });
});

router.get("/projects/samples", (_req, res) => {
  res.json({
    samples: SAMPLE_PROJECTS.map(({ id, name, description, category }) => ({
      id,
      name,
      description,
      category,
    })),
  });
});

router.get("/projects/:id", async (req, res) => {
  const { id } = req.params;
  const supabase = createSupabaseServerClient(req, res);
  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !project) { res.status(404).json({ error: "Not found" }); return; }

  const { data: files } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", id);

  // The KV capability token is only handed to users with project access —
  // NOT to anonymous readers of public projects (it grants KV writes). It
  // lives in a service-role-only table and is minted on first request.
  let dbToken: string | null = null;
  const { data: hasAccess } = await supabase.rpc("has_project_access", { pid: id });
  if (hasAccess === true) {
    const admin = createSupabaseAdminClient();
    if (admin) {
      const { data: existing } = await admin
        .from("project_db_tokens")
        .select("token")
        .eq("project_id", id)
        .maybeSingle();
      if (existing) {
        dbToken = existing.token;
      } else {
        const { data: minted } = await admin
          .from("project_db_tokens")
          .insert({ project_id: id })
          .select("token")
          .single();
        dbToken = minted?.token ?? null;
      }
    }
  }

  res.json({ project: { ...project, db_token: dbToken }, files: files ?? [] });
});

router.delete("/projects/:id", async (req, res) => {
  const { id } = req.params;
  const supabase = createSupabaseServerClient(req, res);
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

router.patch("/projects/:id", async (req, res) => {
  const { id } = req.params;
  const supabase = createSupabaseServerClient(req, res);
  const body = req.body as Partial<{
    name: string;
    description: string;
    default_model: string;
    visibility: string;
  }>;
  // Whitelist updatable fields so a crafted body can't touch anything else.
  const update: Record<string, string> = {};
  if (typeof body.name === "string") update.name = body.name;
  if (typeof body.description === "string") update.description = body.description;
  if (typeof body.default_model === "string") update.default_model = body.default_model;
  if (body.visibility === "public" || body.visibility === "private") {
    update.visibility = body.visibility;
  }
  if (Object.keys(update).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }
  const { data, error } = await supabase
    .from("projects")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ project: data });
});

router.put("/projects/:id/files", async (req, res) => {
  const { id: projectId } = req.params;
  const supabase = createSupabaseServerClient(req, res);
  const body = req.body as { files: { path: string; content: string }[] };
  if (!Array.isArray(body.files)) { res.status(400).json({ error: "files required" }); return; }

  const rows = body.files.map((f) => ({
    project_id: projectId,
    path: f.path,
    content: f.content,
  }));

  const { error } = await supabase
    .from("project_files")
    .upsert(rows, { onConflict: "project_id,path" });

  if (error) { res.status(500).json({ error: error.message }); return; }

  await supabase
    .from("projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", projectId);

  res.json({ ok: true });
});

router.delete("/projects/:id/files", async (req, res) => {
  const { id: projectId } = req.params;
  const supabase = createSupabaseServerClient(req, res);
  const path = req.query.path as string | undefined;
  if (!path) { res.status(400).json({ error: "path required" }); return; }

  const { error } = await supabase
    .from("project_files")
    .delete()
    .eq("project_id", projectId)
    .eq("path", path);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

// Shared scaffold (everything except src/App.tsx) reused by the blank starter
// and every clonable sample so they all run with just react + vite.
function baseFiles(): Record<string, string> {
  return {
    "package.json": JSON.stringify(
      {
        name: "zola-project",
        private: true,
        type: "module",
        scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
        dependencies: { react: "^19.0.0", "react-dom": "^19.0.0" },
        devDependencies: {
          "@vitejs/plugin-react": "^4.3.4",
          typescript: "^5.6.0",
          vite: "^6.0.0",
        },
      },
      null,
      2,
    ),
    "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Zola App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    "src/main.tsx": `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`,
    "vite.config.ts": `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({ plugins: [react()] });
`,
    "tsconfig.json": JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["ES2022", "DOM", "DOM.Iterable"],
          jsx: "react-jsx",
          module: "ESNext",
          moduleResolution: "bundler",
          strict: true,
          skipLibCheck: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
        include: ["src"],
      },
      null,
      2,
    ),
  };
}

function starterFiles(): Record<string, string> {
  return {
    ...baseFiles(),
    "src/App.tsx": `export default function App() {
  return null;
}
`,
  };
}

interface Sample {
  id: string;
  name: string;
  description: string;
  category: string;
  files: () => Record<string, string>;
}

const SAMPLE_PROJECTS: Sample[] = [
  {
    id: "todo",
    category: "Apps",
    name: "Todo App",
    description: "A clean React to-do list with add, complete, and delete.",
    files: () => ({
      ...baseFiles(),
      "src/App.tsx": `import { useState } from "react";

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([
    { id: 1, text: "Try editing this app with the AI", done: false },
  ]);
  const [text, setText] = useState("");

  function add() {
    const value = text.trim();
    if (!value) return;
    setTodos((t) => [...t, { id: Date.now(), text: value, done: false }]);
    setText("");
  }

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 480, margin: "48px auto", padding: 24 }}>
      <h1 style={{ marginBottom: 16 }}>Todo</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add a task…"
          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc" }}
        />
        <button onClick={add} style={{ padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}>
          Add
        </button>
      </div>
      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
        {todos.map((t) => (
          <li
            key={t.id}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: 12, border: "1px solid #eee", borderRadius: 8 }}
          >
            <input
              type="checkbox"
              checked={t.done}
              onChange={() =>
                setTodos((list) => list.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))
              }
            />
            <span style={{ flex: 1, textDecoration: t.done ? "line-through" : "none", opacity: t.done ? 0.5 : 1 }}>
              {t.text}
            </span>
            <button
              onClick={() => setTodos((list) => list.filter((x) => x.id !== t.id))}
              style={{ border: "none", background: "none", cursor: "pointer", color: "#c00" }}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
`,
    }),
  },
  {
    id: "landing",
    category: "Websites",
    name: "Landing Page",
    description: "A modern product landing page with a hero and feature grid.",
    files: () => ({
      ...baseFiles(),
      "src/App.tsx": `const features = [
  { title: "Fast", body: "Ships in seconds with a lightweight build." },
  { title: "Flexible", body: "Ask the AI to reshape any section instantly." },
  { title: "Beautiful", body: "Sensible defaults you can make your own." },
];

export default function App() {
  return (
    <main style={{ fontFamily: "system-ui", color: "#111" }}>
      <section style={{ textAlign: "center", padding: "96px 24px", background: "#0f172a", color: "#fff" }}>
        <h1 style={{ fontSize: 44, margin: 0 }}>Build something people love</h1>
        <p style={{ fontSize: 18, opacity: 0.8, maxWidth: 520, margin: "16px auto 32px" }}>
          A starting point for your product landing page. Edit the copy, colors, and layout with the AI.
        </p>
        <button style={{ padding: "12px 28px", borderRadius: 999, border: "none", background: "#fff", color: "#0f172a", fontWeight: 600, cursor: "pointer" }}>
          Get started
        </button>
      </section>
      <section style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", maxWidth: 960, margin: "0 auto", padding: "64px 24px" }}>
        {features.map((f) => (
          <div key={f.title} style={{ padding: 24, border: "1px solid #eee", borderRadius: 16 }}>
            <h3 style={{ marginTop: 0 }}>{f.title}</h3>
            <p style={{ color: "#555", margin: 0 }}>{f.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
`,
    }),
  },
  {
    id: "dashboard",
    category: "Data",
    name: "Analytics Dashboard",
    description: "A simple stats dashboard with metric cards and a recent list.",
    files: () => ({
      ...baseFiles(),
      "src/App.tsx": `const stats = [
  { label: "Revenue", value: "$12,480", delta: "+8.2%" },
  { label: "Users", value: "3,120", delta: "+3.1%" },
  { label: "Churn", value: "1.4%", delta: "-0.3%" },
];

const activity = [
  "New signup: alex@acme.com",
  "Payment received: $49",
  "Report exported by admin",
];

export default function App() {
  return (
    <main style={{ fontFamily: "system-ui", background: "#f8fafc", minHeight: "100vh", padding: 32 }}>
      <h1 style={{ marginTop: 0 }}>Dashboard</h1>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: 32 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ color: "#64748b", fontSize: 13 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, margin: "6px 0" }}>{s.value}</div>
            <div style={{ color: s.delta.startsWith("-") ? "#dc2626" : "#16a34a", fontSize: 13 }}>{s.delta}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <h3 style={{ marginTop: 0 }}>Recent activity</h3>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
          {activity.map((a, i) => (
            <li key={i} style={{ padding: "10px 0", borderBottom: i < activity.length - 1 ? "1px solid #eee" : "none", color: "#334155" }}>
              {a}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
`,
    }),
  },
  {
    id: "snake",
    category: "Games",
    name: "Snake Game",
    description: "The classic snake game on a canvas — arrow keys to steer.",
    files: () => ({
      ...baseFiles(),
      "src/App.tsx": `import { useEffect, useRef, useState } from "react";

const SIZE = 20;
const CELLS = 24;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [dead, setDead] = useState(false);
  const [tick, setTick] = useState(0);
  const state = useRef({
    snake: [{ x: 12, y: 12 }],
    dir: { x: 1, y: 0 },
    food: { x: 5, y: 5 },
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const d = state.current.dir;
      if (e.key === "ArrowUp" && d.y === 0) state.current.dir = { x: 0, y: -1 };
      if (e.key === "ArrowDown" && d.y === 0) state.current.dir = { x: 0, y: 1 };
      if (e.key === "ArrowLeft" && d.x === 0) state.current.dir = { x: -1, y: 0 };
      if (e.key === "ArrowRight" && d.x === 0) state.current.dir = { x: 1, y: 0 };
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (dead) return;
    const t = setTimeout(() => {
      const { snake, dir, food } = state.current;
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      if (
        head.x < 0 || head.y < 0 || head.x >= CELLS || head.y >= CELLS ||
        snake.some((s) => s.x === head.x && s.y === head.y)
      ) {
        setDead(true);
        return;
      }
      const next = [head, ...snake];
      if (head.x === food.x && head.y === food.y) {
        setScore((s) => s + 1);
        state.current.food = {
          x: Math.floor(Math.random() * CELLS),
          y: Math.floor(Math.random() * CELLS),
        };
      } else {
        next.pop();
      }
      state.current.snake = next;
      setTick((n) => n + 1);
    }, 120);
    return () => clearTimeout(t);
  }, [tick, dead]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, SIZE * CELLS, SIZE * CELLS);
    ctx.fillStyle = "#f43f5e";
    const { food, snake } = state.current;
    ctx.fillRect(food.x * SIZE, food.y * SIZE, SIZE - 1, SIZE - 1);
    ctx.fillStyle = "#4ade80";
    for (const s of snake) ctx.fillRect(s.x * SIZE, s.y * SIZE, SIZE - 1, SIZE - 1);
  }, [tick]);

  return (
    <main style={{ fontFamily: "system-ui", textAlign: "center", padding: 24 }}>
      <h1>Snake — {score}</h1>
      {dead && (
        <p>
          Game over.{" "}
          <button onClick={() => window.location.reload()}>Play again</button>
        </p>
      )}
      <canvas
        ref={canvasRef}
        width={SIZE * CELLS}
        height={SIZE * CELLS}
        style={{ borderRadius: 12 }}
      />
      <p style={{ color: "#64748b" }}>Use the arrow keys.</p>
    </main>
  );
}
`,
    }),
  },
  {
    id: "portfolio",
    category: "Websites",
    name: "Portfolio",
    description: "A personal portfolio with projects, skills, and contact links.",
    files: () => ({
      ...baseFiles(),
      "src/App.tsx": `const projects = [
  { name: "Project One", blurb: "A short description of something you built." },
  { name: "Project Two", blurb: "Another thing you're proud of." },
  { name: "Project Three", blurb: "Ask the AI to add real links and images." },
];

export default function App() {
  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 720, margin: "0 auto", padding: "64px 24px", color: "#111" }}>
      <header style={{ marginBottom: 48 }}>
        <h1 style={{ fontSize: 40, margin: 0 }}>Your Name</h1>
        <p style={{ fontSize: 18, color: "#555" }}>
          Developer · Designer · Maker. Replace this with your one-line bio.
        </p>
        <p>
          <a href="mailto:you@example.com">Email</a> ·{" "}
          <a href="https://github.com">GitHub</a> ·{" "}
          <a href="https://linkedin.com">LinkedIn</a>
        </p>
      </header>
      <section>
        <h2>Projects</h2>
        <div style={{ display: "grid", gap: 16 }}>
          {projects.map((p) => (
            <div key={p.name} style={{ border: "1px solid #eee", borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: "0 0 8px" }}>{p.name}</h3>
              <p style={{ margin: 0, color: "#555" }}>{p.blurb}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
`,
    }),
  },
  {
    id: "blog",
    category: "Websites",
    name: "Blog",
    description: "A minimal blog with a post list and reading view.",
    files: () => ({
      ...baseFiles(),
      "src/App.tsx": `import { useState } from "react";

const posts = [
  {
    slug: "hello-world",
    title: "Hello, world",
    date: "2026-01-05",
    body: "This is your first post. Ask the AI to add markdown support, tags, or a CMS.",
  },
  {
    slug: "second-post",
    title: "Why I'm building in public",
    date: "2026-02-12",
    body: "Write about anything here. Each post is just data — edit the posts array in App.tsx.",
  },
];

export default function App() {
  const [open, setOpen] = useState<string | null>(null);
  const post = posts.find((p) => p.slug === open);

  return (
    <main style={{ fontFamily: "Georgia, serif", maxWidth: 640, margin: "0 auto", padding: "56px 24px" }}>
      <h1 style={{ fontFamily: "system-ui" }}>My Blog</h1>
      {post ? (
        <article>
          <button onClick={() => setOpen(null)} style={{ marginBottom: 16 }}>← All posts</button>
          <h2>{post.title}</h2>
          <p style={{ color: "#888", fontFamily: "system-ui", fontSize: 14 }}>{post.date}</p>
          <p style={{ lineHeight: 1.7 }}>{post.body}</p>
        </article>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 20 }}>
          {posts.map((p) => (
            <li key={p.slug}>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setOpen(p.slug); }}
                style={{ fontSize: 22, color: "#111" }}
              >
                {p.title}
              </a>
              <div style={{ color: "#888", fontFamily: "system-ui", fontSize: 14 }}>{p.date}</div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
`,
    }),
  },
  {
    id: "express-api",
    category: "Backends",
    name: "Express API",
    description: "A Node.js REST API with Express — JSON endpoints, no frontend.",
    files: () => ({
      "package.json": JSON.stringify(
        {
          name: "zola-express-api",
          private: true,
          type: "module",
          scripts: { dev: "node server.js" },
          dependencies: { express: "^4.19.0" },
        },
        null,
        2,
      ),
      "server.js": `import express from "express";

const app = express();
app.use(express.json());

let todos = [{ id: 1, text: "Try this API from the Shell with curl", done: false }];

app.get("/", (_req, res) => {
  res.json({ ok: true, endpoints: ["GET /todos", "POST /todos", "DELETE /todos/:id"] });
});

app.get("/todos", (_req, res) => res.json(todos));

app.post("/todos", (req, res) => {
  const todo = { id: Date.now(), text: req.body.text ?? "", done: false };
  todos.push(todo);
  res.status(201).json(todo);
});

app.delete("/todos/:id", (req, res) => {
  todos = todos.filter((t) => t.id !== Number(req.params.id));
  res.status(204).end();
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(\`API listening on \${port}\`));
`,
      "README.md": `# Express API

Run it, then try from the Shell tab:

    curl localhost:3000/todos
    curl -X POST localhost:3000/todos -H 'content-type: application/json' -d '{"text":"hi"}'
`,
    }),
  },
  {
    id: "calculator",
    name: "Calculator",
    description: "A clean working calculator with keyboard support.",
    category: "Apps",
    files: () => ({
      ...baseFiles(),
      "src/App.tsx": `import { useEffect, useState } from "react";

const KEYS = ["7","8","9","/","4","5","6","*","1","2","3","-","0",".","=","+"];

export default function App() {
  const [expr, setExpr] = useState("");

  function press(k: string) {
    if (k === "=") {
      try {
        if (!/^[0-9+\\-*/. ()]+$/.test(expr)) return;
        // eslint-disable-next-line no-new-func
        setExpr(String(Function("return (" + expr + ")")()));
      } catch {
        setExpr("Error");
      }
      return;
    }
    setExpr((e) => (e === "Error" ? k : e + k));
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (KEYS.includes(e.key)) press(e.key);
      if (e.key === "Enter") press("=");
      if (e.key === "Backspace") setExpr((x) => x.slice(0, -1));
      if (e.key === "Escape") setExpr("");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 280, margin: "64px auto" }}>
      <div style={{ background: "#0f172a", color: "#fff", borderRadius: 12, padding: 16 }}>
        <div style={{ minHeight: 40, fontSize: 24, textAlign: "right", overflowWrap: "anywhere" }}>
          {expr || "0"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 12 }}>
          {KEYS.map((k) => (
            <button
              key={k}
              onClick={() => press(k)}
              style={{ padding: "14px 0", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 16, background: k === "=" ? "#4ade80" : "#1e293b", color: k === "=" ? "#0f172a" : "#fff" }}
            >
              {k}
            </button>
          ))}
        </div>
        <button onClick={() => setExpr("")} style={{ width: "100%", marginTop: 8, padding: 10, borderRadius: 8, border: "none", cursor: "pointer", background: "#334155", color: "#fff" }}>
          Clear
        </button>
      </div>
    </main>
  );
}
`,
    }),
  },
  {
    id: "pomodoro",
    name: "Pomodoro Timer",
    description: "A focus timer with work/break cycles and desktop-friendly UI.",
    category: "Apps",
    files: () => ({
      ...baseFiles(),
      "src/App.tsx": `import { useEffect, useState } from "react";

const WORK = 25 * 60;
const BREAK = 5 * 60;

export default function App() {
  const [secs, setSecs] = useState(WORK);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<"work" | "break">("work");

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setSecs((s) => {
        if (s > 1) return s - 1;
        setMode((m) => (m === "work" ? "break" : "work"));
        return mode === "work" ? BREAK : WORK;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running, mode]);

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <main style={{ fontFamily: "system-ui", textAlign: "center", padding: 64, background: mode === "work" ? "#fef2f2" : "#eff6ff", minHeight: "100vh" }}>
      <h1 style={{ letterSpacing: 2, textTransform: "uppercase", fontSize: 14, color: "#666" }}>
        {mode === "work" ? "Focus" : "Break"}
      </h1>
      <div style={{ fontSize: 96, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
        {mm}:{ss}
      </div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
        <button onClick={() => setRunning((r) => !r)} style={{ padding: "12px 32px", borderRadius: 999, border: "none", cursor: "pointer", background: "#0f172a", color: "#fff", fontSize: 16 }}>
          {running ? "Pause" : "Start"}
        </button>
        <button onClick={() => { setRunning(false); setMode("work"); setSecs(WORK); }} style={{ padding: "12px 24px", borderRadius: 999, border: "1px solid #ccc", cursor: "pointer", background: "#fff", fontSize: 16 }}>
          Reset
        </button>
      </div>
    </main>
  );
}
`,
    }),
  },
  {
    id: "quiz",
    name: "Quiz App",
    description: "A multiple-choice quiz with scoring — swap in your own questions.",
    category: "Games",
    files: () => ({
      ...baseFiles(),
      "src/App.tsx": `import { useState } from "react";

const QUESTIONS = [
  { q: "What does HTML stand for?", a: ["HyperText Markup Language", "HighText Machine Language", "Hyperlink Text Mode Language"], correct: 0 },
  { q: "Which company created React?", a: ["Google", "Meta", "Microsoft"], correct: 1 },
  { q: "What year was JavaScript created?", a: ["2005", "1989", "1995"], correct: 2 },
];

export default function App() {
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const done = i >= QUESTIONS.length;

  function pick(idx: number) {
    if (picked !== null) return;
    setPicked(idx);
    if (idx === QUESTIONS[i].correct) setScore((s) => s + 1);
    setTimeout(() => { setPicked(null); setI((n) => n + 1); }, 800);
  }

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 480, margin: "64px auto", padding: 24 }}>
      {done ? (
        <div style={{ textAlign: "center" }}>
          <h1>You scored {score}/{QUESTIONS.length}</h1>
          <button onClick={() => { setI(0); setScore(0); }} style={{ marginTop: 16, padding: "10px 24px", borderRadius: 8, cursor: "pointer" }}>
            Play again
          </button>
        </div>
      ) : (
        <>
          <p style={{ color: "#888", fontSize: 14 }}>Question {i + 1} of {QUESTIONS.length}</p>
          <h2>{QUESTIONS[i].q}</h2>
          <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
            {QUESTIONS[i].a.map((opt, idx) => (
              <button
                key={opt}
                onClick={() => pick(idx)}
                style={{
                  padding: 14, borderRadius: 10, cursor: "pointer", textAlign: "left", fontSize: 15,
                  border: "2px solid " + (picked === null ? "#e5e7eb" : idx === QUESTIONS[i].correct ? "#4ade80" : picked === idx ? "#f87171" : "#e5e7eb"),
                  background: "#fff",
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
`,
    }),
  },
  {
    id: "memory",
    name: "Memory Match",
    description: "A card-matching memory game with move counter.",
    category: "Games",
    files: () => ({
      ...baseFiles(),
      "src/App.tsx": `import { useState } from "react";

const EMOJI = ["🍎", "🚀", "🎧", "🌵", "🐙", "⚡", "🎲", "🍕"];

function shuffled() {
  return [...EMOJI, ...EMOJI]
    .map((e, i) => ({ id: i, emoji: e }))
    .sort(() => Math.random() - 0.5);
}

export default function App() {
  const [cards] = useState(shuffled);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);

  function flip(id: number) {
    if (flipped.length === 2 || flipped.includes(id)) return;
    const card = cards.find((c) => c.id === id)!;
    if (matched.has(card.emoji)) return;
    const next = [...flipped, id];
    setFlipped(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = next.map((x) => cards.find((c) => c.id === x)!);
      if (a.emoji === b.emoji) {
        setMatched((prev) => new Set(prev).add(a.emoji));
        setFlipped([]);
      } else {
        setTimeout(() => setFlipped([]), 700);
      }
    }
  }

  const won = matched.size === EMOJI.length;

  return (
    <main style={{ fontFamily: "system-ui", textAlign: "center", padding: 40 }}>
      <h1>Memory Match</h1>
      <p style={{ color: "#666" }}>{won ? "You won in " + moves + " moves! Refresh to replay." : moves + " moves"}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 72px)", gap: 10, justifyContent: "center", marginTop: 24 }}>
        {cards.map((c) => {
          const up = flipped.includes(c.id) || matched.has(c.emoji);
          return (
            <button
              key={c.id}
              onClick={() => flip(c.id)}
              style={{ height: 72, fontSize: 30, borderRadius: 12, border: "1px solid #ddd", cursor: "pointer", background: up ? "#fff" : "#0f172a" }}
            >
              {up ? c.emoji : ""}
            </button>
          );
        })}
      </div>
    </main>
  );
}
`,
    }),
  },
];

export default router;
