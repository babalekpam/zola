// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Router } from "express";
import { createSupabaseServerClient } from "../lib/supabase";
import { DEFAULT_MODEL_ID } from "../lib/ai/models";

const router = Router();

// Public gallery of community projects. Works logged-out: the anon client's
// RLS only exposes rows with visibility = 'public'. Includes like counts and
// whether the current user (if any) liked each project.
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

  const ids = (data ?? []).map((p) => p.id);
  const counts = new Map<string, number>();
  const mine = new Set<string>();
  if (ids.length > 0) {
    const { data: likes } = await supabase
      .from("project_likes")
      .select("project_id, user_id")
      .in("project_id", ids);
    const { data: userData } = await supabase.auth.getUser();
    for (const like of likes ?? []) {
      counts.set(like.project_id, (counts.get(like.project_id) ?? 0) + 1);
      if (userData.user && like.user_id === userData.user.id) {
        mine.add(like.project_id);
      }
    }
  }

  res.json({
    projects: (data ?? []).map((p) => ({
      ...p,
      likes: counts.get(p.id) ?? 0,
      liked: mine.has(p.id),
    })),
  });
});

router.post("/projects/:id/like", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { error } = await supabase
    .from("project_likes")
    .upsert(
      { project_id: req.params.id, user_id: userData.user.id },
      { onConflict: "project_id,user_id" },
    );
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

router.delete("/projects/:id/like", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { error } = await supabase
    .from("project_likes")
    .delete()
    .eq("project_id", req.params.id)
    .eq("user_id", userData.user.id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

// Remix: copy a project (public, or one the caller can access) into the
// caller's chosen workspace — Replit's fork. Tenancy-aware: lands in the
// requested org when the caller is a member, else their personal workspace.
router.post("/projects/:id/fork", async (req, res) => {
  const { id } = req.params;
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { org_id } = (req.body ?? {}) as { org_id?: string };

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

  let targetOrg: string | null = null;
  if (org_id) {
    const { data: membership } = await supabase
      .from("organization_members")
      .select("org_id")
      .eq("org_id", org_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (membership) targetOrg = org_id;
  }
  if (!targetOrg) {
    const { data: personal } = await supabase
      .from("organizations")
      .select("id")
      .eq("owner_id", userData.user.id)
      .eq("personal", true)
      .maybeSingle();
    targetOrg = personal?.id ?? null;
  }

  const { data: fork, error: forkErr } = await supabase
    .from("projects")
    .insert({
      name: `${source.name} (remix)`,
      description: source.description,
      owner_id: userData.user.id,
      org_id: targetOrg,
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
