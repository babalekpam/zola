// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/hooks/use-projects";

export type IntegrationCategory =
  | "agent"
  | "database"
  | "payments"
  | "auth"
  | "messaging"
  | "ai"
  | "devtools"
  | "analytics"
  | "media";

export interface IntegrationField {
  key: string;
  label: string;
  placeholder?: string;
  envVar?: string;
  required?: boolean;
  secret?: boolean;
  help?: string;
}

export interface IntegrationDescriptor {
  id: string;
  name: string;
  tagline: string;
  category: IntegrationCategory;
  docsUrl: string;
  credentialsUrl: string;
  featured: boolean;
  hasMcp: boolean;
  fields: IntegrationField[];
}

export interface ConnectedIntegration {
  provider: string;
  label: string;
  status: string;
  /** Which fields hold a value — secret values themselves never leave the server. */
  filledFields: string[];
  /** Values of the non-secret fields, so the form can round-trip them. */
  values: Record<string, string>;
  connectedAt: string;
  updatedAt: string;
}

export interface AttachedIntegration {
  provider: string;
  secret_keys: string[];
  mcp_server_id: string | null;
  created_at: string;
}

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  agent: "Agent tools",
  database: "Databases",
  payments: "Payments",
  auth: "Authentication",
  messaging: "Email & messaging",
  ai: "AI & models",
  devtools: "Developer tools",
  analytics: "Analytics & search",
  media: "Media & maps",
};

export function useIntegrationCatalog() {
  return useQuery({
    queryKey: ["integration-catalog"],
    queryFn: () =>
      apiFetch<{ integrations: IntegrationDescriptor[] }>(
        "/api/integrations/catalog",
      ).then((d) => d.integrations),
    staleTime: Infinity,
  });
}

export function useConnectedIntegrations() {
  return useQuery({
    queryKey: ["integrations"],
    queryFn: () =>
      apiFetch<{ integrations: ConnectedIntegration[] }>("/api/integrations").then(
        (d) => d.integrations,
      ),
  });
}

export function useConnectIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      provider,
      credentials,
    }: {
      provider: string;
      credentials: Record<string, string>;
    }) =>
      apiFetch<{ integration: ConnectedIntegration }>(
        `/api/integrations/${provider}`,
        { method: "PUT", body: JSON.stringify({ credentials }) },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }),
  });
}

export function useDisconnectIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) =>
      apiFetch<{ ok: boolean }>(`/api/integrations/${provider}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }),
  });
}

export function useProjectIntegrations(projectId: string) {
  return useQuery({
    queryKey: ["project-integrations", projectId],
    queryFn: () =>
      apiFetch<{ attached: AttachedIntegration[] }>(
        `/api/projects/${projectId}/integrations`,
      ).then((d) => d.attached),
    enabled: !!projectId,
  });
}

export function useAttachIntegration(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) =>
      apiFetch<{ ok: boolean; secretKeys: string[]; mcpServerId: string | null }>(
        `/api/projects/${projectId}/integrations/${provider}`,
        { method: "POST" },
      ),
    onSuccess: () => {
      // Attaching writes secrets and may create an MCP server; both panes show it.
      qc.invalidateQueries({ queryKey: ["project-integrations", projectId] });
      qc.invalidateQueries({ queryKey: ["mcp-servers", projectId] });
      qc.invalidateQueries({ queryKey: ["secrets", projectId] });
    },
  });
}

export function useDetachIntegration(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) =>
      apiFetch<{ ok: boolean }>(
        `/api/projects/${projectId}/integrations/${provider}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-integrations", projectId] });
      qc.invalidateQueries({ queryKey: ["mcp-servers", projectId] });
    },
  });
}
