// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Router } from "express";
import { createSupabaseServerClient } from "../lib/supabase";
import { DEFAULT_MODEL_ID } from "../lib/ai/models";

const router = Router();

router.get("/projects", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ projects: data });
});

router.post("/projects", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = req.body as { name?: string; description?: string };
  const name = (body.name ?? "").trim() || "Untitled project";

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      name,
      description: body.description ?? null,
      owner_id: userData.user.id,
      default_model: DEFAULT_MODEL_ID,
    })
    .select("*")
    .single();

  if (error || !project) {
    res.status(500).json({ error: error?.message ?? "Failed to create" });
    return;
  }

  const starter = starterFiles();
  await supabase.from("project_files").insert(
    Object.entries(starter).map(([path, content]) => ({
      project_id: project.id,
      path,
      content,
    })),
  );

  res.json({ project });
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

  res.json({ project, files: files ?? [] });
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
  }>;
  const { data, error } = await supabase
    .from("projects")
    .update(body)
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

function starterFiles(): Record<string, string> {
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
    "src/App.tsx": `export default function App() {
  return (
    <main style={{ fontFamily: "system-ui", padding: 48, textAlign: "center" }}>
      <h1>Hello from Zola</h1>
      <p>Ask the AI on the left to build something.</p>
    </main>
  );
}
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

export default router;
