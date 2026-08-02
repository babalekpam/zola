// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useMemo, useState } from "react";
import {
  Blocks,
  Check,
  ExternalLink,
  KeyRound,
  Plug,
  Search,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DashboardShell, PageHeader } from "@/components/dashboard/dashboard-shell";
import { RequireAuth } from "@/components/dashboard/require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CATEGORY_LABELS,
  useConnectIntegration,
  useConnectedIntegrations,
  useDisconnectIntegration,
  useIntegrationCatalog,
  type ConnectedIntegration,
  type IntegrationCategory,
  type IntegrationDescriptor,
} from "@/hooks/use-integrations";

function ConnectForm({
  descriptor,
  connection,
  onDone,
}: {
  descriptor: IntegrationDescriptor;
  connection?: ConnectedIntegration;
  onDone: () => void;
}) {
  const connect = useConnectIntegration();
  // Secret values are never sent to the browser, so the form starts blank for
  // them: typing replaces, leaving blank keeps whatever is already stored.
  const [values, setValues] = useState<Record<string, string>>(
    () => connection?.values ?? {},
  );

  function submit() {
    const payload: Record<string, string> = {};
    for (const field of descriptor.fields) {
      const value = values[field.key];
      if (value !== undefined) payload[field.key] = value.trim();
    }
    const missing = descriptor.fields.filter(
      (f) => f.required && !payload[f.key] && !connection?.filledFields.includes(f.key),
    );
    if (missing.length > 0) {
      toast.error(`${missing.map((f) => f.label).join(", ")} required`);
      return;
    }
    connect.mutate(
      { provider: descriptor.id, credentials: payload },
      {
        onSuccess: () => {
          toast.success(`${descriptor.name} connected`);
          onDone();
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-border bg-background p-3">
      {descriptor.fields.map((field) => {
        const stored = connection?.filledFields.includes(field.key);
        return (
          <div key={field.key}>
            <label className="flex items-center justify-between text-xs font-medium">
              <span>
                {field.label}
                {field.required && <span className="text-destructive"> *</span>}
              </span>
              {field.envVar && (
                <code className="rounded bg-muted px-1 text-[10px] font-normal text-muted-foreground">
                  {field.envVar}
                </code>
              )}
            </label>
            <Input
              className="mt-1 h-8 text-xs"
              type={field.secret ? "password" : "text"}
              value={values[field.key] ?? ""}
              placeholder={
                field.secret && stored
                  ? "•••••••• (leave blank to keep)"
                  : field.placeholder ?? ""
              }
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
              }
            />
            {field.help && (
              <p className="mt-1 text-[11px] text-muted-foreground">{field.help}</p>
            )}
          </div>
        );
      })}
      <div className="flex items-center justify-between">
        <a
          href={descriptor.credentialsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Get credentials <ExternalLink className="h-3 w-3" />
        </a>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={connect.isPending}>
            {connect.isPending ? "Saving…" : connection ? "Update" : "Connect"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function IntegrationCard({
  descriptor,
  connection,
}: {
  descriptor: IntegrationDescriptor;
  connection?: ConnectedIntegration;
}) {
  const [editing, setEditing] = useState(false);
  const disconnect = useDisconnectIntegration();

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4",
        connection ? "border-primary/40" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-medium">{descriptor.name}</h3>
            {connection && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                <Check className="h-3 w-3" /> Connected
              </span>
            )}
            {descriptor.hasMcp && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                title="Ships an MCP server — attach it to a project and Loop can call its tools"
              >
                <Wrench className="h-3 w-3" /> MCP
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            {descriptor.tagline}
          </p>
        </div>
        {!editing && (
          <Button
            size="sm"
            variant={connection ? "outline" : "default"}
            onClick={() => setEditing(true)}
          >
            {connection ? "Manage" : "Connect"}
          </Button>
        )}
      </div>

      {editing ? (
        <ConnectForm
          descriptor={descriptor}
          connection={connection}
          onDone={() => setEditing(false)}
        />
      ) : (
        connection && (
          <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <KeyRound className="h-3 w-3" />
              {connection.filledFields.length} credential
              {connection.filledFields.length === 1 ? "" : "s"} stored
            </span>
            <button
              type="button"
              onClick={() => {
                if (!window.confirm(`Disconnect ${descriptor.name}?`)) return;
                disconnect.mutate(descriptor.id, {
                  onSuccess: () => toast.success(`${descriptor.name} disconnected`),
                  onError: (err) => toast.error(err.message),
                });
              }}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" /> Disconnect
            </button>
          </div>
        )
      )}
    </div>
  );
}

function IntegrationsBody() {
  const { data: catalog, isLoading } = useIntegrationCatalog();
  const { data: connected } = useConnectedIntegrations();
  const [query, setQuery] = useState("");

  const connectionByProvider = useMemo(() => {
    const map = new Map<string, ConnectedIntegration>();
    for (const c of connected ?? []) map.set(c.provider, c);
    return map;
  }, [connected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = catalog ?? [];
    if (!q) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.tagline.toLowerCase().includes(q) ||
        i.category.includes(q),
    );
  }, [catalog, query]);

  const byCategory = useMemo(() => {
    const groups = new Map<IntegrationCategory, IntegrationDescriptor[]>();
    for (const item of filtered) {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    }
    return [...groups.entries()];
  }, [filtered]);

  const featured = filtered.filter((i) => i.featured);

  return (
    <div className="mx-auto max-w-5xl px-6 pb-16 pt-10">
      <PageHeader
        title="Integrations"
        description="Connect a service once on your account, then attach it to any project. Attaching writes the credentials into that project's Secrets and — where the service has one — registers its MCP server so Loop can use its tools while it builds."
      />

      <div className="relative mb-6 max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search integrations…"
          className="h-9 pl-8 text-sm"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nothing matches “{query}”.
        </div>
      ) : (
        <>
          {!query && featured.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" /> Start here
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {featured.map((descriptor) => (
                  <IntegrationCard
                    key={descriptor.id}
                    descriptor={descriptor}
                    connection={connectionByProvider.get(descriptor.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {byCategory.map(([category, items]) => (
            <section key={category} className="mb-8">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {CATEGORY_LABELS[category]}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((descriptor) => (
                  <IntegrationCard
                    key={descriptor.id}
                    descriptor={descriptor}
                    connection={connectionByProvider.get(descriptor.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      <div className="mt-10 flex items-start gap-3 rounded-xl border border-border bg-card p-4">
        <Plug className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Need something not listed?</span>{" "}
          Any service that speaks MCP can be added directly in a project's{" "}
          <Blocks className="inline h-3 w-3" /> MCP tab — paste the server URL and its
          auth header, and Loop picks up its tools on the next message.
        </div>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <RequireAuth>
      {() => (
        <DashboardShell active="Integrations">
          <IntegrationsBody />
        </DashboardShell>
      )}
    </RequireAuth>
  );
}
