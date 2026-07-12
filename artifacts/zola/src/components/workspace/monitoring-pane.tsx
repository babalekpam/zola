// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Activity } from "lucide-react";
import { useAnalytics } from "@/hooks/use-analytics";
import { useDeployments } from "@/hooks/use-deployments";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="text-lg font-semibold tabular-nums">{value.toLocaleString()}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

/**
 * Replit-style Monitoring: real page-view counts for the project's deployed
 * site, recorded server-side as pages are served (platform URL and custom
 * domains alike).
 */
export function MonitoringPane({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useAnalytics(projectId);
  const { data: deployments } = useDeployments(projectId);
  const hasDeployment = (deployments?.length ?? 0) > 0;

  const max = Math.max(1, ...(data?.daily.map((d) => d.count) ?? [1]));

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Monitoring
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading traffic…</p>
        ) : error ? (
          <p className="text-xs text-destructive">{(error as Error).message}</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Today" value={data?.today ?? 0} />
              <Stat label="7 days" value={data?.total7 ?? 0} />
              <Stat label="30 days" value={data?.total30 ?? 0} />
            </div>

            <div className="mt-4">
              <div className="mb-1.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <Activity className="h-3 w-3" /> Page views · last 30 days
              </div>
              <div className="flex h-24 items-end gap-[2px] rounded-md border border-border bg-card p-2">
                {data?.daily.map((d) => (
                  <div
                    key={d.day}
                    title={`${d.day}: ${d.count} view${d.count === 1 ? "" : "s"}`}
                    className="min-w-0 flex-1 rounded-sm bg-primary/70 hover:bg-primary"
                    style={{
                      height: `${Math.max(d.count > 0 ? 8 : 2, (d.count / max) * 100)}%`,
                    }}
                  />
                ))}
              </div>
            </div>

            {!hasDeployment && (
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                No deployment yet — traffic is counted once your app is
                published from the Publishing tool.
              </p>
            )}
            {hasDeployment && data && data.total30 === 0 && (
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                No visits recorded yet. Views are counted whenever someone opens
                your deployed site.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
