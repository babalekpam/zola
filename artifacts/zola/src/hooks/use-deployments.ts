// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/hooks/use-projects";

export interface Deployment {
  id: string;
  slug: string;
  status: string;
  file_count: number;
  created_at: string;
}

const API = import.meta.env.VITE_API_URL ?? "";

export function siteUrl(slug: string): string {
  const base = API || window.location.origin;
  return `${base}/sites/${slug}/`;
}

export function useDeployments(projectId: string) {
  return useQuery({
    queryKey: ["deployments", projectId],
    queryFn: () =>
      apiFetch<{ deployments: Deployment[] }>(
        `/api/projects/${projectId}/deployments`,
      ).then((d) => d.deployments),
  });
}

export function useCreateDeployment(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (files: { path: string; content: string; encoding: string }[]) =>
      apiFetch<{ deployment: Deployment }>(
        `/api/projects/${projectId}/deployments`,
        { method: "POST", body: JSON.stringify({ files }) },
      ).then((d) => d.deployment),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["deployments", projectId] }),
  });
}
