// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Router } from "express";
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, SUPABASE_URL } from "../lib/supabase";

const router = Router();

function adminClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}

async function roleOf(
  admin: SupabaseClient,
  orgId: string,
  userId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role ?? null;
}

function isAdminRole(role: string | null): boolean {
  return role === "owner" || role === "admin";
}

// --- Workspaces -------------------------------------------------------------

// List the workspaces the caller belongs to (with their role in each).
router.get("/orgs", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data, error } = await supabase
    .from("organization_members")
    .select("role, organizations ( id, name, personal, owner_id, created_at )")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: true });

  if (error) { res.status(500).json({ error: error.message }); return; }

  const orgs = (data ?? [])
    .map((row) => {
      const org = row.organizations as unknown as {
        id: string;
        name: string;
        personal: boolean;
        owner_id: string;
        created_at: string;
      } | null;
      if (!org) return null;
      return { ...org, role: row.role as string };
    })
    .filter((o): o is NonNullable<typeof o> => o !== null);

  res.json({ organizations: orgs });
});

// Create a new workspace and make the caller its owner. Uses the service role
// so the initial owner-membership row can be written before any RLS policy
// would recognise the caller as a member.
router.post("/orgs", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const admin = adminClient();
  if (!admin) { res.status(500).json({ error: "Workspaces are not configured" }); return; }

  const body = req.body as { name?: string };
  const name = (body.name ?? "").trim() || "New Workspace";

  const { data: org, error } = await admin
    .from("organizations")
    .insert({ name, personal: false, owner_id: userData.user.id })
    .select("id, name, personal, owner_id, created_at")
    .single();
  if (error || !org) {
    res.status(500).json({ error: error?.message ?? "Failed to create workspace" });
    return;
  }

  const { error: memberErr } = await admin
    .from("organization_members")
    .insert({ org_id: org.id, user_id: userData.user.id, role: "owner" });
  if (memberErr) {
    await admin.from("organizations").delete().eq("id", org.id);
    res.status(500).json({ error: memberErr.message });
    return;
  }

  res.json({ organization: { ...org, role: "owner" } });
});

// Rename a workspace (admins/owners only).
router.patch("/orgs/:id", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const admin = adminClient();
  if (!admin) { res.status(500).json({ error: "Workspaces are not configured" }); return; }

  const orgId = req.params.id;
  if (!isAdminRole(await roleOf(admin, orgId, userData.user.id))) {
    res.status(403).json({ error: "Only workspace admins can rename it" });
    return;
  }
  const body = req.body as { name?: string };
  const name = (body.name ?? "").trim();
  if (!name) { res.status(400).json({ error: "Name is required" }); return; }

  const { data, error } = await admin
    .from("organizations")
    .update({ name })
    .eq("id", orgId)
    .select("id, name, personal, owner_id, created_at")
    .single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ organization: data });
});

// --- Members ----------------------------------------------------------------

router.get("/orgs/:id/members", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const admin = adminClient();
  if (!admin) { res.status(500).json({ error: "Workspaces are not configured" }); return; }

  const orgId = req.params.id;
  if (!(await roleOf(admin, orgId, userData.user.id))) {
    res.status(403).json({ error: "Not a member of this workspace" });
    return;
  }

  const { data: members } = await admin
    .from("organization_members")
    .select("user_id, role, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  const rows: { user_id: string; email: string | null; role: string }[] = [];
  for (const m of members ?? []) {
    const { data } = await admin.auth.admin.getUserById(m.user_id);
    rows.push({
      user_id: m.user_id,
      email: data.user?.email ?? null,
      role: m.role,
    });
  }
  res.json({ members: rows });
});

