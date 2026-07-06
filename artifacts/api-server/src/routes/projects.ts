// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Router } from "express";
import { createSupabaseServerClient } from "../lib/supabase";
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

  const body = req.body as { name?: string; description?: string; org_id?: string };
  const name = (body.name ?? "").trim() || "Untitled project";
  const orgId = await resolveOrgId(supabase, userData.user.id, body.org_id);

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      name,
      description: body.description ?? null,
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
