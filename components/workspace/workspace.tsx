// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Code2, Play, Save } from "lucide-react";
import { toast } from "sonner";
import { ChatPanel } from "@/components/chat/chat-panel";
import { FileTree } from "@/components/editor/file-tree";
import { CodeEditor } from "@/components/editor/code-editor";
import { WebContainerPreview } from "@/components/preview/webcontainer-preview";
import { Button } from "@/components/ui/button";
import { ProjectSettings } from "@/components/workspace/project-settings";
import { cn } from "@/lib/utils";
import type { ChatMessage, Project, ProjectFile } from "@/lib/types";

interface Props {
  project: Project;
  initialFiles: ProjectFile[];
  initialMessages: ChatMessage[];
}

type Tab = "app" | "code";

export function Workspace({ project, initialFiles, initialMessages }: Props) {
  const [files, setFiles] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialFiles.map((f) => [f.path, f.content])),
  );
  const [activePath, setActivePath] = useState<string | null>(
    initialFiles.find((f) => f.path === "src/App.tsx")?.path ??
      initialFiles[0]?.path ??
      null,
  );
  const [tab, setTab] = useState<Tab>("app");
  const [runSignal, setRunSignal] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const onSelect = useCallback((p: string) => setActivePath(p), []);

  const updateFile = useCallback((path: string, next: string) => {
    setFiles((prev) => ({ ...prev, [path]: next }));
    setDirty(true);
  }, []);

  const createFile = useCallback((path: string) => {
    setFiles((prev) => {
      if (prev[path] !== undefined) {
        toast.error(`${path} already exists`);
        return prev;
      }
      return { ...prev, [path]: "" };
    });
    setActivePath(path);
    setTab("code");
    setDirty(true);
  }, []);

  const deleteFile = useCallback(
    async (path: string) => {
      setFiles((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
      setActivePath((current) => (current === path ? null : current));
      try {
        await fetch(
          `/api/projects/${project.id}/files?path=${encodeURIComponent(path)}`,
          { method: "DELETE" },
        );
        toast.success(`Deleted ${path}`);
      } catch {
        toast.error("Delete failed on server");
      }
    },
    [project.id],
  );

  const renameFile = useCallback(
    async (from: string, to: string) => {
      setFiles((prev) => {
        if (prev[from] === undefined) return prev;
        const next: Record<string, string> = {};
        for (const [k, v] of Object.entries(prev)) {
          next[k === from ? to : k] = v;
        }
        return next;
      });
      setActivePath((cur) => (cur === from ? to : cur));
      setDirty(true);
      try {
        await fetch(
          `/api/projects/${project.id}/files?path=${encodeURIComponent(from)}`,
          { method: "DELETE" },
        );
      } catch {
        // the autosave upsert will re-sync server state
      }
    },
    [project.id],
  );

  // Replit-style: when the agent writes files, jump to the App tab and
  // boot/refresh the preview automatically.
  const applyFiles = useCallback(
    (incoming: { path: string; content: string }[]) => {
      setFiles((prev) => {
        const next = { ...prev };
        for (const f of incoming) next[f.path] = f.content;
        return next;
      });
      if (incoming[0]) setActivePath(incoming[0].path);
      setDirty(true);
      setTab("app");
      setRunSignal((s) => s + 1);
    },
    [],
  );

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/files`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          files: Object.entries(files).map(([path, content]) => ({
            path,
            content,
          })),
        }),
      });
      if (!res.ok) throw new Error("save failed");
      setDirty(false);
    } catch {
      toast.error("Could not save files");
    } finally {
      setSaving(false);
    }
  }, [files, project.id]);

  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => void save(), 1500);
    return () => clearTimeout(t);
  }, [dirty, save]);

  return (
    <>
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background p-8 text-center md:hidden">
        <h2 className="text-xl font-semibold">Workspace is desktop-only</h2>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          The Loop workspace needs a wider screen. Open this page on a laptop
          or larger tablet.
        </p>
        <Link
          href="/projects"
          className="mt-6 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
        >
          ← Back to projects
        </Link>
      </div>

      {/* Replit-style chrome: navy canvas, floating rounded panes with gutters */}
      <div className="hidden h-screen w-screen flex-col gap-1.5 bg-background p-1.5 md:flex">
        <header className="flex h-11 shrink-0 items-center justify-between rounded-lg border border-border bg-card px-3">
          <div className="flex items-center gap-3">
            <Link
              href="/projects"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Projects
            </Link>
            <span className="text-sm font-semibold">{project.name}</span>
            <ProjectSettings project={project} />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {dirty ? "Saving…" : "All changes saved"}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void save()}
              disabled={!dirty || saving}
              aria-label="Save now"
            >
              <Save className="h-3.5 w-3.5" />
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 gap-1.5">
          {/* Left: agent chat pane */}
          <section className="flex w-[420px] shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
            <ChatPanel
              projectId={project.id}
              files={files}
              initialMessages={initialMessages}
              onApplyFiles={applyFiles}
            />
          </section>

          {/* Right: App / Code pane, preview-first like Replit */}
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-2">
              <div className="flex items-center gap-1">
                <TabButton
                  active={tab === "app"}
                  onClick={() => setTab("app")}
                  icon={<Play className="h-3.5 w-3.5" />}
                  label="App"
                />
                <TabButton
                  active={tab === "code"}
                  onClick={() => setTab("code")}
                  icon={<Code2 className="h-3.5 w-3.5" />}
                  label="Code"
                />
              </div>
              <span className="pr-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                Argilette Lab
              </span>
            </div>

            <div className="min-h-0 flex-1">
              {/* Keep the preview mounted even on the Code tab so the dev
                  server keeps running; just hide it. */}
              <div className={cn("h-full", tab === "app" ? "block" : "hidden")}>
                <WebContainerPreview files={files} runSignal={runSignal} />
              </div>
              <div
                className={cn(
                  "h-full grid-cols-[240px_1fr]",
                  tab === "code" ? "grid" : "hidden",
                )}
              >
                <div className="overflow-hidden border-r border-border">
                  <FileTree
                    files={files}
                    activePath={activePath}
                    onSelect={onSelect}
                    onCreate={createFile}
                    onDelete={(p) => void deleteFile(p)}
                    onRename={(f, t) => void renameFile(f, t)}
                  />
                </div>
                <div className="h-full">
                  {activePath ? (
                    <CodeEditor
                      path={activePath}
                      value={files[activePath] ?? ""}
                      onChange={(v) => updateFile(activePath, v)}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Select a file to edit
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
