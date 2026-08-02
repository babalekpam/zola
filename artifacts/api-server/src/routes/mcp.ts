// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Router } from "express";
import { createSupabaseServerClient } from "../lib/supabase";
import { MCP_CATALOG } from "../lib/mcp/registry";
import { probeMcpServer, type McpServerRow } from "../lib/mcp/client";
import { assertSafeOutboundUrl } from "../lib/net/outbound-url";

const router = Router();

const MAX_SERVERS_PER_PROJECT = 10;
const MAX_HEADERS = 8;
const HEADER_NAME_RE = /^[A-Za-z0-9-]{1,64}$/;

interface ServerRecord {
  id: string;
  name: string;
  catalog_id: string | null;
  transport: "http" | "sse";
  url: string;
  headers: Record<string, string>;
  enabled: boolean;
  tool_count: number;
  last_error: string | null;
  last_checked_at: string | null;
}

/**
 * Header values are credentials. They go out to the MCP server on every call
 * but never come back to the browser — the UI shows which headers exist, not
 * what they contain, the same way the Secrets tab masks values.
 */
function redact(row: ServerRecord) {
  return {
    ...row,
    headers: Object.fromEntries(
      Object.keys(row.headers ?? {}).map((k) => [k, "••••••••"]),
    ),
    headerNames: Object.keys(row.headers ?? {}),
  };
}

function parseHeaders(input: unknown): Record<string, string> | { error: string } {
  if (input == null) return {};
  if (typeof input !== "object" || Array.isArray(input)) {
    return { error: "headers must be an object" };
  }
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length > MAX_HEADERS) return { error: `at most ${MAX_HEADERS} headers` };
  const out: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (!HEADER_NAME_RE.test(key)) return { error: `invalid header name: ${key}` };
    if (typeof value !== "string" || value.length > 4_000) {
      return { error: `invalid header value for ${key}` };
    }
    out[key] = value;
  }
  return out;
}

/** The picker's source of truth; static, so no auth needed. */
router.get("/mcp/catalog", (_req, res) => {
  res.json({ servers: MCP_CATALOG });
});

router.get("/projects/:id/mcp", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data, error } = await supabase
    .from("project_mcp_servers")
    .select("*")
    .eq("project_id", req.params.id)
    .order("created_at");

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ servers: ((data ?? []) as ServerRecord[]).map(redact) });
});

router.post("/projects/:id/mcp", async (req, res) => {
  const projectId = req.params.id;
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = req.body as {
    name?: string;
    catalogId?: string | null;
    transport?: string;
    url?: string;
    headers?: unknown;
    enabled?: boolean;
  };

  const name = (body.name ?? "").trim();
  if (!name || name.length > 60) {
    res.status(400).json({ error: "name is required (max 60 chars)" }); return;
  }
  const transport = body.transport === "sse" ? "sse" : "http";
  const urlCheck = assertSafeOutboundUrl(body.url ?? "");
  if (!urlCheck.ok) { res.status(400).json({ error: urlCheck.error }); return; }
  const headers = parseHeaders(body.headers);
  if ("error" in headers) { res.status(400).json({ error: headers.error }); return; }

  const { count } = await supabase
    .from("project_mcp_servers")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);
  if ((count ?? 0) >= MAX_SERVERS_PER_PROJECT) {
    res.status(400).json({ error: `At most ${MAX_SERVERS_PER_PROJECT} MCP servers per project` });
    return;
  }

  const { data, error } = await supabase
    .from("project_mcp_servers")
    .insert({
      project_id: projectId,
      name,
      catalog_id: body.catalogId ?? null,
      transport,
      url: urlCheck.url,
      headers,
      enabled: body.enabled !== false,
    })
    .select("*")
    .single();

  if (error) {
    const conflict = error.code === "23505";
    res.status(conflict ? 409 : 500)
      .json({ error: conflict ? `An MCP server named "${name}" already exists` : error.message });
    return;
  }
  res.json({ server: redact(data as ServerRecord) });
});

router.patch("/projects/:id/mcp/:serverId", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = req.body as {
    name?: string;
    transport?: string;
    url?: string;
    headers?: unknown;
    enabled?: boolean;
  };
  const patch: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name || name.length > 60) { res.status(400).json({ error: "invalid name" }); return; }
    patch.name = name;
  }
  if (body.transport !== undefined) patch.transport = body.transport === "sse" ? "sse" : "http";
  if (body.url !== undefined) {
    const urlCheck = assertSafeOutboundUrl(body.url);
    if (!urlCheck.ok) { res.status(400).json({ error: urlCheck.error }); return; }
    patch.url = urlCheck.url;
  }
  // Headers are write-only: the client sends them again to change them, and
  // omitting the field keeps the stored credentials untouched.
  if (body.headers !== undefined) {
    const headers = parseHeaders(body.headers);
    if ("error" in headers) { res.status(400).json({ error: headers.error }); return; }
    patch.headers = headers;
  }
  if (body.enabled !== undefined) patch.enabled = !!body.enabled;

  if (Object.keys(patch).length === 0) { res.status(400).json({ error: "nothing to update" }); return; }

  const { data, error } = await supabase
    .from("project_mcp_servers")
    .update(patch)
    .eq("id", req.params.serverId)
    .eq("project_id", req.params.id)
    .select("*")
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ server: redact(data as ServerRecord) });
});

router.delete("/projects/:id/mcp/:serverId", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { error } = await supabase
    .from("project_mcp_servers")
    .delete()
    .eq("id", req.params.serverId)
    .eq("project_id", req.params.id);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

/**
 * Dial the server and list its tools. The stored credentials are used, so this
 * doubles as "are my keys still good?" — the result is written back to the row
 * and shown as the server's status.
 */
router.post("/projects/:id/mcp/:serverId/test", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data, error } = await supabase
    .from("project_mcp_servers")
    .select("*")
    .eq("id", req.params.serverId)
    .eq("project_id", req.params.id)
    .maybeSingle();

  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.status(404).json({ error: "MCP server not found" }); return; }

  const row = data as ServerRecord;
  const server: McpServerRow = {
    id: row.id,
    name: row.name,
    transport: row.transport,
    url: row.url,
    headers: row.headers ?? {},
  };

  const result = await probeMcpServer(server);
  await supabase
    .from("project_mcp_servers")
    .update({
      tool_count: result.ok ? result.tools.length : 0,
      last_error: result.ok ? null : result.error,
      last_checked_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (!result.ok) { res.status(502).json({ ok: false, error: result.error }); return; }
  res.json({ ok: true, tools: result.tools });
});

export default router;
