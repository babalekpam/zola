// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Router } from "express";
import { createSupabaseServerClient } from "../lib/supabase";

const router = Router();

const MAX_SNAPSHOTS_PER_PROJECT = 50;

router.get("/projects/:id/snapshots", async (req, res) => {
  const { id } = req.params;
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data, error } = await supabase
    .from("project_snapshots")
    .select("id, label, kind, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ snapshots: data ?? [] });
});

router.post("/projects/:id/snapshots", async (req, res) => {
  const { id } = req.params;
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { label, kind, files } = req.body as {
    label?: string;
    kind?: "manual" | "auto";
    files?: Record<string, string>;
  };
  if (!files || typeof files !== "object" || Array.isArray(files)) {
    res.status(400).json({ error: "files object required" });
    return;
  }

  const { data: snapshot, error } = await supabase
    .from("project_snapshots")
    .insert({
      project_id: id,
      label: (label ?? "").slice(0, 200),
      kind: kind === "auto" ? "auto" : "manual",
      files,
    })
    .select("id, label, kind, created_at")
    .single();

  if (error || !snapshot) {
    res.status(500).json({ error: error?.message ?? "Failed to snapshot" });
    return;
  }

  // Prune history beyond the cap so auto-checkpoints can't grow unbounded.
  const { data: extras } = await supabase
    .from("project_snapshots")
    .select("id")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .range(MAX_SNAPSHOTS_PER_PROJECT, MAX_SNAPSHOTS_PER_PROJECT + 49);
  if (extras && extras.length > 0) {
    await supabase
      .from("project_snapshots")
      .delete()
      .in("id", extras.map((e) => e.id));
  }

  res.json({ snapshot });
});

// Restore: replace the project's live files with the snapshot's and return
// them so the client can refresh editor + runtime state in one round trip.
router.post("/projects/:id/snapshots/:snapshotId/restore", async (req, res) => {
  const { id, snapshotId } = req.params;
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: snapshot, error } = await supabase
    .from("project_snapshots")
    .select("files")
    .eq("id", snapshotId)
    .eq("project_id", id)
    .single();

  if (error || !snapshot) { res.status(404).json({ error: "Snapshot not found" }); return; }

  const files = snapshot.files as Record<string, string>;

  const { error: delErr } = await supabase
    .from("project_files")
    .delete()
    .eq("project_id", id);
  if (delErr) { res.status(500).json({ error: delErr.message }); return; }

  const rows = Object.entries(files).map(([path, content]) => ({
    project_id: id,
    path,
    content,
  }));
  for (let i = 0; i < rows.length; i += 100) {
    const { error: insErr } = await supabase
      .from("project_files")
      .insert(rows.slice(i, i + 100));
    if (insErr) { res.status(500).json({ error: insErr.message }); return; }
  }

  await supabase
    .from("projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);

  res.json({ files });
});

router.delete("/projects/:id/snapshots/:snapshotId", async (req, res) => {
  const { id, snapshotId } = req.params;
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { error } = await supabase
    .from("project_snapshots")
    .delete()
    .eq("id", snapshotId)
    .eq("project_id", id);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

export default router;
