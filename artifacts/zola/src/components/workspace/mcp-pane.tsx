// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Plug,
  Plus,
  RefreshCw,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useCreateMcpServer,
  useDeleteMcpServer,
  useMcpCatalog,
  useMcpServers,
  useTestMcpServer,
  useUpdateMcpServer,
  type McpCatalogEntry,
  type McpServer,
  type McpToolInfo,
} from "@/hooks/use-mcp";

interface Props {
  projectId: string;
}

function AddFromCatalog({
  entry,
  projectId,
  onDone,
}: {
  entry: McpCatalogEntry;
  projectId: string;
  onDone: () => void;
}) {
  const create = useCreateMcpServer(projectId);
  const [credential, setCredential] = useState("");

  function add() {
    if (entry.auth !== "none" && !credential.trim()) {
      toast.error(`${entry.credentialLabel ?? "Credential"} required`);
      return;
    }
    const headers: Record<string, string> = {};
    if (credential.trim()) {
      if (entry.auth === "bearer") headers.Authorization = `Bearer ${credential.trim()}`;
      else if (entry.auth === "header" && entry.authHeader) {
        headers[entry.authHeader] = credential.trim();
      }
    }
    create.mutate(
      {
        name: entry.name,
        catalogId: entry.id,
        transport: entry.transport,
        url: entry.url,
        headers,
      },
      {
        onSuccess: () => {
          toast.success(`${entry.name} added`);
          onDone();
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-md border border-border bg-background p-2">
      {entry.auth !== "none" && (
        <Input
          type="password"
          value={credential}
          onChange={(e) => setCredential(e.target.value)}
          placeholder={entry.credentialLabel ?? "API key"}
          className="h-7 text-xs"
          autoFocus
        />
      )}
      <div className="flex items-center justify-between">
        <a
          href={entry.docsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Docs <ExternalLink className="h-3 w-3" />
        </a>
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onDone}>
            Cancel
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={add} disabled={create.isPending}>
            {create.isPending ? "Adding…" : "Add"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CustomServerForm({
  projectId,
  onDone,
}: {
  projectId: string;
  onDone: () => void;
}) {
  const create = useCreateMcpServer(projectId);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [transport, setTransport] = useState<"http" | "sse">("http");
  const [headerName, setHeaderName] = useState("Authorization");
  const [headerValue, setHeaderValue] = useState("");

  function add() {
    if (!name.trim() || !url.trim()) {
      toast.error("Name and URL are required");
      return;
    }
    const headers: Record<string, string> = {};
    if (headerName.trim() && headerValue.trim()) {
      headers[headerName.trim()] = headerValue.trim();
    }
    create.mutate(
      { name: name.trim(), transport, url: url.trim(), headers },
      {
        onSuccess: () => {
          toast.success(`${name.trim()} added`);
          onDone();
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <div className="mb-3 space-y-2 rounded-lg border border-border bg-card p-3">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name — e.g. My internal tools"
        className="h-8 text-xs"
        autoFocus
      />
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://example.com/mcp"
        className="h-8 text-xs"
      />
      <div className="flex gap-2">
        <select
          value={transport}
          onChange={(e) => setTransport(e.target.value as "http" | "sse")}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
        >
          <option value="http">Streamable HTTP</option>
          <option value="sse">SSE</option>
        </select>
        <Input
          value={headerName}
          onChange={(e) => setHeaderName(e.target.value)}
          placeholder="Header name"
          className="h-8 w-36 text-xs"
        />
        <Input
          type="password"
          value={headerValue}
          onChange={(e) => setHeaderValue(e.target.value)}
          placeholder="Header value (e.g. Bearer …)"
          className="h-8 flex-1 text-xs"
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Must be an https URL on a public host. Header values are stored server-side and
        never shown again.
      </p>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" onClick={add} disabled={create.isPending}>
          {create.isPending ? "Adding…" : "Add server"}
        </Button>
      </div>
    </div>
  );
}

function ServerRow({ server, projectId }: { server: McpServer; projectId: string }) {
  const update = useUpdateMcpServer(projectId);
  const remove = useDeleteMcpServer(projectId);
  const test = useTestMcpServer(projectId);
  const [tools, setTools] = useState<McpToolInfo[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  function runTest() {
    test.mutate(server.id, {
      onSuccess: (data) => {
        setTools(data.tools);
        setExpanded(true);
        toast.success(
          `${server.name}: ${data.tools.length} tool${data.tools.length === 1 ? "" : "s"}`,
        );
      },
      onError: (err) => {
        setTools(null);
        toast.error(`${server.name}: ${err.message}`);
      },
    });
  }

  return (
    <li className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-start gap-1.5 text-left"
        >
          {expanded ? (
            <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate text-xs font-medium">{server.name}</span>
              {server.tool_count > 0 && (
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                  {server.tool_count} tools
                </span>
              )}
              {server.last_error && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-destructive">
                  <AlertCircle className="h-3 w-3" /> error
                </span>
              )}
            </span>
            <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
              {server.transport.toUpperCase()} · {server.url}
            </span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() =>
              update.mutate(
                { id: server.id, enabled: !server.enabled },
                { onError: (err) => toast.error(err.message) },
              )
            }
            title={server.enabled ? "Disable for this project" : "Enable"}
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              server.enabled
                ? "bg-primary/10 text-primary"
                : "border border-border text-muted-foreground",
            )}
          >
            {server.enabled ? "Enabled" : "Disabled"}
          </button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            title="Test connection"
            onClick={runTest}
            disabled={test.isPending}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", test.isPending && "animate-spin")} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            title="Remove"
            onClick={() => {
              if (!window.confirm(`Remove ${server.name}?`)) return;
              remove.mutate(server.id, {
                onSuccess: () => toast.success(`${server.name} removed`),
                onError: (err) => toast.error(err.message),
              });
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-2 border-t border-border pt-2">
          {server.last_error && (
            <p className="mb-2 text-[11px] text-destructive">{server.last_error}</p>
          )}
          {server.headerNames.length > 0 && (
            <p className="mb-2 text-[11px] text-muted-foreground">
              Auth headers: {server.headerNames.join(", ")} (values hidden)
            </p>
          )}
          {tools === null ? (
            <p className="text-[11px] text-muted-foreground">
              Run a connection test to list this server's tools.
            </p>
          ) : tools.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Connected, but this server advertises no tools.
            </p>
          ) : (
            <ul className="space-y-1">
              {tools.map((tool) => (
                <li key={tool.name} className="text-[11px]">
                  <span className="font-mono text-foreground">{tool.name}</span>
                  {tool.description && (
                    <span className="text-muted-foreground"> — {tool.description}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * MCP tab: the tool servers this project's agent can call. Everything enabled
 * here is dialled at the start of each chat message, so the list doubles as the
 * answer to "what can Loop actually reach right now?".
 */
export function McpPane({ projectId }: Props) {
  const { data: servers, isLoading } = useMcpServers(projectId);
  const { data: catalog } = useMcpCatalog();
  const [picking, setPicking] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);

  const installed = new Set((servers ?? []).map((s) => s.catalog_id).filter(Boolean));

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-2xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Plug className="h-4 w-4" /> MCP servers
          </h2>
          {!customOpen && (
            <Button size="sm" variant="outline" onClick={() => setCustomOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add custom
            </Button>
          )}
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Servers that give Loop tools beyond this project's files. Enabled servers are
          connected on every message, and their tools are offered to the model for that
          turn.
        </p>

        {customOpen && (
          <CustomServerForm projectId={projectId} onDone={() => setCustomOpen(false)} />
        )}

        {isLoading ? (
          <div className="h-16 animate-pulse rounded-lg border border-border bg-card" />
        ) : servers && servers.length > 0 ? (
          <ul className="mb-6 space-y-2">
            {servers.map((server) => (
              <ServerRow key={server.id} server={server} projectId={projectId} />
            ))}
          </ul>
        ) : (
          <div className="mb-6 rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            No MCP servers yet. Add one below and Loop can start calling its tools.
          </div>
        )}

        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Wrench className="h-3.5 w-3.5" /> Catalog
        </h3>
        <ul className="space-y-2">
          {(catalog ?? []).map((entry) => {
            const added = installed.has(entry.id);
            return (
              <li key={entry.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-medium">{entry.name}</span>
                      {added && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-primary">
                          <Check className="h-3 w-3" /> added
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                      {entry.description}
                    </p>
                  </div>
                  {!added && picking !== entry.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 shrink-0 text-xs"
                      onClick={() => setPicking(entry.id)}
                    >
                      Add
                    </Button>
                  )}
                </div>
                {picking === entry.id && (
                  <AddFromCatalog
                    entry={entry}
                    projectId={projectId}
                    onDone={() => setPicking(null)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
