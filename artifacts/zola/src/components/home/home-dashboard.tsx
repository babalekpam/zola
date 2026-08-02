// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useRef, useState } from "react";
import { Link } from "wouter";
import {
  Plus,
  Globe,
  Blocks,
  ArrowUp,
  Mic,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Smartphone,
  Palette,
  BarChart3,
  Presentation,
  Trash2,
  Copy,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/utils";
import type { Project } from "@/lib/types";
import { readAttachment } from "@/lib/read-attachment";
import { useSamples } from "@/hooks/use-projects";
import { useForkProject } from "@/hooks/use-explore";
import { useActiveOrg } from "@/hooks/use-active-org";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

interface Props {
  userName: string;
  userId: string;
  projects: Project[] | undefined;
  isLoading: boolean;
  creating: boolean;
  onCreate: (
    prompt?: string,
    opts?: {
      template?: string;
      attachments?: { path: string; content: string }[];
    },
  ) => void;
  onOpenProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
}


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
}: Props) {
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<
    { path: string; content: string }[]
  >([]);
  const [reading, setReading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: samples } = useSamples();
  const { activeOrgId } = useActiveOrg();
  const forkProject = useForkProject();

  function onDuplicateProject(id: string) {
    forkProject.mutate({ projectId: id, orgId: activeOrgId }, {
      onSuccess: (project) => {
        toast.success("Project duplicated");
        onOpenProject(project.id);
      },
      onError: (err) => toast.error(err.message),
    });
  }

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setReading(true);
    try {
      const results = await Promise.all(
        Array.from(list).map((file) => readAttachment(file)),
      );
      const valid = results.flatMap((r) => (r.ok ? [r.attachment] : []));
      for (const r of results) {
        if (!r.ok) toast.error(`Couldn't attach ${r.name}`, { description: r.error });
      }
      if (valid.length) {
        setAttachments((prev) => {
          const merged = [...prev];
          for (const f of valid) {
            const i = merged.findIndex((m) => m.path === f.path);
            if (i >= 0) merged[i] = f;
            else merged.push(f);
          }
          return merged;
        });
        toast.success(
          valid.length === 1
            ? `Attached ${valid[0].path}`
            : `Attached ${valid.length} files`,
        );
      }
    } finally {
      setReading(false);
    }
  }

  function submitPrompt() {
    const trimmed = prompt.trim();
    onCreate(trimmed || undefined, {
      attachments: attachments.length ? attachments : undefined,
    });
  }

  return (
    <DashboardShell
      active="Home"
      onCreate={() => onCreate()}
      creating={creating}
    >
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
            {attachments.length > 0 && (
              <div className="mb-1 flex flex-wrap gap-1.5">
                {attachments.map((a) => (
                  <span
                    key={a.path}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    <Paperclip className="h-3 w-3" />
                    <span className="max-w-[140px] truncate">{a.path}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((prev) =>
                          prev.filter((x) => x.path !== a.path),
                        )
                      }
                      className="ml-0.5 hover:text-foreground"
                      aria-label={`Remove ${a.path}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-1 flex items-center justify-between">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md,.markdown,.json,.csv,.tsv,.js,.jsx,.ts,.tsx,.html,.css,.scss,.py,.rb,.go,.rs,.java,.php,.yml,.yaml,.toml,.xml,.svg,.env,.sql,.sh,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*"
                className="hidden"
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={reading}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                aria-label="Attach"
                title="Attach reference files (PDF, Word, text, code)"
              >
                {reading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
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

          {/* Template gallery, grouped by category like Replit's templates */}
          {samples && samples.length > 0 && (
            <div className="mt-14">
              <div className="mb-3">
                <h2 className="text-sm font-semibold">Templates</h2>
                <p className="text-xs text-muted-foreground">
                  Clone a ready-made project and tweak it with the AI.
                </p>
              </div>
              {Array.from(new Set(samples.map((s) => s.category))).map((cat) => (
                <div key={cat} className="mb-5">
                  <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {cat}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {samples.filter((s) => s.category === cat).map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-col rounded-xl border border-border bg-card p-4"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <Blocks className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-medium">{s.name}</h3>
                    </div>
                    <p className="flex-1 text-xs text-muted-foreground">
                      {s.description}
                    </p>
                    <button
                      type="button"
                      onClick={() => onCreate(s.name, { template: s.id })}
                      disabled={creating}
                      className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" /> Clone this project
                    </button>
                  </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

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
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicateProject(p.id);
                          }}
                          className="rounded p-1 text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover:opacity-100"
                          aria-label="Duplicate project"
                          title="Duplicate project"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteProject(p.id);
                          }}
                          className="rounded p-1 text-muted-foreground opacity-0 transition-all hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100"
                          aria-label="Delete project"
                          title="Delete project"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
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
    </DashboardShell>
  );
}
