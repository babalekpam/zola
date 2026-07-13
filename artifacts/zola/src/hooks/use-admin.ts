// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/hooks/use-projects";

export interface PlatformStats {
  users: number;
  orgs: number;
  projects: number;
  deployments: number;
  messages: number;
  domains: number;
  publicProjects: number;
  newUsers7d: number;
  newProjects7d: number;
  aiRequests7d: number;
}

export interface AdminUser {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

export interface AdminOrg {
  id: string;
  name: string;
  personal: boolean;
  created_at: string;
  member_count: number;
  project_count: number;
}

export interface AdminProject {
  id: string;
  name: string;
  visibility: "private" | "public";
  org_id: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

/** Cheap probe: is the signed-in user a platform admin? Never 403s. */
export function useIsAdmin() {
  return useQuery({
    queryKey: ["admin-me"],
    queryFn: () =>
      apiFetch<{ admin: boolean }>("/api/admin/me").then((d) => d.admin),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

/** Also doubles as the access check: 403 → not a platform admin. */
export function usePlatformStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: () =>
      apiFetch<{ stats: PlatformStats }>("/api/admin/stats").then(
        (d) => d.stats,
      ),
    retry: false,
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: () =>
      apiFetch<{ users: AdminUser[] }>("/api/admin/users").then((d) => d.users),
    retry: false,
  });
}

export function useAdminOrgs() {
  return useQuery({
    queryKey: ["admin-orgs"],
    queryFn: () =>
      apiFetch<{ orgs: AdminOrg[] }>("/api/admin/orgs").then((d) => d.orgs),
    retry: false,
  });
}

export function useAdminProjects(q: string) {
  return useQuery({
    queryKey: ["admin-projects", q],
    queryFn: () =>
      apiFetch<{ projects: AdminProject[] }>(
        q ? `/api/admin/projects?q=${encodeURIComponent(q)}` : "/api/admin/projects",
      ).then((d) => d.projects),
    retry: false,
  });
}

export function useAdminUnpublish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      apiFetch<{ ok: boolean }>(`/api/admin/projects/${projectId}/unpublish`, {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-projects"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["explore"] });
    },
  });
}

export function useAdminDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      apiFetch<{ ok: boolean }>(`/api/admin/projects/${projectId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-projects"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });
}
