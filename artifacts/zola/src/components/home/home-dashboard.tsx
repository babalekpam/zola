// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useState } from "react";
import { Link } from "wouter";
import {
  Search,
  Plus,
  Download,
  UserPlus,
  Home,
  FolderClosed,
  Globe,
  Blocks,
  Shield,
  Megaphone,
  GraduationCap,
  BookOpen,
  Gift,
  Sparkles,
  ArrowUp,
  Mic,
  Paperclip,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Smartphone,
  Palette,
  BarChart3,
  Presentation,
  Trash2,
  FolderOpen,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/types";
import { ImportDialog } from "./import-dialog";
import { InviteDialog } from "./invite-dialog";
import { ReferEarnDialog } from "./refer-earn-dialog";

interface Props {
  userName: string;
  userId: string;
  projects: Project[] | undefined;
  isLoading: boolean;
  creating: boolean;
  onCreate: (prompt?: string) => void;
  onOpenProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onSignOut: () => void;
}

const NAV_ITEMS = [
  { icon: Home, label: "Home", href: "/projects", active: true },
  { icon: FolderClosed, label: "Projects", href: "/projects" },
  { icon: Globe, label: "Published Projects", href: "/projects" },
  { icon: Blocks, label: "Integrations", href: "/account" },
  { icon: Shield, label: "Security", href: "/account" },
  { icon: Megaphone, label: "Promotions", href: "/billing" },
  { icon: GraduationCap, label: "Learn", href: "/about" },
  { icon: BookOpen, label: "Documentation", href: "/about" },
];

const TEMPLATES = [
  { icon: Globe, label: "Website", prompt: "Build a website" },
  { icon: Smartphone, label: "Mobile", prompt: "Build a mobile app" },
  { icon: Palette, label: "Design", prompt: "Design a UI mockup" },
  { icon: BarChart3, label: "Data Visualization", prompt: "Build a data dashboard" },
  { icon: Presentation, label: "Slides", prompt: "Make a slide deck" },
];

const EXAMPLE_PROMPTS = [
  "Checkout flow prototype",
  "AI sales assistant",
  "B2B project management app",
];

export function HomeDashboard({
  userName,
  userId,
  projects,
  isLoading,
  creating,
  onCreate,
  onOpenProject,
  onDeleteProject,
  onSignOut,
}: Props) {
  const [prompt, setPrompt] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [referOpen, setReferOpen] = useState(false);

  function submitPrompt() {
    const trimmed = prompt.trim();
    onCreate(trimmed || undefined);
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card/40">
        <div className="flex items-center justify-between px-3 py-3">
          <button
            type="button"
            className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className="truncate text-sm font-medium">{userName}'s ...</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
          <button
            type="button"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-1.5 px-3">
          <button
            type="button"
            onClick={() => onCreate()}
            disabled={creating}
            className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Create something new
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent"
          >
            <Download className="h-4 w-4" /> Import code or design
          </button>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <span className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Invite
            </span>
          </button>
        </div>

        <nav className="mt-3 flex-1 space-y-0.5 overflow-y-auto px-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm",
                item.active
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
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
            <button type="button" onClick={onSignOut} className="hover:text-foreground">
              Sign out
            </button>
            <span>Changelog</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="relative flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-3xl flex-col px-6 pb-16 pt-24">
          <h1 className="text-center text-3xl font-semibold tracking-tight">
            Hi {userName}, what do you want to make?
          </h1>

          {/* Prompt box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitPrompt();
            }}
            className="mt-8 rounded-xl border border-border bg-card p-3 shadow-sm focus-within:border-primary/50"
          >
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitPrompt();
                }
              }}
              rows={2}
              placeholder="Make a launch video about..."
              className="w-full resize-none bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
            />
            <div className="mt-1 flex items-center justify-between">
              <button
                type="button"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Attach"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent"
                >
                  <span className="h-2 w-2 rounded-full border border-muted-foreground" />
                  Plan
                </button>
                <button
                  type="button"
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Voice"
                >
                  <Mic className="h-4 w-4" />
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-md bg-primary p-1.5 text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  aria-label="Send"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
            </div>
          </form>

          {/* Template cards */}
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              type="button"
              className="rounded-full p-1 text-muted-foreground hover:bg-accent"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex gap-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => onCreate(t.prompt)}
                  className="flex w-24 flex-col items-center gap-2 rounded-xl border border-border bg-card px-3 py-4 text-center hover:border-primary/50 hover:bg-accent"
                >
                  <t.icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{t.label}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="rounded-full p-1 text-muted-foreground hover:bg-accent"
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Example prompts */}
          <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            Try an example prompt <RefreshCw className="h-3 w-3" />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {EXAMPLE_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPrompt(p)}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-accent"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Recent projects */}
          <div className="mt-14">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Your recent Projects</h2>
              <Link href="/projects" className="text-xs text-muted-foreground hover:text-foreground">
                View All
              </Link>
            </div>
            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card" />
                ))}
              </div>
            ) : projects && projects.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {projects.slice(0, 6).map((p) => (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenProject(p.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpenProject(p.id);
                      }
                    }}
                    className="group relative cursor-pointer rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteProject(p.id);
                        }}
                        className="rounded p-1 text-muted-foreground opacity-0 transition-all hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100"
                        aria-label="Delete project"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <h3 className="truncate text-sm font-medium">{p.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatRelativeTime(p.updated_at)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                No projects yet — describe what you want to build above.
              </div>
            )}
          </div>
        </div>
      </main>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        projects={projects}
        currentUserId={userId}
      />
      <ReferEarnDialog open={referOpen} onOpenChange={setReferOpen} />
    </div>
  );
}
