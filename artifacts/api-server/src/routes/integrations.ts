// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Router } from "express";
import { createSupabaseServerClient } from "../lib/supabase";
import {
  INTEGRATIONS,
  getIntegration,
  publicIntegration,
  type IntegrationDescriptor,
} from "../lib/integrations/catalog";
import { buildMcpHeaders, getMcpCatalogEntry } from "../lib/mcp/registry";

const router = Router();

const MAX_CREDENTIAL_CHARS = 4_000;

interface UserIntegrationRow {
  id: string;
  provider: string;
  label: string;
  credentials: Record<string, string>;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * Credentials never travel back to the browser. The UI needs to know which
 * fields are filled in (to show "connected" and to pre-tick the right boxes),
 * so it gets the key names and, for non-secret fields, the value — the same
 * split the catalog already declares with `secret`.
 */
function presentIntegration(row: UserIntegrationRow, descriptor?: IntegrationDescriptor) {
  const creds = row.credentials ?? {};
  const visible: Record<string, string> = {};
  for (const field of descriptor?.fields ?? []) {
    if (!field.secret && creds[field.key]) visible[field.key] = creds[field.key];
  }
  return {
    provider: row.provider,
    label: row.label,
    status: row.status,
    filledFields: Object.keys(creds).filter((k) => !!creds[k]),
    values: visible,
    connectedAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get("/integrations/catalog", (_req, res) => {
  res.json({ integrations: INTEGRATIONS.map(publicIntegration) });
});

router.get("/integrations", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data, error } = await supabase
    .from("user_integrations")
    .select("*")
    .eq("user_id", userData.user.id)
    .order("provider");

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({
    integrations: ((data ?? []) as UserIntegrationRow[]).map((row) =>
      presentIntegration(row, getIntegration(row.provider)),
    ),
  });
});

/** Connect or update — send only the fields you're changing. */
router.put("/integrations/:provider", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const descriptor = getIntegration(req.params.provider);
  if (!descriptor) { res.status(404).json({ error: "Unknown integration" }); return; }

  const body = req.body as { credentials?: Record<string, unknown>; label?: string };
  const incoming = body.credentials ?? {};
  const allowed = new Set(descriptor.fields.map((f) => f.key));

  const { data: existing } = await supabase
    .from("user_integrations")
    .select("credentials")
    .eq("user_id", userData.user.id)
    .eq("provider", descriptor.id)
    .maybeSingle();

  const credentials: Record<string, string> = {
    ...((existing?.credentials as Record<string, string>) ?? {}),
  };
  for (const [key, value] of Object.entries(incoming)) {
    if (!allowed.has(key)) { res.status(400).json({ error: `unknown field: ${key}` }); return; }
    if (typeof value !== "string") { res.status(400).json({ error: `${key} must be a string` }); return; }
    if (value.length > MAX_CREDENTIAL_CHARS) { res.status(400).json({ error: `${key} is too long` }); return; }
    // An explicitly empty string clears the field rather than storing "".
    if (value === "") delete credentials[key];
    else credentials[key] = value;
  }

  const missing = descriptor.fields
    .filter((f) => f.required && !credentials[f.key])
    .map((f) => f.label);
  if (missing.length > 0) {
    res.status(400).json({ error: `Missing required field(s): ${missing.join(", ")}` });
    return;
  }

  const { data, error } = await supabase
    .from("user_integrations")
    .upsert(
      {
        user_id: userData.user.id,
        provider: descriptor.id,
        label: (body.label ?? "").slice(0, 80),
        credentials,
        status: "connected",
      },
      { onConflict: "user_id,provider" },
    )
    .select("*")
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ integration: presentIntegration(data as UserIntegrationRow, descriptor) });
});

router.delete("/integrations/:provider", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { error } = await supabase
    .from("user_integrations")
    .delete()
    .eq("user_id", userData.user.id)
    .eq("provider", req.params.provider);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

router.get("/projects/:id/integrations", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data, error } = await supabase
    .from("project_integrations")
    .select("provider, secret_keys, mcp_server_id, created_at")
    .eq("project_id", req.params.id)
    .order("created_at");

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ attached: data ?? [] });
});

