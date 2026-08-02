// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Activity,
  AlertTriangle,
  Check,
  Cpu,
  Gauge,
  Route,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardShell, PageHeader } from "@/components/dashboard/dashboard-shell";
import { RequireAuth } from "@/components/dashboard/require-auth";
import { useAiConsole, useAiUsage } from "@/hooks/use-ai-console";

type Tab = "overview" | "models" | "routing" | "usage";

const TABS: { id: Tab; label: string; icon: typeof Cpu }[] = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "models", label: "Models", icon: Cpu },
  { id: "routing", label: "Routing", icon: Route },
  { id: "usage", label: "Usage", icon: Activity },
];

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

/**
 * Requests per day, drawn as bars scaled to the busiest day. Deliberately a
 * handful of divs rather than a chart library — the shape is the whole message
 * and this page already loads on a cold cache.
 */
function UsageBars({ data }: { data: { day: string; requests: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.requests));
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No AI requests in this window yet.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex h-40 items-end gap-1">
        {data.map((d) => (
          <div
            key={d.day}
            className="group relative flex-1 rounded-t bg-primary/70 hover:bg-primary"
            style={{ height: `${Math.max(2, (d.requests / max) * 100)}%` }}
            title={`${d.day}: ${d.requests} request${d.requests === 1 ? "" : "s"}`}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>{data[0]?.day}</span>
        <span>{data[data.length - 1]?.day}</span>
      </div>
    </div>
  );
}

function AiConsoleBody({ initialTab }: { initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [days, setDays] = useState(30);
  const { data: console_, isLoading } = useAiConsole();
  const { data: usage } = useAiUsage(days);

  const modelLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const provider of console_?.providers ?? []) {
      for (const model of provider.models) map.set(model.id, model.label);
    }
    return map;
  }, [console_]);

  const quotaPct = console_?.quota.limit
    ? Math.min(100, Math.round((console_.quota.used / console_.quota.limit) * 100))
    : 0;

  return (
    <div className="mx-auto max-w-5xl px-6 pb-16 pt-10">
      <PageHeader
        title="AI Console"
        description="Which models this workspace can run, how Auto picks between them, and what you've spent. Zola runs AI on platform keys, so a model is available when the platform has that provider configured."
      />

      <div className="mb-6 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm",
              tab === t.id
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {isLoading || !console_ ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : (
        <>
          {tab === "overview" && (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat
                  label="Providers configured"
                  value={`${console_.providersConfigured}/${console_.providers.length}`}
                  hint="Providers with a working platform key"
                />
                <Stat
                  label="Models available"
                  value={String(
                    console_.providers
                      .filter((p) => p.configured)
                      .reduce((n, p) => n + p.models.length, 0),
                  )}
                  hint={`${console_.modelCount} in the catalog`}
                />
                <Stat
                  label="This month"
                  value={`${console_.quota.used.toLocaleString()} / ${console_.quota.limit.toLocaleString()}`}
                  hint={`${console_.quota.plan} plan`}
                />
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium">Monthly AI budget</span>
                  <span className="text-muted-foreground tabular-nums">{quotaPct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      quotaPct > 90 ? "bg-destructive" : "bg-primary",
                    )}
                    style={{ width: `${quotaPct}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Requests reset on the 1st.{" "}
                  <Link href="/billing" className="underline hover:text-foreground">
                    Change plan
                  </Link>
                  .
                </p>
              </div>

              {console_.providersConfigured === 0 && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-xs">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div>
                    <span className="font-medium">No AI provider is configured.</span> Chat
                    will fail until at least one provider key is set on the deployment
                    (ANTHROPIC_API_KEY recommended).
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-border bg-card p-4">
                <h2 className="mb-1 flex items-center gap-1.5 text-sm font-medium">
                  <Zap className="h-4 w-4 text-primary" /> Auto routing
                </h2>
                <p className="text-xs text-muted-foreground">
                  Picking <code className="rounded bg-muted px-1">Auto</code> in chat
                  classifies each message — design, code, planning or a quick fix — and
                  sends it to the best model that's actually available. The Routing tab
                  shows the full table.
                </p>
              </div>
            </div>
          )}

          {tab === "models" && (
            <div className="space-y-4">
              {console_.providers.map((provider) => (
                <div key={provider.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium">{provider.label}</h3>
                      {provider.configured ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          <Check className="h-3 w-3" /> Available
                        </span>
                      ) : (
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                          Key not set
                        </span>
                      )}
                    </div>
                    <code className="text-[10px] text-muted-foreground">{provider.envVar}</code>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {provider.models.map((model) => (
                      <span
                        key={model.id}
                        title={model.modelId}
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-[11px]",
                          provider.configured
                            ? "border-border text-foreground"
                            : "border-dashed border-border text-muted-foreground",
                        )}
                      >
                        {model.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "routing" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Candidates in priority order. Auto walks the list and uses the first model
                whose provider is configured — so routing degrades gracefully instead of
                erroring when a key is missing.
              </p>
              {console_.routing.map((row) => (
                <div key={row.task} className="rounded-xl border border-border bg-card p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-medium">{row.label}</h3>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {row.task}
                    </code>
                  </div>
                  <ol className="space-y-1">
                    {row.candidates.map((candidate, i) => {
                      const isResolved = candidate.modelId === row.resolved;
                      return (
                        <li
                          key={candidate.modelId}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2 py-1 text-xs",
                            isResolved && "bg-primary/10",
                          )}
                        >
                          <span className="w-4 text-[10px] text-muted-foreground">{i + 1}</span>
                          <span
                            className={cn(
                              "flex-1",
                              candidate.available ? "text-foreground" : "text-muted-foreground line-through",
                            )}
                          >
                            {candidate.label}
                          </span>
                          {isResolved && (
                            <span className="text-[10px] font-medium text-primary">in use</span>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                  {!row.resolved && (
                    <p className="mt-2 text-[11px] text-destructive">
                      No candidate available — this task falls back to the first configured
                      provider.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === "usage" && (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                {[7, 30, 90].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDays(d)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs",
                      days === d
                        ? "border-primary bg-primary/10 font-medium text-foreground"
                        : "border-border text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {d} days
                  </button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Requests" value={(usage?.totalRequests ?? 0).toLocaleString()} />
                <Stat label="Tokens" value={(usage?.totalTokens ?? 0).toLocaleString()} />
                <Stat
                  label="Models used"
                  value={String(usage?.byModel.length ?? 0)}
                  hint={usage?.truncated ? "Capped at 5,000 recent requests" : undefined}
                />
              </div>

              <UsageBars data={usage?.byDay ?? []} />

              {usage && usage.byModel.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="mb-2 text-sm font-medium">By model</h3>
                  <ul className="space-y-1.5">
                    {usage.byModel.slice(0, 12).map((row) => {
                      const share = usage.totalRequests
                        ? (row.requests / usage.totalRequests) * 100
                        : 0;
                      return (
                        <li key={row.modelId} className="text-xs">
                          <div className="mb-0.5 flex justify-between">
                            <span>{modelLabels.get(row.modelId) ?? row.modelId}</span>
                            <span className="tabular-nums text-muted-foreground">
                              {row.requests.toLocaleString()}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary/70"
                              style={{ width: `${Math.max(1, share)}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function AiConsolePage() {
  // The sidebar's "Usage" entry deep-links into this page's usage tab.
  const initialTab: Tab =
    new URLSearchParams(window.location.search).get("tab") === "usage"
      ? "usage"
      : "overview";
  return (
    <RequireAuth>
      {() => (
        <DashboardShell active="AI Console">
          <AiConsoleBody initialTab={initialTab} />
        </DashboardShell>
      )}
    </RequireAuth>
  );
}
