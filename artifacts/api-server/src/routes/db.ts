// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Router } from "express";
import { createSupabaseAdminClient, createSupabaseServerClient } from "../lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

// Replit-DB-style key-value store.
//
// Two access paths:
//   1. /db/:token/*  — public, capability-token routed, used by the running
//      app via its ZOLA_DB_URL env var (mirrors REPLIT_DB_URL). Mounted at the
//      app level with open CORS since calls come from the WebContainer origin.
//   2. /api/projects/:id/kv — cookie-authed, used by the workspace's Database
//      pane, protected by RLS.

const MAX_VALUE_BYTES = 100 * 1024;
const MAX_KEYS = 5000;

async function projectIdForToken(
  supabase: SupabaseClient,
  token: string,
): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/.test(token)) return null;
  const { data } = await supabase
    .from("projects")
    .select("id")
    .eq("db_token", token)
    .maybeSingle();
  return data?.id ?? null;
}

export const publicDbRouter = Router();

// List keys, optionally by prefix: GET /db/:token?prefix=foo
publicDbRouter.get("/db/:token", async (req, res) => {
  const supabase = createSupabaseAdminClient();
  if (!supabase) { res.status(503).json({ error: "Database not configured" }); return; }
  const projectId = await projectIdForToken(supabase, req.params.token);
  if (!projectId) { res.status(404).json({ error: "Unknown database" }); return; }

  const prefix = (req.query.prefix as string | undefined) ?? "";
  let query = supabase
    .from("project_kv")
    .select("key")
    .eq("project_id", projectId)
    .order("key")
    .limit(MAX_KEYS);
  if (prefix) query = query.like("key", `${prefix.replace(/[%_]/g, "\\$&")}%`);

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ keys: (data ?? []).map((r) => r.key) });
});

publicDbRouter.get("/db/:token/:key", async (req, res) => {
  const supabase = createSupabaseAdminClient();
  if (!supabase) { res.status(503).json({ error: "Database not configured" }); return; }
  const projectId = await projectIdForToken(supabase, req.params.token);
  if (!projectId) { res.status(404).json({ error: "Unknown database" }); return; }

  const { data, error } = await supabase
    .from("project_kv")
    .select("value")
    .eq("project_id", projectId)
    .eq("key", req.params.key)
    .maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.status(404).json({ error: "Key not found" }); return; }
  res.type("text/plain").send(data.value);
});

publicDbRouter.post("/db/:token/:key", async (req, res) => {
  const supabase = createSupabaseAdminClient();
  if (!supabase) { res.status(503).json({ error: "Database not configured" }); return; }
  const projectId = await projectIdForToken(supabase, req.params.token);
  if (!projectId) { res.status(404).json({ error: "Unknown database" }); return; }

  // Body arrives as raw text (mounted with express.text()); JSON bodies are
  // stored verbatim as their serialized form.
  const value = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? "");
  if (value.length > MAX_VALUE_BYTES) {
    res.status(400).json({ error: "value exceeds 100 KB" });
    return;
  }

  const { error } = await supabase
    .from("project_kv")
    .upsert(
      { project_id: projectId, key: req.params.key, value, updated_at: new Date().toISOString() },
      { onConflict: "project_id,key" },
    );
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

publicDbRouter.delete("/db/:token/:key", async (req, res) => {
  const supabase = createSupabaseAdminClient();
  if (!supabase) { res.status(503).json({ error: "Database not configured" }); return; }
  const projectId = await projectIdForToken(supabase, req.params.token);
  if (!projectId) { res.status(404).json({ error: "Unknown database" }); return; }

  const { error } = await supabase
    .from("project_kv")
    .delete()
    .eq("project_id", projectId)
    .eq("key", req.params.key);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

// --- Workspace pane (cookie-authed, RLS-protected) --------------------------

export const kvRouter = Router();

kvRouter.get("/projects/:id/kv", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data, error } = await supabase
    .from("project_kv")
    .select("key, value, updated_at")
    .eq("project_id", req.params.id)
    .order("key")
    .limit(MAX_KEYS);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ entries: data ?? [] });
});

kvRouter.put("/projects/:id/kv", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { key, value } = req.body as { key?: string; value?: string };
  if (!key || typeof value !== "string") {
    res.status(400).json({ error: "key and value required" });
    return;
  }
  if (value.length > MAX_VALUE_BYTES) {
    res.status(400).json({ error: "value exceeds 100 KB" });
    return;
  }

  const { error } = await supabase
    .from("project_kv")
    .upsert(
      { project_id: req.params.id, key, value, updated_at: new Date().toISOString() },
      { onConflict: "project_id,key" },
    );
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

kvRouter.delete("/projects/:id/kv", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const key = req.query.key as string | undefined;
  if (!key) { res.status(400).json({ error: "key required" }); return; }

  const { error } = await supabase
    .from("project_kv")
    .delete()
    .eq("project_id", req.params.id)
    .eq("key", key);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});
