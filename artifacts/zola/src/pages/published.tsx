// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Link } from "wouter";
import { ExternalLink, Eye, Globe, Lock, Rocket } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { DashboardShell, PageHeader } from "@/components/dashboard/dashboard-shell";
import { RequireAuth } from "@/components/dashboard/require-auth";
import { usePublishedSites } from "@/hooks/use-workspace-overview";

function PublishedBody() {
  const { data: sites, isLoading } = usePublishedSites();

  return (
    <div className="mx-auto max-w-5xl px-6 pb-16 pt-10">
      <PageHeader
        title="Published Projects"
        description="Every project you've deployed, with its live URL, custom domains and traffic. Publishing happens in a project's Publishing tab."
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : !sites || sites.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Rocket className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nothing published yet. Open a project and use the Publishing tab to put it on
            the web.
          </p>
          <Link
            href="/projects"
            className="mt-4 inline-block rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
          >
            Go to Projects
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sites.map((site) => {
            const url = `/sites/${site.slug}/`;
            return (
              <div
                key={site.projectId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/projects/${site.projectId}`}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {site.projectName}
                    </Link>
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                      title={
                        site.visibility === "public"
                          ? "Listed on Explore and remixable by anyone"
                          : "Source is private; only the deployed site is public"
                      }
                    >
                      {site.visibility === "public" ? (
                        <>
                          <Globe className="h-3 w-3" /> Public source
                        </>
                      ) : (
                        <>
                          <Lock className="h-3 w-3" /> Private source
                        </>
                      )}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {url} <ExternalLink className="h-3 w-3" />
                    </a>
                    {site.domains.map((domain) => (
                      <a
                        key={domain}
                        href={`https://${domain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {domain} <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-5 text-right">
                  <div>
                    <div className="inline-flex items-center gap-1 text-sm font-medium tabular-nums">
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                      {site.hits.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-muted-foreground">visits</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium tabular-nums">
                      {site.deploymentCount}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      deploy{site.deploymentCount === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="min-w-[92px]">
                    <div className="text-xs">{formatRelativeTime(site.deployedAt)}</div>
                    <div className="text-[10px] text-muted-foreground">last publish</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PublishedPage() {
  return (
    <RequireAuth>
      {() => (
        <DashboardShell active="Published Projects">
          <PublishedBody />
        </DashboardShell>
      )}
    </RequireAuth>
  );
}
