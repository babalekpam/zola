// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Link } from "wouter";
import {
  AlertTriangle,
  Check,
  Globe,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { DashboardShell, PageHeader } from "@/components/dashboard/dashboard-shell";
import { RequireAuth } from "@/components/dashboard/require-auth";
import { useSecurityOverview } from "@/hooks/use-workspace-overview";

function SecurityBody() {
  const { data, isLoading } = useSecurityOverview();

  const publicProjects = (data?.projects ?? []).filter((p) => p.visibility === "public");
  const totalSecrets = (data?.projects ?? []).reduce((n, p) => n + p.secrets, 0);
  const totalMcp = (data?.projects ?? []).reduce((n, p) => n + p.mcpServers, 0);
  const sharedProjects = (data?.projects ?? []).filter((p) => p.members > 0);

  return (
    <div className="mx-auto max-w-5xl px-6 pb-16 pt-10">
      <PageHeader
        title="Security"
        description="What's exposed across your account: which projects are readable by anyone, where your credentials live, and which MCP servers can act on your behalf. The per-file secret scan lives in each project's own Security tab."
      />

      {isLoading || !data ? (
        <div className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Globe className="h-3.5 w-3.5" /> Public projects
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {publicProjects.length}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                of {data.projects.length} total
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <KeyRound className="h-3.5 w-3.5" /> Project secrets
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{totalSecrets}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                stored server-side, injected at run time
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Wrench className="h-3.5 w-3.5" /> Enabled MCP servers
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{totalMcp}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                can be called by the agent
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> Shared projects
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {sharedProjects.length}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                have collaborators with full access
              </div>
            </div>
          </div>

          <section className="mt-8">
            <h2 className="mb-2 text-sm font-semibold">Account</h2>
            <div className="space-y-2 rounded-xl border border-border bg-card p-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" /> Email
                </span>
                <span>{data.email ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" /> Sign-in methods
                </span>
                <span>{data.providers.length > 0 ? data.providers.join(", ") : "email"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Check className="h-3.5 w-3.5" /> Last sign-in
                </span>
                <span>
                  {data.lastSignInAt ? formatRelativeTime(data.lastSignInAt) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <KeyRound className="h-3.5 w-3.5" /> Connected integrations
                </span>
                <Link href="/integrations" className="underline hover:text-foreground">
                  {data.integrationCount} connected
                </Link>
              </div>
            </div>
          </section>

          {publicProjects.length > 0 && (
            <div className="mt-6 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-xs">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <span className="font-medium">
                  {publicProjects.length} project
                  {publicProjects.length === 1 ? " is" : "s are"} public.
                </span>{" "}
                Anyone can read the source and remix it. Secrets are never part of a public
                project — they live outside the file tree — but anything you hardcoded into
                a file is visible. Flip visibility in a project's Settings.
              </div>
            </div>
          )}

          <section className="mt-8">
            <h2 className="mb-2 text-sm font-semibold">Projects</h2>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[640px] text-xs">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Project</th>
                    <th className="px-3 py-2 font-medium">Visibility</th>
                    <th className="px-3 py-2 text-right font-medium">Secrets</th>
                    <th className="px-3 py-2 text-right font-medium">MCP</th>
                    <th className="px-3 py-2 text-right font-medium">Collaborators</th>
                    <th className="px-3 py-2 text-right font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {data.projects.map((project) => (
                    <tr key={project.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <Link
                          href={`/projects/${project.id}`}
                          className="hover:underline"
                        >
                          {project.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          {project.visibility === "public" ? (
                            <>
                              <Globe className="h-3 w-3" /> Public
                            </>
                          ) : (
                            <>
                              <Lock className="h-3 w-3" /> Private
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{project.secrets}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{project.mcpServers}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{project.members}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {formatRelativeTime(project.updatedAt)}
                      </td>
                    </tr>
                  ))}
                  {data.projects.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                        No projects yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="mb-2 text-sm font-semibold">How Zola protects your work</h2>
            <ul className="space-y-2 rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
              <li className="flex gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Every project read and write goes through Postgres row-level security — the
                API server uses your session, not a god key.
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Secrets and MCP credentials are stored outside the file tree and never sent
                back to the browser; the UI only ever shows their names.
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                MCP servers must be https and can't point at private network addresses, so
                adding one can't be used to reach internal services.
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                A checkpoint of the whole file tree is saved before every AI edit, so any
                agent change is one click from being undone.
              </li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

export default function SecurityPage() {
  return (
    <RequireAuth>
      {() => (
        <DashboardShell active="Security">
          <SecurityBody />
        </DashboardShell>
      )}
    </RequireAuth>
  );
}
