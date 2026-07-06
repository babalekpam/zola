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

async function requireOwner(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("projects")
    .select("owner_id")
    .eq("id", projectId)
    .maybeSingle();
  return !!data && data.owner_id === userId;
}

// --- Invites (owner only) ---------------------------------------------------

router.post("/projects/:id/invites", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const projectId = req.params.id;
  if (!(await requireOwner(supabase, projectId, userData.user.id))) {
    res.status(403).json({ error: "Only the project owner can invite" });
    return;
  }
  const body = req.body as { email?: string };
  const token = randomBytes(24).toString("base64url");

  const { data, error } = await supabase
    .from("project_invites")
    .insert({
      project_id: projectId,
      email: body.email?.trim() || null,
      token,
      role: "editor",
      invited_by: userData.user.id,
    })
    .select("id, email, token, role, status, created_at, expires_at")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ invite: data });
});

router.get("/projects/:id/invites", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const projectId = req.params.id;
  if (!(await requireOwner(supabase, projectId, userData.user.id))) {
    res.status(403).json({ error: "Only the project owner can view invites" });
    return;
  }
  const { data, error } = await supabase
    .from("project_invites")
    .select("id, email, token, role, status, created_at, expires_at")
    .eq("project_id", projectId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ invites: data ?? [] });
});

router.delete("/projects/:id/invites/:inviteId", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { id: projectId, inviteId } = req.params;
  if (!(await requireOwner(supabase, projectId, userData.user.id))) {
    res.status(403).json({ error: "Only the project owner can revoke invites" });
    return;
  }
  const { error } = await supabase
    .from("project_invites")
    .update({ status: "revoked" })
    .eq("id", inviteId)
    .eq("project_id", projectId);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ ok: true });
});

// --- Members ----------------------------------------------------------------

router.get("/projects/:id/members", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const projectId = req.params.id;
  const { data: project } = await supabase
    .from("projects")
    .select("owner_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const { data: members } = await supabase
    .from("project_members")
    .select("user_id, role, created_at")
    .eq("project_id", projectId);

  // Resolve emails via the admin API when available.
  const admin = adminClient();
  const rows: { user_id: string; email: string | null; role: string; owner: boolean }[] =
    [];
  const ownerId = project.owner_id as string;
  const ids = new Set<string>([ownerId, ...(members ?? []).map((m) => m.user_id)]);
  for (const id of ids) {
    let email: string | null = null;
    if (admin) {
      const { data } = await admin.auth.admin.getUserById(id);
      email = data.user?.email ?? null;
    }
    rows.push({
      user_id: id,
      email,
      role: id === ownerId ? "owner" : "editor",
      owner: id === ownerId,
    });
  }
  res.json({ members: rows });
});

router.delete("/projects/:id/members/:userId", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { id: projectId, userId } = req.params;
  if (!(await requireOwner(supabase, projectId, userData.user.id))) {
    res.status(403).json({ error: "Only the project owner can remove members" });
    return;
  }
  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ ok: true });
});

// --- Invite acceptance (any authenticated user) -----------------------------

router.get("/invites/:token", async (req, res) => {
  const admin = adminClient();
  if (!admin) {
    res.status(500).json({ error: "Collaboration is not configured" });
    return;
  }
  const { data: invite } = await admin
    .from("project_invites")
    .select("project_id, role, status, expires_at")
    .eq("token", req.params.token)
    .maybeSingle();
  if (!invite || invite.status !== "pending") {
    res.status(404).json({ error: "This invite is no longer valid" });
    return;
  }
  const expired =
    invite.expires_at && new Date(invite.expires_at).getTime() < Date.now();
  const { data: project } = await admin
    .from("projects")
    .select("name")
    .eq("id", invite.project_id)
    .maybeSingle();
  res.json({
    invite: {
      project_name: project?.name ?? "a project",
      role: invite.role,
      status: expired ? "expired" : invite.status,
    },
  });
});

router.post("/invites/:token/accept", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const admin = adminClient();
  if (!admin) {
    res.status(500).json({ error: "Collaboration is not configured" });
    return;
  }
  const userId = userData.user.id;
  const userEmail = userData.user.email?.trim().toLowerCase() ?? null;

  const { data: invite } = await admin
    .from("project_invites")
    .select("id, project_id, role, email, status, accepted_by, expires_at")
    .eq("token", req.params.token)
    .maybeSingle();
  if (!invite) {
    res.status(400).json({ error: "This invite is no longer valid" });
    return;
  }
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    res.status(400).json({ error: "This invite has expired" });
    return;
  }
  // Email-bound invites can only be accepted by the matching account.
  if (invite.email && invite.email.trim().toLowerCase() !== userEmail) {
    res.status(403).json({ error: "This invite was sent to a different email" });
    return;
  }

  async function addMember(): Promise<string | null> {
    const { error } = await admin!
      .from("project_members")
      .upsert(
        { project_id: invite!.project_id, user_id: userId, role: invite!.role },
        { onConflict: "project_id,user_id" },
      );
    return error ? error.message : null;
  }

  // Idempotent: the same user re-opening their accepted invite just re-joins.
  if (invite.status === "accepted" && invite.accepted_by === userId) {
    const err = await addMember();
    if (err) {
      res.status(500).json({ error: err });
      return;
    }
    res.json({ project_id: invite.project_id });
    return;
  }
  if (invite.status !== "pending") {
    res.status(400).json({ error: "This invite is no longer valid" });
    return;
  }

  // Atomically claim the invite so only one user can consume a single-use link.
  const { data: claimed } = await admin
    .from("project_invites")
    .update({ status: "accepted", accepted_by: userId })
    .eq("id", invite.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (!claimed) {
    res.status(400).json({ error: "This invite has already been used" });
    return;
  }

  const memberErr = await addMember();
  if (memberErr) {
    res.status(500).json({ error: memberErr });
    return;
  }
  res.json({ project_id: invite.project_id });
});

export default router;
