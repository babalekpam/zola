// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT

/**
 * Catalog of remote MCP (Model Context Protocol) servers users can add to a
 * project in one click. Only remote transports are listed: the API server is
 * a stateless container, so stdio servers (which spawn a local process) have
 * nowhere to run.
 *
 * The URLs are the vendors' documented public endpoints and are pre-filled as
 * defaults — every field stays editable in the MCP tab, so a vendor moving an
 * endpoint is a one-field fix for the user rather than a redeploy.
 */

export type McpTransport = "http" | "sse";

/** How the server expects the user's credential to be sent. */
export type McpAuthMode =
  | "none"
  | "bearer" // Authorization: Bearer <token>
  | "header"; // <authHeader>: <token>

export interface McpCatalogEntry {
  id: string;
  name: string;
  /** One line, shown under the name in the picker. */
  description: string;
  category: "universal" | "data" | "devtools" | "product" | "docs";
  transport: McpTransport;
  url: string;
  auth: McpAuthMode;
  /** Header name when `auth` is "header". */
  authHeader?: string;
  /** What to tell the user to paste, e.g. "Composio API key". */
  credentialLabel?: string;
  /** Where the user gets that credential. */
  docsUrl: string;
  /** Integration provider this server belongs to, when there is one. */
  integration?: string;
}

export const MCP_CATALOG: McpCatalogEntry[] = [
  {
    id: "rube",
    name: "Rube (Composio)",
    description:
      "One connection, 500+ app tools — Gmail, Slack, Notion, Linear, Jira, Sheets and more.",
    category: "universal",
    transport: "http",
    url: "https://rube.app/mcp",
    auth: "bearer",
    credentialLabel: "Composio API key",
    docsUrl: "https://rube.app",
    integration: "rube",
  },
  {
    id: "context7",
    name: "Context7",
    description: "Up-to-date documentation and code examples for any library, on demand.",
    category: "docs",
    transport: "http",
    url: "https://mcp.context7.com/mcp",
    auth: "header",
    authHeader: "CONTEXT7_API_KEY",
    credentialLabel: "Context7 API key (optional)",
    docsUrl: "https://context7.com",
    integration: "context7",
  },
  {
    id: "deepwiki",
    name: "DeepWiki",
    description: "Ask questions about any public GitHub repository's architecture.",
    category: "docs",
    transport: "http",
    url: "https://mcp.deepwiki.com/mcp",
    auth: "none",
    docsUrl: "https://deepwiki.com",
  },
  {
    id: "github",
    name: "GitHub",
    description: "Issues, pull requests, code search and Actions on your repositories.",
    category: "devtools",
    transport: "http",
    url: "https://api.githubcopilot.com/mcp/",
    auth: "bearer",
    credentialLabel: "GitHub personal access token",
    docsUrl: "https://github.com/settings/tokens",
    integration: "github",
  },
  {
    id: "supabase",
    name: "Supabase",
    description: "Query tables, run migrations and read logs on your Supabase projects.",
    category: "data",
    transport: "http",
    url: "https://mcp.supabase.com/mcp",
    auth: "bearer",
    credentialLabel: "Supabase personal access token",
    docsUrl: "https://supabase.com/dashboard/account/tokens",
    integration: "supabase",
  },
  {
    id: "neon",
    name: "Neon",
    description: "Serverless Postgres: branches, SQL and schema changes.",
    category: "data",
    transport: "http",
    url: "https://mcp.neon.tech/mcp",
    auth: "bearer",
    credentialLabel: "Neon API key",
    docsUrl: "https://console.neon.tech/app/settings/api-keys",
    integration: "neon",
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Customers, products, prices, subscriptions and payment links.",
    category: "product",
    transport: "http",
    url: "https://mcp.stripe.com",
    auth: "bearer",
    credentialLabel: "Stripe secret key",
    docsUrl: "https://dashboard.stripe.com/apikeys",
    integration: "stripe",
  },
  {
    id: "vercel",
    name: "Vercel",
    description: "Deployments, projects, build logs and runtime errors.",
    category: "devtools",
    transport: "http",
    url: "https://mcp.vercel.com",
    auth: "bearer",
    credentialLabel: "Vercel access token",
    docsUrl: "https://vercel.com/account/tokens",
    integration: "vercel",
  },
  {
    id: "sentry",
    name: "Sentry",
    description: "Errors, issues and release health for your applications.",
    category: "devtools",
    transport: "http",
    url: "https://mcp.sentry.dev/mcp",
    auth: "bearer",
    credentialLabel: "Sentry auth token",
    docsUrl: "https://sentry.io/settings/account/api/auth-tokens/",
    integration: "sentry",
  },
  {
    id: "linear",
    name: "Linear",
    description: "Issues, projects and cycles — plan work without leaving the chat.",
    category: "product",
    transport: "http",
    url: "https://mcp.linear.app/mcp",
    auth: "bearer",
    credentialLabel: "Linear API key",
    docsUrl: "https://linear.app/settings/api",
    integration: "linear",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Read and write pages, databases and comments in your workspace.",
    category: "product",
    transport: "http",
    url: "https://mcp.notion.com/mcp",
    auth: "bearer",
    credentialLabel: "Notion integration token",
    docsUrl: "https://www.notion.so/my-integrations",
    integration: "notion",
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    description: "Search models, datasets and Spaces; run inference endpoints.",
    category: "data",
    transport: "http",
    url: "https://huggingface.co/mcp",
    auth: "bearer",
    credentialLabel: "Hugging Face access token",
    docsUrl: "https://huggingface.co/settings/tokens",
    integration: "huggingface",
  },
];

export function getMcpCatalogEntry(id: string): McpCatalogEntry | undefined {
  return MCP_CATALOG.find((e) => e.id === id);
}

/** Build the request headers for a catalog entry given the user's credential. */
export function buildMcpHeaders(
  entry: McpCatalogEntry,
  credential: string | undefined,
): Record<string, string> {
  if (!credential) return {};
  if (entry.auth === "bearer") return { Authorization: `Bearer ${credential}` };
  if (entry.auth === "header" && entry.authHeader) {
    return { [entry.authHeader]: credential };
  }
  return {};
}
