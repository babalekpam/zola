// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Router } from "express";
import { createSupabaseServerClient } from "../lib/supabase";
import { DEFAULT_MODEL_ID } from "../lib/ai/models";

const router = Router();

// Public gallery of community projects. Works logged-out: the anon client's
// RLS only exposes rows with visibility = 'public'.
router.get("/explore", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const q = ((req.query.q as string | undefined) ?? "").trim();

  let query = supabase
    .from("projects")
    .select("id, name, description, updated_at")
    .eq("visibility", "public")
    .order("updated_at", { ascending: false })
    .limit(60);
  if (q) query = query.ilike("name", `%${q.replace(/[%_]/g, "\\$&")}%`);

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ projects: data ?? [] });
});

// Remix: copy a project (public, or one the caller can access) into the
// caller's own workspace — Replit's fork.
router.post("/projects/:id/fork", async (req, res) => {
  const { id } = req.params;
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  // RLS gates this read: succeeds for public projects and for members.
  const { data: source, error: srcErr } = await supabase
    .from("projects")
    .select("id, name, description, default_model")
    .eq("id", id)
    .single();
  if (srcErr || !source) { res.status(404).json({ error: "Project not found" }); return; }

  const { data: files, error: filesErr } = await supabase
    .from("project_files")
    .select("path, content")
    .eq("project_id", id);
  if (filesErr) { res.status(500).json({ error: filesErr.message }); return; }

  const { data: personal } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_id", userData.user.id)
    .eq("personal", true)
    .maybeSingle();

  const { data: fork, error: forkErr } = await supabase
    .from("projects")
    .insert({
      name: `${source.name} (remix)`,
      description: source.description,
      owner_id: userData.user.id,
      org_id: personal?.id ?? null,
      default_model: source.default_model ?? DEFAULT_MODEL_ID,
    })
    .select("*")
    .single();
  if (forkErr || !fork) {
    res.status(500).json({ error: forkErr?.message ?? "Failed to fork" });
    return;
  }

  const rows = (files ?? []).map((f) => ({
    project_id: fork.id as string,
    path: f.path,
    content: f.content,
  }));
  for (let i = 0; i < rows.length; i += 100) {
    const { error: insErr } = await supabase
      .from("project_files")
      .insert(rows.slice(i, i + 100));
    if (insErr) {
      await supabase.from("projects").delete().eq("id", fork.id);
      res.status(500).json({ error: insErr.message });
      return;
    }
  }

  res.json({ project: fork });
});

export default router;
