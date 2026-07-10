// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/hooks/use-projects";
import type { Project } from "@/lib/types";

export interface PublicProject {
  id: string;
  name: string;
  description: string | null;
  updated_at: string;
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

export function useForkProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      apiFetch<{ project: Project }>(`/api/projects/${projectId}/fork`, {
        method: "POST",
        body: JSON.stringify({}),
      }).then((d) => d.project),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}
