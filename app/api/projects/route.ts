// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_MODEL_ID } from "@/lib/ai/models";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { name?: string; description?: string };
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

  if (error || !project)
    return NextResponse.json(
      { error: error?.message ?? "Failed to create" },
      { status: 500 },
    );

  const starter = starterFiles();
  await supabase.from("project_files").insert(
    Object.entries(starter).map(([path, content]) => ({
      project_id: project.id,
      path,
      content,
    })),
  );

  return NextResponse.json({ project });
}

function starterFiles(): Record<string, string> {
  return {
    "package.json": JSON.stringify(
      {
        name: "loop-project",
        private: true,
        type: "module",
        scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
        dependencies: {
          react: "^19.0.0",
          "react-dom": "^19.0.0",
        },
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
    <title>Loop App</title>
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
      <h1>Hello from Loop</h1>
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