// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/hooks/use-projects";

export interface CustomDomain {
  id: string;
  domain: string;
  token: string;
  verified: boolean;
  created_at: string;
}

export function useDomains(projectId: string) {
  return useQuery({
    queryKey: ["domains", projectId],
    queryFn: () =>
      apiFetch<{ domains: CustomDomain[] }>(
        `/api/projects/${projectId}/domains`,
      ).then((d) => d.domains),
  });
}

export function useAddDomain(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (domain: string) =>
      apiFetch<{ domain: CustomDomain }>(`/api/projects/${projectId}/domains`, {
        method: "POST",
        body: JSON.stringify({ domain }),
      }).then((d) => d.domain),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["domains", projectId] }),
  });
}

export function useVerifyDomain(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (domainId: string) =>
      apiFetch<{ domain: CustomDomain }>(
        `/api/projects/${projectId}/domains/${domainId}/verify`,
        { method: "POST", body: JSON.stringify({}) },
      ).then((d) => d.domain),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["domains", projectId] }),
  });
}

export function useDeleteDomain(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (domainId: string) =>
      apiFetch<{ ok: boolean }>(
        `/api/projects/${projectId}/domains/${domainId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["domains", projectId] }),
  });
}
