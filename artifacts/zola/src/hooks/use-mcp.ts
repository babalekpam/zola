// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/hooks/use-projects";

export interface McpCatalogEntry {
  id: string;
  name: string;
  description: string;
  category: "universal" | "data" | "devtools" | "product" | "docs";
  transport: "http" | "sse";
  url: string;
  auth: "none" | "bearer" | "header";
  authHeader?: string;
  credentialLabel?: string;
  docsUrl: string;
  integration?: string;
}

export interface McpServer {
  id: string;
  name: string;
  catalog_id: string | null;
  transport: "http" | "sse";
  url: string;
  /** Values are masked server-side; only the names are meaningful. */
  headers: Record<string, string>;
  headerNames: string[];
  enabled: boolean;
  tool_count: number;
  last_error: string | null;
  last_checked_at: string | null;
}

export interface McpToolInfo {
  name: string;
  description: string;
}

export interface McpServerInput {
  name: string;
  catalogId?: string | null;
  transport: "http" | "sse";
  url: string;
  headers?: Record<string, string>;
  enabled?: boolean;
}

export function useMcpCatalog() {
  return useQuery({
    queryKey: ["mcp-catalog"],
    queryFn: () =>
      apiFetch<{ servers: McpCatalogEntry[] }>("/api/mcp/catalog").then((d) => d.servers),
    staleTime: Infinity,
  });
}

export function useMcpServers(projectId: string) {
  return useQuery({
    queryKey: ["mcp-servers", projectId],
    queryFn: () =>
      apiFetch<{ servers: McpServer[] }>(`/api/projects/${projectId}/mcp`).then(
        (d) => d.servers,
      ),
    enabled: !!projectId,
  });
}

export function useCreateMcpServer(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: McpServerInput) =>
      apiFetch<{ server: McpServer }>(`/api/projects/${projectId}/mcp`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mcp-servers", projectId] }),
  });
}

export function useUpdateMcpServer(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<McpServerInput> & { id: string }) =>
      apiFetch<{ server: McpServer }>(`/api/projects/${projectId}/mcp/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mcp-servers", projectId] }),
  });
}

export function useDeleteMcpServer(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/projects/${projectId}/mcp/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mcp-servers", projectId] }),
  });
}

/** Dial the server with its stored credentials and list the tools it exposes. */
export function useTestMcpServer(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean; tools: McpToolInfo[] }>(
        `/api/projects/${projectId}/mcp/${id}/test`,
        { method: "POST" },
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: ["mcp-servers", projectId] }),
  });
}