/**
 * Attach a connected integration to a project: copy its credentials into the
 * project's Secrets under the catalog's env var names, and register its MCP
 * server so Loop can call the service's tools. Both halves are idempotent —
 * re-attaching after rotating a key refreshes everything in place.
 */
router.post("/projects/:id/integrations/:provider", async (req, res) => {
  const projectId = req.params.id;
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const descriptor = getIntegration(req.params.provider);
  if (!descriptor) { res.status(404).json({ error: "Unknown integration" }); return; }

  const { data: connection } = await supabase
    .from("user_integrations")
    .select("credentials")
    .eq("user_id", userData.user.id)
    .eq("provider", descriptor.id)
    .maybeSingle();

  if (!connection) {
    res.status(400).json({ error: `Connect ${descriptor.name} on the Integrations page first` });
    return;
  }
  const credentials = (connection.credentials as Record<string, string>) ?? {};

  // 1. Secrets — the running app reads these from process.env / import.meta.env.
  const secretRows = descriptor.fields
    .filter((f) => f.envVar && credentials[f.key])
    .map((f) => ({ project_id: projectId, key: f.envVar!, value: credentials[f.key] }));

  if (secretRows.length > 0) {
    const { error: secretErr } = await supabase
      .from("project_secrets")
      .upsert(secretRows, { onConflict: "project_id,key" });
    if (secretErr) { res.status(500).json({ error: secretErr.message }); return; }
  }

  // 2. MCP server — only when the service has one and we hold its credential.
  let mcpServerId: string | null = null;
  const mcpEntry = descriptor.mcp ? getMcpCatalogEntry(descriptor.mcp.catalogId) : undefined;
  if (descriptor.mcp && mcpEntry) {
    const credential = credentials[descriptor.mcp.credentialField];
    if (mcpEntry.auth !== "none" && !credential) {
      res.status(400).json({
        error: `${descriptor.name}'s MCP server needs the ${descriptor.mcp.credentialField} field — add it on the Integrations page.`,
      });
      return;
    }
    const { data: server, error: mcpErr } = await supabase
      .from("project_mcp_servers")
      .upsert(
        {
          project_id: projectId,
          name: mcpEntry.name,
          catalog_id: mcpEntry.id,
          transport: mcpEntry.transport,
          url: mcpEntry.url,
          headers: buildMcpHeaders(mcpEntry, credential),
          enabled: true,
        },
        { onConflict: "project_id,name" },
      )
      .select("id")
      .single();
    if (mcpErr) { res.status(500).json({ error: mcpErr.message }); return; }
    mcpServerId = server?.id ?? null;
  }

  const { error: linkErr } = await supabase
    .from("project_integrations")
    .upsert(
      {
        project_id: projectId,
        provider: descriptor.id,
        attached_by: userData.user.id,
        mcp_server_id: mcpServerId,
        secret_keys: secretRows.map((s) => s.key),
      },
      { onConflict: "project_id,provider" },
    );
  if (linkErr) { res.status(500).json({ error: linkErr.message }); return; }

  res.json({
    ok: true,
    secretKeys: secretRows.map((s) => s.key),
    mcpServerId,
  });
});

/**
 * Detach. The MCP server goes (it only exists because of the integration), but
 * the secrets stay: the project's code may already reference them, and silently
 * breaking a running app is worse than leaving a key the user can delete in the
 * Secrets tab.
 */
router.delete("/projects/:id/integrations/:provider", async (req, res) => {
  const projectId = req.params.id;
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: link } = await supabase
    .from("project_integrations")
    .select("mcp_server_id")
    .eq("project_id", projectId)
    .eq("provider", req.params.provider)
    .maybeSingle();

  if (link?.mcp_server_id) {
    await supabase
      .from("project_mcp_servers")
      .delete()
      .eq("id", link.mcp_server_id)
      .eq("project_id", projectId);
  }

  const { error } = await supabase
    .from("project_integrations")
    .delete()
    .eq("project_id", projectId)
    .eq("provider", req.params.provider);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

export default router;
