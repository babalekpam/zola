// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/hooks/use-projects";

export interface PublishedSite {
  projectId: string;
  projectName: string;
  visibility: "private" | "public";
  slug: string;
  status: string;
  fileCount: number;
  deployedAt: string;
  deploymentCount: number;
  domains: string[];
  hits: number;
}

export interface SecurityProject {
  id: string;
  name: string;
  visibility: "private" | "public";
  updatedAt: string;
  secrets: number;
  mcpServers: number;
  members: number;
}

export interface SecurityOverview {
  projects: SecurityProject[];
  integrationCount: number;
  email: string | null;
  lastSignInAt: string | null;
  providers: string[];
}

export function usePublishedSites() {
  return useQuery({
    queryKey: ["published-sites"],
    queryFn: () => apiFetch<{ sites: PublishedSite[] }>("/api/published").then((d) => d.sites),
  });
}

export function useSecurityOverview() {
  return useQuery({
    queryKey: ["security-overview"],
    queryFn: () => apiFetch<SecurityOverview>("/api/security/overview"),
  });
}
