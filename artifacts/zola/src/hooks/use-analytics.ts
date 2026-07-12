// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/hooks/use-projects";

export interface ProjectAnalytics {
  today: number;
  total7: number;
  total30: number;
  daily: { day: string; count: number }[];
}

export function useAnalytics(projectId: string) {
  return useQuery({
    queryKey: ["analytics", projectId],
    queryFn: () =>
      apiFetch<ProjectAnalytics>(`/api/projects/${projectId}/analytics`),
    refetchInterval: 60_000,
  });
}
