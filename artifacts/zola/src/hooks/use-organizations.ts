// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./use-projects";

export interface Organization {
  id: string;
  name: string;
  personal: boolean;
  owner_id: string;
  created_at: string;
  role: string;
}

export interface OrgMember {
  user_id: string;
  email: string | null;
  role: string;
}

export interface OrgInvite {
  id: string;
  email: string | null;
  token: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
}

export function useOrganizations() {
  return useQuery({
    queryKey: ["organizations"],
    queryFn: () =>
      apiFetch<{ organizations: Organization[] }>("/api/orgs").then(
        (d) => d.organizations,
      ),
  });
}

export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<{ organization: Organization }>("/api/orgs", {
        method: "POST",
        body: JSON.stringify({ name }),
      }).then((d) => d.organization),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["organizations"] }),
  });
}

export function useRenameOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiFetch<{ organization: Organization }>(`/api/orgs/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }).then((d) => d.organization),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["organizations"] }),
  });
}

export function useOrgMembers(orgId: string | undefined) {
  return useQuery({
    queryKey: ["org-members", orgId],
    queryFn: () =>
      apiFetch<{ members: OrgMember[] }>(`/api/orgs/${orgId}/members`).then(
        (d) => d.members,
      ),
    enabled: !!orgId,
  });
}

export function useChangeMemberRole(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiFetch<{ ok: boolean }>(`/api/orgs/${orgId}/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-members", orgId] }),
  });
}

export function useRemoveOrgMember(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<{ ok: boolean }>(`/api/orgs/${orgId}/members/${userId}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-members", orgId] }),
  });
}

export function useOrgInvites(orgId: string | undefined) {
  return useQuery({
    queryKey: ["org-invites", orgId],
    queryFn: () =>
      apiFetch<{ invites: OrgInvite[] }>(`/api/orgs/${orgId}/invites`).then(
        (d) => d.invites,
      ),
    enabled: !!orgId,
  });
}

export function useCreateOrgInvite(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, role }: { email?: string; role?: string }) =>
      apiFetch<{ invite: OrgInvite }>(`/api/orgs/${orgId}/invites`, {
        method: "POST",
        body: JSON.stringify({ email: email || undefined, role }),
      }).then((d) => d.invite),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-invites", orgId] }),
  });
}

export function useRevokeOrgInvite(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      apiFetch<{ ok: boolean }>(`/api/orgs/${orgId}/invites/${inviteId}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-invites", orgId] }),
  });
}

export interface OrgInvitePreview {
  org_name: string;
  role: string;
  status: string;
}

export function useOrgInvitePreview(token: string | undefined) {
  return useQuery({
    queryKey: ["org-invite-preview", token],
    queryFn: () =>
      apiFetch<{ invite: OrgInvitePreview }>(`/api/org-invites/${token}`).then(
        (d) => d.invite,
      ),
    enabled: !!token,
    retry: false,
  });
}

export function useAcceptOrgInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      apiFetch<{ org_id: string }>(`/api/org-invites/${token}/accept`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["organizations"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