// Change a member's role (admins only). Never removes the last owner.
router.patch("/orgs/:id/members/:userId", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const admin = adminClient();
  if (!admin) { res.status(500).json({ error: "Workspaces are not configured" }); return; }

  const { id: orgId, userId } = req.params;
  if (!isAdminRole(await roleOf(admin, orgId, userData.user.id))) {
    res.status(403).json({ error: "Only workspace admins can change roles" });
    return;
  }
  const body = req.body as { role?: string };
  const role = body.role;
  if (role !== "admin" && role !== "member" && role !== "owner") {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  // Demoting an owner must leave at least one owner behind.
  const current = await roleOf(admin, orgId, userId);
  if (current === "owner" && role !== "owner") {
    const { count } = await admin
      .from("organization_members")
      .select("user_id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("role", "owner");
    if ((count ?? 0) <= 1) {
      res.status(400).json({ error: "A workspace must keep at least one owner" });
      return;
    }
  }

  const { error } = await admin
    .from("organization_members")
    .update({ role })
    .eq("org_id", orgId)
    .eq("user_id", userId);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

// Remove a member (admins only). The last owner cannot be removed.
router.delete("/orgs/:id/members/:userId", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const admin = adminClient();
  if (!admin) { res.status(500).json({ error: "Workspaces are not configured" }); return; }

  const { id: orgId, userId } = req.params;
  if (!isAdminRole(await roleOf(admin, orgId, userData.user.id))) {
    res.status(403).json({ error: "Only workspace admins can remove members" });
    return;
  }

  const target = await roleOf(admin, orgId, userId);
  if (target === "owner") {
    const { count } = await admin
      .from("organization_members")
      .select("user_id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("role", "owner");
    if ((count ?? 0) <= 1) {
      res.status(400).json({ error: "A workspace must keep at least one owner" });
      return;
    }
  }

  const { error } = await admin
    .from("organization_members")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", userId);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

// --- Invites (admins only) --------------------------------------------------

router.post("/orgs/:id/invites", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const admin = adminClient();
  if (!admin) { res.status(500).json({ error: "Workspaces are not configured" }); return; }

  const orgId = req.params.id;
  if (!isAdminRole(await roleOf(admin, orgId, userData.user.id))) {
    res.status(403).json({ error: "Only workspace admins can invite" });
    return;
  }
  const body = req.body as { email?: string; role?: string };
  const role = body.role === "admin" ? "admin" : "member";
  const token = randomBytes(24).toString("base64url");

  const { data, error } = await admin
    .from("organization_invites")
    .insert({
      org_id: orgId,
      email: body.email?.trim() || null,
      token,
      role,
      invited_by: userData.user.id,
    })
    .select("id, email, token, role, status, created_at, expires_at")
    .single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ invite: data });
});

router.get("/orgs/:id/invites", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const admin = adminClient();
  if (!admin) { res.status(500).json({ error: "Workspaces are not configured" }); return; }

  const orgId = req.params.id;
  if (!isAdminRole(await roleOf(admin, orgId, userData.user.id))) {
    res.status(403).json({ error: "Only workspace admins can view invites" });
    return;
  }
  const { data, error } = await admin
    .from("organization_invites")
    .select("id, email, token, role, status, created_at, expires_at")
    .eq("org_id", orgId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ invites: data ?? [] });
});

router.delete("/orgs/:id/invites/:inviteId", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const admin = adminClient();
  if (!admin) { res.status(500).json({ error: "Workspaces are not configured" }); return; }

  const { id: orgId, inviteId } = req.params;
  if (!isAdminRole(await roleOf(admin, orgId, userData.user.id))) {
    res.status(403).json({ error: "Only workspace admins can revoke invites" });
    return;
  }
  const { error } = await admin
    .from("organization_invites")
    .update({ status: "revoked" })
    .eq("id", inviteId)
    .eq("org_id", orgId);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

// --- Invite acceptance (any authenticated user) -----------------------------

router.get("/org-invites/:token", async (req, res) => {
  const admin = adminClient();
  if (!admin) { res.status(500).json({ error: "Workspaces are not configured" }); return; }
  const { data: invite } = await admin
    .from("organization_invites")
    .select("org_id, role, status, expires_at")
    .eq("token", req.params.token)
    .maybeSingle();
  if (!invite || invite.status !== "pending") {
    res.status(404).json({ error: "This invite is no longer valid" });
    return;
  }
  const expired =
    invite.expires_at && new Date(invite.expires_at).getTime() < Date.now();
  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", invite.org_id)
    .maybeSingle();
  res.json({
    invite: {
      org_name: org?.name ?? "a workspace",
      role: invite.role,
      status: expired ? "expired" : invite.status,
    },
  });
});

router.post("/org-invites/:token/accept", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const admin = adminClient();
  if (!admin) { res.status(500).json({ error: "Workspaces are not configured" }); return; }

  const userId = userData.user.id;
  const userEmail = userData.user.email?.trim().toLowerCase() ?? null;

  const { data: invite } = await admin
    .from("organization_invites")
    .select("id, org_id, role, email, status, accepted_by, expires_at")
    .eq("token", req.params.token)
    .maybeSingle();
  if (!invite) { res.status(400).json({ error: "This invite is no longer valid" }); return; }
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    res.status(400).json({ error: "This invite has expired" });
    return;
  }
  if (invite.email && invite.email.trim().toLowerCase() !== userEmail) {
    res.status(403).json({ error: "This invite was sent to a different email" });
    return;
  }

  async function addMember(): Promise<string | null> {
    const { error } = await admin!
      .from("organization_members")
      .upsert(
        { org_id: invite!.org_id, user_id: userId, role: invite!.role },
        { onConflict: "org_id,user_id", ignoreDuplicates: true },
      );
    return error ? error.message : null;
  }

  // Idempotent re-open of an already-accepted invite by the same user.
  if (invite.status === "accepted" && invite.accepted_by === userId) {
    const err = await addMember();
    if (err) { res.status(500).json({ error: err }); return; }
    res.json({ org_id: invite.org_id });
    return;
  }
  if (invite.status !== "pending") {
    res.status(400).json({ error: "This invite is no longer valid" });
    return;
  }

  // Atomically claim the invite so a single-use link is consumed once.
  const { data: claimed } = await admin
    .from("organization_invites")
    .update({ status: "accepted", accepted_by: userId })
    .eq("id", invite.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (!claimed) { res.status(400).json({ error: "This invite has already been used" }); return; }

  const memberErr = await addMember();
  if (memberErr) { res.status(500).json({ error: memberErr }); return; }
  res.json({ org_id: invite.org_id });
});

export default router;
