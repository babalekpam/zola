// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/hooks/use-projects";

export interface Snapshot {
  id: string;
  label: string;
  kind: "manual" | "auto";
  created_at: string;
}

export function useSnapshots(projectId: string) {
  return useQuery({
    queryKey: ["snapshots", projectId],
    queryFn: () =>
      apiFetch<{ snapshots: Snapshot[] }>(
        `/api/projects/${projectId}/snapshots`,
      ).then((d) => d.snapshots),
  });
}

export function useCreateSnapshot(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      label: string;
      kind?: "manual" | "auto";
      files: Record<string, string>;
    }) =>
      apiFetch<{ snapshot: Snapshot }>(`/api/projects/${projectId}/snapshots`, {
        method: "POST",
        body: JSON.stringify(input),
      }).then((d) => d.snapshot),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["snapshots", projectId] }),
  });
}

export function useRestoreSnapshot(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (snapshotId: string) =>
      apiFetch<{ files: Record<string, string> }>(
        `/api/projects/${projectId}/snapshots/${snapshotId}/restore`,
        { method: "POST", body: JSON.stringify({}) },
      ).then((d) => d.files),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });
}

export function useDeleteSnapshot(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (snapshotId: string) =>
      apiFetch<{ ok: boolean }>(
        `/api/projects/${projectId}/snapshots/${snapshotId}`,
        { method: "DELETE" },
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["snapshots", projectId] }),
  });
}

/** Fire-and-forget auto-checkpoint used before AI edits are applied. */
export function createAutoSnapshot(
  projectId: string,
  label: string,
  files: Record<string, string>,
) {
  void apiFetch(`/api/projects/${projectId}/snapshots`, {
    method: "POST",
    body: JSON.stringify({ label, kind: "auto", files }),
  }).catch(() => {
    // Best-effort: an unsaved checkpoint must never block the AI edit itself.
  });
}
