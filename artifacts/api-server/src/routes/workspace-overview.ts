// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Router } from "express";
import { createSupabaseServerClient } from "../lib/supabase";

const router = Router();

/**
 * Cross-project views for the dashboard's Published Projects and Security
 * pages. Everything runs on the caller's JWT, so RLS decides what's visible —
 * these are convenience aggregations, not a privilege boundary of their own.
 */

interface ProjectRow {
  id: string;
  name: string;
  visibility: "private" | "public" | null;
  updated_at: string;
}

/** Projects with a live deployment, newest deployment first. */
router.get("/published", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: deployments, error } = await supabase
    .from("deployments")
    .select("id, slug, status, file_count, created_at, project_id, projects!inner(id, name, visibility)")
    .order("created_at", { ascending: false });

  if (error) { res.status(500).json({ error: error.message }); return; }

  type DeploymentRow = {
    id: string;
    slug: string;
    status: string;
    file_count: number;
    created_at: string;
    project_id: string;
    projects: { id: string; name: string; visibility: "private" | "public" | null } | null;
  };

  // One card per project: its most recent deployment plus how many it has had.
  const byProject = new Map<
    string,
    {
      projectId: string;
      projectName: string;
      visibility: "private" | "public";
      slug: string;
      status: string;
      fileCount: number;
      deployedAt: string;
      deploymentCount: number;
      domains: string[];
    }
  >();

  for (const row of (deployments ?? []) as unknown as DeploymentRow[]) {
    const existing = byProject.get(row.project_id);
    if (existing) {
      existing.deploymentCount += 1;
      continue;
    }
    byProject.set(row.project_id, {
      projectId: row.project_id,
      projectName: row.projects?.name ?? "Untitled project",
      visibility: row.projects?.visibility ?? "private",
      slug: row.slug,
      status: row.status,
      fileCount: row.file_count,
      deployedAt: row.created_at,
      deploymentCount: 1,
      domains: [],
    });
  }

  const projectIds = [...byProject.keys()];
  if (projectIds.length > 0) {
    const { data: domains } = await supabase
      .from("custom_domains")
      .select("project_id, domain, verified")
      .in("project_id", projectIds);
    for (const d of (domains ?? []) as { project_id: string; domain: string; verified: boolean }[]) {
      if (!d.verified) continue;
      byProject.get(d.project_id)?.domains.push(d.domain);
    }

    const { data: hits } = await supabase
      .from("site_hits")
      .select("project_id, count")
      .in("project_id", projectIds);
    const hitTotals = new Map<string, number>();
    for (const h of (hits ?? []) as { project_id: string; count: number }[]) {
      hitTotals.set(h.project_id, (hitTotals.get(h.project_id) ?? 0) + Number(h.count ?? 0));
    }
    res.json({
      sites: [...byProject.values()].map((s) => ({ ...s, hits: hitTotals.get(s.projectId) ?? 0 })),
    });
    return;
  }

  res.json({ sites: [] });
});

/**
 * Security overview: the account-level view of what's exposed. The per-project
 * file scan stays in the workspace Security tab (it needs the file contents);
 * this is the inventory that only makes sense across projects — what's public,
 * where secrets live, which MCP servers can act on the user's behalf.
 */
router.get("/security/overview", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, visibility, updated_at")
    .order("updated_at", { ascending: false });

  if (error) { res.status(500).json({ error: error.message }); return; }
  const rows = (projects ?? []) as ProjectRow[];
  const ids = rows.map((p) => p.id);

  const counts = new Map<string, { secrets: number; mcpServers: number; members: number }>();
  for (const id of ids) counts.set(id, { secrets: 0, mcpServers: 0, members: 0 });

  if (ids.length > 0) {
    const [secrets, mcp, members] = await Promise.all([
      supabase.from("project_secrets").select("project_id, key").in("project_id", ids),
      supabase.from("project_mcp_servers").select("project_id, enabled").in("project_id", ids),
      supabase.from("project_members").select("project_id").in("project_id", ids),
    ]);
    for (const s of (secrets.data ?? []) as { project_id: string }[]) {
      const c = counts.get(s.project_id);
      if (c) c.secrets += 1;
    }
    for (const m of (mcp.data ?? []) as { project_id: string; enabled: boolean }[]) {
      const c = counts.get(m.project_id);
      if (c && m.enabled) c.mcpServers += 1;
    }
    for (const m of (members.data ?? []) as { project_id: string }[]) {
      const c = counts.get(m.project_id);
      if (c) c.members += 1;
    }
  }

  const { count: integrationCount } = await supabase
    .from("user_integrations")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userData.user.id);

  res.json({
    projects: rows.map((p) => ({
      id: p.id,
      name: p.name,
      visibility: p.visibility ?? "private",
      updatedAt: p.updated_at,
      ...(counts.get(p.id) ?? { secrets: 0, mcpServers: 0, members: 0 }),
    })),
    integrationCount: integrationCount ?? 0,
    email: userData.user.email ?? null,
    lastSignInAt: userData.user.last_sign_in_at ?? null,
    // Supabase reports the identity providers backing the account; a
    // password-only account is worth flagging as weaker than an OAuth one.
    providers: (userData.user.app_metadata?.providers as string[] | undefined) ?? [],
  });
});

export default router;
