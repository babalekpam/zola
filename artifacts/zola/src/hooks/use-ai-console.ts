// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/hooks/use-projects";

export interface ConsoleModel {
  id: string;
  label: string;
  modelId: string;
}

export interface ConsoleProvider {
  id: string;
  label: string;
  envVar: string;
  configured: boolean;
  models: ConsoleModel[];
}

export interface RoutingCandidate {
  modelId: string;
  label: string;
  provider: string | null;
  available: boolean;
}

export interface RoutingRow {
  task: "design" | "code" | "plan" | "quick";
  label: string;
  candidates: RoutingCandidate[];
  resolved: string | null;
}

export interface AiConsole {
  providers: ConsoleProvider[];
  routing: RoutingRow[];
  quota: { allowed: boolean; used: number; limit: number; plan: string };
  defaultModelId: string;
  autoModelId: string;
  modelCount: number;
  providersConfigured: number;
}

export interface AiUsage {
  days: number;
  totalRequests: number;
  totalTokens: number;
  truncated: boolean;
  byDay: { day: string; requests: number; tokens: number }[];
  byModel: { modelId: string; requests: number; tokens: number }[];
  byProject: { projectId: string; requests: number; tokens: number }[];
  byKind: { kind: string; requests: number }[];
}

export function useAiConsole() {
  return useQuery({
    queryKey: ["ai-console"],
    queryFn: () => apiFetch<AiConsole>("/api/ai/console"),
  });
}

export function useAiUsage(days = 30) {
  return useQuery({
    queryKey: ["ai-usage", days],
    queryFn: () => apiFetch<AiUsage>(`/api/ai/usage?days=${days}`),
  });
}
