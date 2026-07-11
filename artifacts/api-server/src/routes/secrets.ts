// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Router } from "express";
import { createSupabaseServerClient } from "../lib/supabase";

const router = Router();

// Env-var-shaped keys only: what a shell/process environment can actually hold.
const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

router.get("/projects/:id/secrets", async (req, res) => {
  const { id } = req.params;
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data, error } = await supabase
    .from("project_secrets")
    .select("key, value")
    .eq("project_id", id)
    .order("key");

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ secrets: data ?? [] });
});

router.put("/projects/:id/secrets", async (req, res) => {
  const { id } = req.params;
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { key, value } = req.body as { key?: string; value?: string };
  if (!key || !KEY_RE.test(key)) {
    res.status(400).json({ error: "key must be a valid env var name" });
    return;
  }
  if (typeof value !== "string") {
    res.status(400).json({ error: "value is required" });
    return;
  }
  if (value.length > 10_000) {
    res.status(400).json({ error: "value too large (max 10k chars)" });
    return;
  }

  const { error } = await supabase
    .from("project_secrets")
    .upsert(
      { project_id: id, key, value },
      { onConflict: "project_id,key" },
    );

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

router.delete("/projects/:id/secrets", async (req, res) => {
  const { id } = req.params;
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const key = req.query.key as string | undefined;
  if (!key) { res.status(400).json({ error: "key required" }); return; }

  const { error } = await supabase
    .from("project_secrets")
    .delete()
    .eq("project_id", id)
    .eq("key", key);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

export default router;
