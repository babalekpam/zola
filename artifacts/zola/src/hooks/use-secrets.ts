// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/hooks/use-projects";

export interface ProjectSecret {
  key: string;
  value: string;
}

export function useSecrets(projectId: string) {
  return useQuery({
    queryKey: ["secrets", projectId],
    queryFn: () =>
      apiFetch<{ secrets: ProjectSecret[] }>(
        `/api/projects/${projectId}/secrets`,
      ).then((d) => d.secrets),
  });
}

export function useUpsertSecret(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (secret: ProjectSecret) =>
      apiFetch<{ ok: boolean }>(`/api/projects/${projectId}/secrets`, {
        method: "PUT",
        body: JSON.stringify(secret),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["secrets", projectId] }),
  });
}

export function useDeleteSecret(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) =>
      apiFetch<{ ok: boolean }>(
        `/api/projects/${projectId}/secrets?key=${encodeURIComponent(key)}`,
        { method: "DELETE" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["secrets", projectId] }),
  });
}
