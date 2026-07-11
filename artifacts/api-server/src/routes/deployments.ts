// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Router } from "express";
import { randomBytes } from "node:crypto";
import { createSupabaseServerClient } from "../lib/supabase";

const router = Router();

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const KEEP_DEPLOYMENTS = 5;

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "app"}-${randomBytes(3).toString("hex")}`;
}

router.get("/projects/:id/deployments", async (req, res) => {
  const { id } = req.params;
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data, error } = await supabase
    .from("deployments")
    .select("id, slug, status, file_count, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ deployments: data ?? [] });
});

router.post("/projects/:id/deployments", async (req, res) => {
  const { id } = req.params;
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { files } = req.body as {
    files?: { path?: string; content?: string; encoding?: string }[];
  };
  if (!Array.isArray(files) || files.length === 0) {
    res.status(400).json({ error: "files array required" });
    return;
  }
  if (!files.some((f) => f.path === "index.html")) {
    res.status(400).json({ error: "build output must contain an index.html" });
    return;
  }

  let total = 0;
  const rows: { path: string; content: string; encoding: "utf8" | "base64" }[] = [];
  for (const f of files) {
    const path = (f.path ?? "").replace(/^\/+/, "").trim();
    if (!path || path.includes("..") || typeof f.content !== "string") continue;
    const encoding = f.encoding === "base64" ? "base64" : "utf8";
    if (f.content.length > MAX_FILE_BYTES) {
      res.status(400).json({ error: `${path} exceeds the 5 MB per-file limit` });
      return;
    }
    total += f.content.length;
    rows.push({ path, content: f.content, encoding });
  }
  if (total > MAX_TOTAL_BYTES) {
    res.status(400).json({ error: "build output exceeds the 25 MB total limit" });
    return;
  }

  // The project (and access to it) is checked implicitly by RLS: reading the
  // project row fails for strangers, and the deployments insert re-checks.
  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .single();
  if (projErr || !project) { res.status(404).json({ error: "Project not found" }); return; }

  // Reuse the project's existing public URL if it was deployed before.
  const { data: previous } = await supabase
    .from("deployments")
    .select("slug")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const slug = previous?.slug ?? slugify(project.name);

  const { data: deployment, error } = await supabase
    .from("deployments")
    .insert({ project_id: id, slug, file_count: rows.length })
    .select("id, slug, status, file_count, created_at")
    .single();
  if (error || !deployment) {
    res.status(500).json({ error: error?.message ?? "Failed to create deployment" });
    return;
  }

  const fileRows = rows.map((r) => ({ ...r, deployment_id: deployment.id }));
  for (let i = 0; i < fileRows.length; i += 50) {
    const { error: fileErr } = await supabase
      .from("deployment_files")
      .insert(fileRows.slice(i, i + 50));
    if (fileErr) {
      await supabase.from("deployments").delete().eq("id", deployment.id);
      res.status(500).json({ error: fileErr.message });
      return;
    }
  }

  // Keep only the most recent deployments (files cascade on delete).
  const { data: extras } = await supabase
    .from("deployments")
    .select("id")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .range(KEEP_DEPLOYMENTS, KEEP_DEPLOYMENTS + 19);
  if (extras && extras.length > 0) {
    await supabase
      .from("deployments")
      .delete()
      .in("id", extras.map((e) => e.id));
  }

  res.json({ deployment });
});

export default router;
