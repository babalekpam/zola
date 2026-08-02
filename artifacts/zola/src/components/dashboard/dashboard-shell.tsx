// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  BarChart3,
  Blocks,
  BookOpen,
  Compass,
  Cpu,
  Download,
  FolderClosed,
  Gift,
  Globe,
  GraduationCap,
  Home,
  Megaphone,
  Plus,
  Search,
  Settings,
  Shield,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-admin";
import { ImportDialog } from "@/components/home/import-dialog";
import { ReferEarnDialog } from "@/components/home/refer-earn-dialog";
import { WorkspaceSwitcher } from "@/components/home/workspace-switcher";

/**
 * Every item here resolves to a real page — the sidebar is the product's map,
 * and a link that lands somewhere unrelated teaches the user to distrust it.
 */
export const NAV_ITEMS = [
  { icon: Home, label: "Home", href: "/projects" },
  { icon: FolderClosed, label: "Projects", href: "/projects" },
  { icon: Compass, label: "Explore", href: "/explore" },
  { icon: Globe, label: "Published Projects", href: "/published" },
  { icon: Blocks, label: "Integrations", href: "/integrations" },
  { icon: Cpu, label: "AI Console", href: "/ai-console" },
  { icon: BarChart3, label: "Usage", href: "/ai-console?tab=usage" },
  { icon: Shield, label: "Security", href: "/security" },
  { icon: Megaphone, label: "Promotions", href: "/promotions" },
  { icon: Settings, label: "Settings", href: "/settings" },
  { icon: GraduationCap, label: "Learn", href: "/learn" },
  { icon: BookOpen, label: "Documentation", href: "/docs" },
] as const;

interface Props {
  /** Nav item to highlight, matched on `label`. */
  active: string;
  children: ReactNode;
  /**
   * Home passes its own creator so "Create something new" makes a project in
   * place; every other page just sends the user to the prompt box.
   */
  onCreate?: () => void;
  creating?: boolean;
}

export function DashboardShell({ active, children, onCreate, creating }: Props) {
  const { signOut } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const [importOpen, setImportOpen] = useState(false);
  const [referOpen, setReferOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card/40">
        <div className="flex items-center justify-between px-3 py-3">
          <WorkspaceSwitcher />
          <button
            type="button"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-1.5 px-3">
          {onCreate ? (
            <button
              type="button"
              onClick={onCreate}
              disabled={creating}
              className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Create something new
            </button>
          ) : (
            <Link
              href="/projects"
              className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent"
            >
              <Plus className="h-4 w-4" /> Create something new
            </Link>
          )}
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent"
          >
            <Download className="h-4 w-4" /> Import code or design
          </button>
          <Link
            href="/organization"
            className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <span className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Invite
            </span>
          </Link>
        </div>

        <nav className="mt-3 flex-1 space-y-0.5 overflow-y-auto px-3 [scrollbar-width:thin]">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm",
                active === item.label
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}

          {isAdmin && (
            <>
              <div className="mx-3 my-2 border-t border-border" />
              <Link
                href="/admin"
                className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm font-medium text-primary hover:bg-accent"
              >
                <Shield className="h-4 w-4" />
                Super admin
              </Link>
            </>
          )}
        </nav>

        <div className="p-3">
          <div className="rounded-lg border border-border bg-background p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Gift className="h-4 w-4 text-primary" /> Invite a friend, earn $20
            </div>
            <button
              type="button"
              onClick={() => setReferOpen(true)}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Gift className="h-3.5 w-3.5" /> Refer &amp; Earn
            </button>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              You'll both get credits when they upgrade to a paid plan.
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between px-1 text-[11px] text-muted-foreground">
            <button type="button" onClick={signOut} className="hover:text-foreground">
              Sign out
            </button>
            <Link href="/docs" className="hover:text-foreground">
              Changelog
            </Link>
          </div>
        </div>
      </aside>

      <main className="relative flex-1 overflow-y-auto">{children}</main>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <ReferEarnDialog open={referOpen} onOpenChange={setReferOpen} />
    </div>
  );
}

/** Standard page header for the dashboard pages that live inside the shell. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
