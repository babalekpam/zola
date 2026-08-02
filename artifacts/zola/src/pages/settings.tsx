// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Blocks,
  Building2,
  CreditCard,
  Cpu,
  ShieldCheck,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/hooks/use-projects";
import { useAuth } from "@/hooks/use-auth";
import { DashboardShell, PageHeader } from "@/components/dashboard/dashboard-shell";
import { RequireAuth } from "@/components/dashboard/require-auth";
import type { User } from "@supabase/supabase-js";

const SHORTCUTS = [
  {
    icon: Building2,
    title: "Workspaces & members",
    body: "Create workspaces, invite people, manage roles.",
    href: "/organization",
  },
  {
    icon: CreditCard,
    title: "Billing & plan",
    body: "Change plan, update payment method, see invoices.",
    href: "/billing",
  },
  {
    icon: Blocks,
    title: "Integrations",
    body: "Connect services once, attach them to any project.",
    href: "/integrations",
  },
  {
    icon: Cpu,
    title: "AI Console",
    body: "Model availability, Auto routing and usage.",
    href: "/ai-console",
  },
  {
    icon: ShieldCheck,
    title: "Security",
    body: "Public projects, stored credentials, agent tool access.",
    href: "/security",
  },
];

function SettingsBody({ user }: { user: User }) {
  const { signOut } = useAuth();
  const [, setLocation] = useLocation();
  const [deleting, setDeleting] = useState(false);

  async function deleteAccount() {
    if (
      !window.confirm(
        "Delete your account? This cannot be undone. All projects, deployments and secrets will be removed.",
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await apiFetch("/api/account", { method: "DELETE" });
      setLocation("/");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  const fullName = (user.user_metadata?.full_name as string | undefined) ?? null;

  return (
    <div className="mx-auto max-w-3xl px-6 pb-16 pt-10">
      <PageHeader
        title="Settings"
        description="Your account, and the shortcuts to everything else that's configurable."
      />

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <UserIcon className="h-4 w-4 text-primary" /> Profile
        </h2>
        <dl className="mt-3 space-y-2 text-xs">
          {fullName && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Name</dt>
              <dd>{fullName}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">User ID</dt>
            <dd className="font-mono text-[11px] text-muted-foreground">{user.id}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Member since</dt>
            <dd>{new Date(user.created_at).toLocaleDateString()}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        {SHORTCUTS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:bg-accent/40"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <item.icon className="h-4 w-4 text-primary" /> {item.title}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{item.body}</p>
          </Link>
        ))}
      </section>

      <section className="mt-6 rounded-xl border border-destructive/40 bg-destructive/5 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-destructive">
          <Trash2 className="h-4 w-4" /> Danger zone
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Deleting your account removes every project, deployment, secret and MCP server
          you own. This can't be undone.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={signOut}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent"
          >
            Sign out
          </button>
          <button
            type="button"
            onClick={deleteAccount}
            disabled={deleting}
            className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/20 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete account"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RequireAuth>
      {(user) => (
        <DashboardShell active="Settings">
          <SettingsBody user={user} />
        </DashboardShell>
      )}
    </RequireAuth>
  );
}
