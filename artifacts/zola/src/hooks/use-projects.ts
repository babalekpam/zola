// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Project } from "@/lib/types";

const API = import.meta.env.VITE_API_URL ?? "";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export function useProjects(orgId?: string | null) {
  return useQuery({
    queryKey: ["projects", orgId ?? null],
    queryFn: () =>
      apiFetch<{ projects: Project[] }>(
        orgId ? `/api/projects?org=${encodeURIComponent(orgId)}` : "/api/projects",
      ).then((d) => d.projects),
    enabled: orgId !== undefined ? !!orgId : true,
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: () =>
      apiFetch<{ project: Project; files: { path: string; content: string }[] }>(
        `/api/projects/${id}`,
      ),
    enabled: !!id,
  });
}

export interface Sample {
  id: string;
  name: string;
  description: string;
}

export function useSamples() {
  return useQuery({
    queryKey: ["project-samples"],
    queryFn: () =>
      apiFetch<{ samples: Sample[] }>("/api/projects/samples").then(
        (d) => d.samples,
      ),
    staleTime: Infinity,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      org_id?: string;
      template?: string;
      attachments?: { path: string; content: string }[];
    }) =>
      apiFetch<{ project: Project }>("/api/projects", {
        method: "POST",
        body: JSON.stringify(data),
      }).then((d) => d.project),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useImportProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ repoUrl, orgId }: { repoUrl: string; orgId?: string }) =>
      apiFetch<{ project: Project; fileCount: number }>(
        "/api/projects/import",
        { method: "POST", body: JSON.stringify({ repoUrl, org_id: orgId }) },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      description?: string;
      default_model?: string;
      visibility?: "private" | "public";
    }) =>
      apiFetch<{ project: Project }>(`/api/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }).then((d) => d.project),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project", id] });
    },
  });
}

export function useSaveFiles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      files,
    }: { projectId: string; files: { path: string; content: string }[] }) =>
      apiFetch<{ ok: boolean }>(`/api/projects/${projectId}/files`, {
        method: "PUT",
        body: JSON.stringify({ files }),
      }),
    onSuccess: (_data, { projectId }) =>
      qc.invalidateQueries({ queryKey: ["project", projectId] }),
  });
}

export { apiFetch };
