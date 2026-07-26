// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  Building2,
  EyeOff,
  Globe,
  MessageSquare,
  Rocket,
  Search,
  ShieldAlert,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  usePlatformStats,
  useAdminUsers,
  useAdminOrgs,
  useAdminProjects,
  useAdminUnpublish,
  useAdminDeleteProject,
} from "@/hooks/use-admin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

/** Platform-owner (super admin) dashboard: cross-tenant stats + moderation. */
export default function AdminPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { data: stats, error, isLoading } = usePlatformStats();
  const [tab, setTab] = useState<"users" | "orgs" | "projects">("projects");

  if (loading || isLoading) {
    return (
      <main className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </main>
    );
  }

  if (!user || error || !stats) {
    return (
      <main className="flex h-screen items-center justify-center bg-background">
        <div className="max-w-sm space-y-3 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-lg font-semibold">Platform admin only</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error
              ? error.message
              : "You are not authorized to view this page."}
          </p>
          <button
            type="button"
            onClick={() => setLocation("/projects")}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
          >
            Back to projects
          </button>
        </div>
      </main>
    );
  }

  const TILES = [
    { icon: Users, label: "Users", value: stats.users, sub: `+${stats.newUsers7d} this week` },
    { icon: Building2, label: "Workspaces", value: stats.orgs, sub: null },
    { icon: Globe, label: "Projects", value: stats.projects, sub: `+${stats.newProjects7d} this week` },
    { icon: Rocket, label: "Deployments", value: stats.deployments, sub: `${stats.domains} custom domains` },
    { icon: MessageSquare, label: "AI messages", value: stats.messages, sub: `${stats.aiRequests7d} model calls this week` },
    { icon: Globe, label: "Public apps", value: stats.publicProjects, sub: "on Explore" },
  ];

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link
            href="/projects"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> My account
          </Link>
          <span className="text-sm font-semibold">Platform Admin</span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {TILES.map((t) => (
            <div key={t.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </div>
              <div className="mt-1 text-2xl font-bold">{t.value.toLocaleString()}</div>
              {t.sub && <div className="text-[11px] text-muted-foreground">{t.sub}</div>}
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-center gap-1 border-b border-border">
          {(["projects", "users", "orgs"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "border-b-2 px-3 py-2 text-sm capitalize",
                tab === t
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "orgs" ? "Workspaces" : t}
            </button>
          ))}
        </div>

        {tab === "projects" && <ProjectsTable />}
        {tab === "users" && <UsersTable />}
        {tab === "orgs" && <OrgsTable />}
      </div>
    </main>
  );
}

function ProjectsTable() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const { data: projects } = useAdminProjects(search);
  const unpublish = useAdminUnpublish();
  const del = useAdminDeleteProject();

  return (
    <div className="mt-4">
      <form
        className="mb-3 flex max-w-sm items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q.trim());
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search all projects…"
            className="pl-8"
          />
        </div>
        <Button type="submit" variant="outline" size="sm">Search</Button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-card text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Visibility</th>
              <th className="px-3 py-2 font-medium">Updated</th>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {projects?.map((p) => (
              <tr key={p.id} className="border-b border-border/50 last:border-0">
                <td className="max-w-[240px] truncate px-3 py-2 font-medium">{p.name}</td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium",
                      p.visibility === "public"
                        ? "bg-green-500/10 text-green-600"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {p.visibility}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{fmtDate(p.updated_at)}</td>
                <td className="px-3 py-2 text-muted-foreground">{fmtDate(p.created_at)}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    {p.visibility === "public" && (
                      <button
                        type="button"
                        onClick={() =>
                          unpublish.mutate(p.id, {
                            onSuccess: () => toast.success(`Unpublished ${p.name}`),
                            onError: (err) => toast.error(err.message),
                          })
                        }
                        className="rounded p-1 text-muted-foreground hover:text-foreground"
                        title="Force private (remove from Explore)"
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm(`Delete "${p.name}" and all its data? This cannot be undone.`)) return;
                        del.mutate(p.id, {
                          onSuccess: () => toast.success(`Deleted ${p.name}`),
                          onError: (err) => toast.error(err.message),
                        });
                      }}
                      className="rounded p-1 text-muted-foreground hover:text-destructive"
                      title="Delete project"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!projects?.length && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No projects found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsersTable() {
  const { data: users } = useAdminUsers();
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-border bg-card text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Email</th>
            <th className="px-3 py-2 font-medium">Signed up</th>
            <th className="px-3 py-2 font-medium">Last active</th>
          </tr>
        </thead>
        <tbody>
          {users?.map((u) => (
            <tr key={u.id} className="border-b border-border/50 last:border-0">
              <td className="px-3 py-2 font-medium">{u.email ?? u.id}</td>
              <td className="px-3 py-2 text-muted-foreground">{fmtDate(u.created_at)}</td>
              <td className="px-3 py-2 text-muted-foreground">{fmtDate(u.last_sign_in_at)}</td>
            </tr>
          ))}
          {!users?.length && (
            <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">No users.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function OrgsTable() {
  const { data: orgs } = useAdminOrgs();
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-border bg-card text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Members</th>
            <th className="px-3 py-2 font-medium">Projects</th>
            <th className="px-3 py-2 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {orgs?.map((o) => (
            <tr key={o.id} className="border-b border-border/50 last:border-0">
              <td className="max-w-[240px] truncate px-3 py-2 font-medium">{o.name}</td>
              <td className="px-3 py-2 text-muted-foreground">{o.personal ? "Personal" : "Team"}</td>
              <td className="px-3 py-2">{o.member_count}</td>
              <td className="px-3 py-2">{o.project_count}</td>
              <td className="px-3 py-2 text-muted-foreground">{fmtDate(o.created_at)}</td>
            </tr>
          ))}
          {!orgs?.length && (
            <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No workspaces.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
