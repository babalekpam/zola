// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/hooks/use-projects";
import type { Project } from "@/lib/types";

export interface PublicProject {
  id: string;
  name: string;
  description: string | null;
  updated_at: string;
  likes: number;
  liked: boolean;
}

export function useExplore(q: string) {
  return useQuery({
    queryKey: ["explore", q],
    queryFn: () =>
      apiFetch<{ projects: PublicProject[] }>(
        q ? `/api/explore?q=${encodeURIComponent(q)}` : "/api/explore",
      ).then((d) => d.projects),
  });
}

/** Like/unlike with optimistic toggle across all cached explore queries. */
export function useLikeProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, liked }: { projectId: string; liked: boolean }) =>
      apiFetch<{ ok: boolean }>(`/api/projects/${projectId}/like`, {
        method: liked ? "DELETE" : "POST",
        ...(liked ? {} : { body: JSON.stringify({}) }),
      }),
    onMutate: async ({ projectId, liked }) => {
      await qc.cancelQueries({ queryKey: ["explore"] });
      qc.setQueriesData<PublicProject[]>({ queryKey: ["explore"] }, (old) =>
        old?.map((p) =>
          p.id === projectId
            ? { ...p, liked: !liked, likes: p.likes + (liked ? -1 : 1) }
            : p,
        ),
      );
    },
    onError: () => {
      void qc.invalidateQueries({ queryKey: ["explore"] });
    },
  });
}

export function useForkProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      orgId,
    }: {
      projectId: string;
      orgId?: string | null;
    }) =>
      apiFetch<{ project: Project }>(`/api/projects/${projectId}/fork`, {
        method: "POST",
        body: JSON.stringify(orgId ? { org_id: orgId } : {}),
      }).then((d) => d.project),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}
