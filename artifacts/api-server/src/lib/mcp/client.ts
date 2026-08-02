// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { experimental_createMCPClient, type Tool } from "ai";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * MCP runtime. The AI SDK ships an SSE transport inline but not Streamable
 * HTTP (the transport nearly every hosted MCP server speaks today), so HTTP
 * servers get the official SDK transport — it satisfies the SDK's `MCPTransport`
 * interface, which is exactly the MCP spec's `Transport`.
 *
 * Everything here is deliberately bounded: a chat request must not hang because
 * a third-party server is slow, and a server advertising 400 tools must not
 * blow the model's context. Failures degrade to "no tools from that server"
 * rather than failing the chat.
 */

export interface McpServerRow {
  id: string;
  name: string;
  transport: "http" | "sse";
  url: string;
  headers: Record<string, string>;
}

export interface McpToolInfo {
  name: string;
  description: string;
}

/** A connected server: its tools plus the handle needed to close it. */
export interface McpConnection {
  server: McpServerRow;
  tools: Record<string, Tool>;
  close: () => Promise<void>;
}

const CONNECT_TIMEOUT_MS = 8_000;
/** Per-server cap, so one sprawling server can't crowd out the others. */
const MAX_TOOLS_PER_SERVER = 40;
/** Total cap across all servers on a single chat turn. */
export const MAX_TOOLS_TOTAL = 80;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Tool names reach the providers as function names, which must match
 * ^[a-zA-Z0-9_-]{1,64}$. Prefixing with the server slug also keeps two servers
 * that both expose `search` from colliding.
 */
export function qualifiedToolName(serverName: string, toolName: string): string {
  const slug = serverName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
  const safeTool = toolName.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${slug || "mcp"}__${safeTool}`.slice(0, 64);
}

async function openClient(server: McpServerRow) {
  if (server.transport === "sse") {
    return experimental_createMCPClient({
      name: "zola-loop",
      transport: { type: "sse", url: server.url, headers: server.headers },
    });
  }
  return experimental_createMCPClient({
    name: "zola-loop",
    transport: new StreamableHTTPClientTransport(new URL(server.url), {
      requestInit: { headers: server.headers },
    }),
  });
}

/**
 * Connect to one server and list its tools without keeping the connection —
 * what the "Test connection" button and the tool counter in the MCP tab use.
 */
export async function probeMcpServer(
  server: McpServerRow,
): Promise<{ ok: true; tools: McpToolInfo[] } | { ok: false; error: string }> {
  let client: Awaited<ReturnType<typeof openClient>> | null = null;
  try {
    client = await withTimeout(openClient(server), CONNECT_TIMEOUT_MS, "MCP connect");
    const tools = await withTimeout(client.tools(), CONNECT_TIMEOUT_MS, "MCP tools/list");
    return {
      ok: true,
      tools: Object.entries(tools).map(([name, tool]) => ({
        name,
        description: (tool as { description?: string }).description ?? "",
      })),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Connection failed" };
  } finally {
    await client?.close().catch(() => {});
  }
}

/**
 * Connect to every server for a chat turn. Servers are dialled in parallel and
 * each one's failure is contained: the chat proceeds with whatever connected.
 * The caller MUST call `closeConnections` when the stream finishes.
 */
export async function connectMcpServers(
  servers: McpServerRow[],
): Promise<{ connections: McpConnection[]; tools: Record<string, Tool>; failures: string[] }> {
  const settled = await Promise.allSettled(
    servers.map(async (server): Promise<McpConnection> => {
      const client = await withTimeout(openClient(server), CONNECT_TIMEOUT_MS, "MCP connect");
      try {
        const raw = await withTimeout(client.tools(), CONNECT_TIMEOUT_MS, "MCP tools/list");
        const tools: Record<string, Tool> = {};
        for (const [name, tool] of Object.entries(raw).slice(0, MAX_TOOLS_PER_SERVER)) {
          tools[qualifiedToolName(server.name, name)] = tool as Tool;
        }
        return { server, tools, close: () => client.close() };
      } catch (err) {
        await client.close().catch(() => {});
        throw err;
      }
    }),
  );

  const connections: McpConnection[] = [];
  const failures: string[] = [];
  const tools: Record<string, Tool> = {};

  settled.forEach((result, i) => {
    if (result.status === "rejected") {
      const reason =
        result.reason instanceof Error ? result.reason.message : "Connection failed";
      failures.push(`${servers[i].name}: ${reason}`);
      return;
    }
    connections.push(result.value);
    for (const [name, tool] of Object.entries(result.value.tools)) {
      if (Object.keys(tools).length >= MAX_TOOLS_TOTAL) break;
      tools[name] = tool;
    }
  });

  return { connections, tools, failures };
}

export async function closeConnections(connections: McpConnection[]): Promise<void> {
  await Promise.allSettled(connections.map((c) => c.close()));
}

/**
 * The prompt section that tells the agent which external tools it now has.
 * Without it the model treats tool use as a last resort; naming the servers
 * makes it reach for them when the request is actually about that service.
 */
export function buildMcpSection(connections: McpConnection[]): string {
  if (connections.length === 0) return "";
  const lines = connections
    .filter((c) => Object.keys(c.tools).length > 0)
    .map((c) => {
      const names = Object.keys(c.tools).join(", ");
      return `- ${c.server.name}: ${names}`;
    });
  if (lines.length === 0) return "";
  return (
    `\n\nConnected MCP servers — you can call these tools directly to read or change ` +
    `real data in the user's connected services. Call a tool when the request needs ` +
    `live data or an action outside this project's files; otherwise just answer or ` +
    `edit files as usual. Never invent tool results, and never call a destructive ` +
    `tool without the user having asked for that specific action.\n${lines.join("\n")}`
  );
}
