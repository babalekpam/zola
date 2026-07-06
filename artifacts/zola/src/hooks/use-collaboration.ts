// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./use-projects";

export interface ProjectInvite {
  id: string;
  email: string | null;
  token: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
}

export interface ProjectMember {
  user_id: string;
  email: string | null;
  role: string;
  owner: boolean;
}

export function useProjectInvites(projectId: string | undefined) {
  return useQuery({
    queryKey: ["invites", projectId],
    queryFn: () =>
      apiFetch<{ invites: ProjectInvite[] }>(
        `/api/projects/${projectId}/invites`,
      ).then((d) => d.invites),
    enabled: !!projectId,
  });
}

export function useProjectMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: ["members", projectId],
    queryFn: () =>
      apiFetch<{ members: ProjectMember[] }>(
        `/api/projects/${projectId}/members`,
      ).then((d) => d.members),
    enabled: !!projectId,
  });
}

export function useCreateInvite(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email?: string) =>
      apiFetch<{ invite: ProjectInvite }>(
        `/api/projects/${projectId}/invites`,
        { method: "POST", body: JSON.stringify({ email: email || undefined }) },
      ).then((d) => d.invite),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invites", projectId] }),
  });
}

export function useRevokeInvite(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      apiFetch<{ ok: boolean }>(
        `/api/projects/${projectId}/invites/${inviteId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invites", projectId] }),
  });
}

export function useRemoveMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<{ ok: boolean }>(
        `/api/projects/${projectId}/members/${userId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", projectId] }),
  });
}

export interface InvitePreview {
  project_name: string;
  role: string;
  status: string;
}

export function useInvitePreview(token: string | undefined) {
  return useQuery({
    queryKey: ["invite-preview", token],
    queryFn: () =>
      apiFetch<{ invite: InvitePreview }>(`/api/invites/${token}`).then(
        (d) => d.invite,
      ),
    enabled: !!token,
    retry: false,
  });
}

export function useAcceptInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      apiFetch<{ project_id: string }>(`/api/invites/${token}/accept`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}
