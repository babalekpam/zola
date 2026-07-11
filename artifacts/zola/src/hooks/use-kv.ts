// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/hooks/use-projects";

export interface KvEntry {
  key: string;
  value: string;
  updated_at: string;
}

export function useKvEntries(projectId: string) {
  return useQuery({
    queryKey: ["kv", projectId],
    queryFn: () =>
      apiFetch<{ entries: KvEntry[] }>(`/api/projects/${projectId}/kv`).then(
        (d) => d.entries,
      ),
  });
}

export function useUpsertKv(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entry: { key: string; value: string }) =>
      apiFetch<{ ok: boolean }>(`/api/projects/${projectId}/kv`, {
        method: "PUT",
        body: JSON.stringify(entry),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kv", projectId] }),
  });
}

export function useDeleteKv(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) =>
      apiFetch<{ ok: boolean }>(
        `/api/projects/${projectId}/kv?key=${encodeURIComponent(key)}`,
        { method: "DELETE" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kv", projectId] }),
  });
}
