// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Router, type Request, type Response, type NextFunction } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "../lib/supabase";

// Platform-owner (super admin) API. Access = the authenticated user's email
// is in the PLATFORM_ADMIN_EMAILS allowlist (comma-separated env var).
// All reads/writes go through the service role — this is the one place that
// deliberately crosses tenant boundaries, so the gate lives server-side only.

const router = Router();

function adminEmails(): Set<string> {
  return new Set(
    (process.env.PLATFORM_ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const allowed = adminEmails();
  if (allowed.size === 0) {
    res.status(403).json({
      error: "Platform admin is not configured (set PLATFORM_ADMIN_EMAILS).",
    });
    return;
  }
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  const email = userData.user?.email?.toLowerCase();
  if (!email || !allowed.has(email)) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    res.status(503).json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured" });
    return;
  }
  (req as Request & { admin: SupabaseClient }).admin = admin;
  next();
}

function adminOf(req: Request): SupabaseClient {
  return (req as Request & { admin: SupabaseClient }).admin;
}

// Lightweight probe for the UI: is the signed-in user a platform admin?
// Registered before the gate so it answers false instead of 403.
router.get("/admin/me", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email?.toLowerCase();
  res.json({ admin: Boolean(email && adminEmails().has(email)) });
});

router.use("/admin", (req, res, next) => {
  void requireAdmin(req, res, next);
});

async function countOf(admin: SupabaseClient, table: string): Promise<number> {
  const { count } = await admin
    .from(table)
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}

router.get("/admin/stats", async (req, res) => {
  const admin = adminOf(req);
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const [users, orgs, projects, deployments, messages, domains] =
    await Promise.all([
      countOf(admin, "profiles"),
      countOf(admin, "organizations"),
      countOf(admin, "projects"),
      countOf(admin, "deployments"),
      countOf(admin, "messages"),
      countOf(admin, "custom_domains"),
    ]);
  const [
    { count: publicProjects },
    { count: newUsers7d },
    { count: newProjects7d },
    { count: aiRequests7d },
  ] = await Promise.all([
    admin.from("projects").select("*", { count: "exact", head: true }).eq("visibility", "public"),
    admin.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", since),
    admin.from("projects").select("*", { count: "exact", head: true }).gte("created_at", since),
    admin.from("ai_usage").select("*", { count: "exact", head: true }).gte("created_at", since),
  ]);

  res.json({
    stats: {
      users,
      orgs,
      projects,
      deployments,
      messages,
      domains,
      publicProjects: publicProjects ?? 0,
      newUsers7d: newUsers7d ?? 0,
      newProjects7d: newProjects7d ?? 0,
      aiRequests7d: aiRequests7d ?? 0,
    },
  });
});

router.get("/admin/users", async (req, res) => {
  const admin = adminOf(req);
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 100,
  });
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({
    users: data.users
      .map((u) => ({
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
      }))
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")),
  });
});

router.get("/admin/orgs", async (req, res) => {
  const admin = adminOf(req);
  const { data: orgs, error } = await admin
    .from("organizations")
    .select("id, name, personal, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) { res.status(500).json({ error: error.message }); return; }

  const ids = (orgs ?? []).map((o) => o.id);
  const members = new Map<string, number>();
  const projects = new Map<string, number>();
  if (ids.length > 0) {
    const [{ data: m }, { data: p }] = await Promise.all([
      admin.from("organization_members").select("org_id").in("org_id", ids).limit(5000),
      admin.from("projects").select("org_id").in("org_id", ids).limit(5000),
    ]);
    for (const row of m ?? []) {
      members.set(row.org_id, (members.get(row.org_id) ?? 0) + 1);
    }
    for (const row of p ?? []) {
      if (row.org_id) projects.set(row.org_id, (projects.get(row.org_id) ?? 0) + 1);
    }
  }

  res.json({
    orgs: (orgs ?? []).map((o) => ({
      ...o,
      member_count: members.get(o.id) ?? 0,
      project_count: projects.get(o.id) ?? 0,
    })),
  });
});

router.get("/admin/projects", async (req, res) => {
  const admin = adminOf(req);
  const q = ((req.query.q as string | undefined) ?? "").trim();
  let query = admin
    .from("projects")
    .select("id, name, visibility, org_id, owner_id, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (q) query = query.ilike("name", `%${q.replace(/[%_]/g, "\\$&")}%`);
  const { data, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ projects: data ?? [] });
});

// Moderation: force a project private (pull it off Explore).
router.patch("/admin/projects/:id/unpublish", async (req, res) => {
  const admin = adminOf(req);
  const { error } = await admin
    .from("projects")
    .update({ visibility: "private" })
    .eq("id", req.params.id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

// Moderation: remove a project entirely (files/deployments/etc. cascade).
router.delete("/admin/projects/:id", async (req, res) => {
  const admin = adminOf(req);
  const { error } = await admin
    .from("projects")
    .delete()
    .eq("id", req.params.id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

export default router;
