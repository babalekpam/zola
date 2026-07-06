// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { ChatPanel } from "@/components/chat/chat-panel";
import { FileTree } from "@/components/editor/file-tree";
import { CodeEditor } from "@/components/editor/code-editor";
import { WebContainerPreview } from "@/components/preview/webcontainer-preview";
import { ProjectSettings } from "@/components/workspace/project-settings";
import { apiFetch } from "@/hooks/use-projects";
import type { ChatMessage, Project, ProjectFile } from "@/lib/types";

interface Props {
  project: Project;
  initialFiles: ProjectFile[];
  initialMessages: ChatMessage[];
}

export function Workspace({ project, initialFiles, initialMessages }: Props) {
  const [files, setFiles] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialFiles.map((f) => [f.path, f.content])),
  );
  const [activePath, setActivePath] = useState<string | null>(
    initialFiles.find((f) => f.path === "src/App.tsx")?.path ??
      initialFiles[0]?.path ??
      null,
  );
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
        await apiFetch(`/api/projects/${project.id}/files?path=${encodeURIComponent(path)}`, { method: "DELETE" });
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
        await apiFetch(`/api/projects/${project.id}/files?path=${encodeURIComponent(from)}`, { method: "DELETE" });
      } catch {
        // silent — the upsert on next save will sync state
      }
    },
    [project.id],
  );

  const applyFiles = useCallback(
    (incoming: { path: string; content: string }[]) => {
      setFiles((prev) => {
        const next = { ...prev };
        for (const { path, content } of incoming) {
          next[path] = content;
        }
        return next;
      });
      if (incoming[0]) setActivePath(incoming[0].path);
      setDirty(true);
    },
    [],
  );

  const save = useCallback(async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      const filesArr = Object.entries(files).map(([path, content]) => ({ path, content }));
      await apiFetch(`/api/projects/${project.id}/files`, {
        method: "PUT",
        body: JSON.stringify({ files: filesArr }),
      });
      setDirty(false);
    } catch {
      toast.error("Could not save files");
    } finally {
      setSaving(false);
    }
  }, [files, project.id, dirty]);

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
          The Loop workspace needs a wider screen. Open this page on a laptop or larger tablet.
        </p>
        <Link
          href="/projects"
          className="mt-6 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
        >
          ← Back to projects
        </Link>
      </div>
      <div className="hidden h-screen w-screen md:grid grid-cols-[380px_1fr_1fr] grid-rows-[48px_1fr]">
        <header className="col-span-3 flex items-center justify-between border-b border-border bg-background px-4">
          <div className="flex items-center gap-3">
            <Link
              href="/projects"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Projects
            </Link>
            <span className="text-sm font-semibold">{project.name}</span>
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              Argilette Lab
            </span>
            <ProjectSettings project={project} />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {dirty ? "Unsaved changes" : "All changes saved"}
            <button
              type="button"
              onClick={() => void save()}
              disabled={!dirty || saving}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </header>

        <section className="border-r border-border overflow-hidden row-start-2">
          <ChatPanel
            projectId={project.id}
            files={files}
            initialMessages={initialMessages}
            onApplyFiles={applyFiles}
          />
        </section>

        <section className="grid grid-rows-[240px_1fr] border-r border-border row-start-2">
          <div className="overflow-hidden border-b border-border bg-card">
            <FileTree
              files={files}
              activePath={activePath}
              onSelect={onSelect}
              onCreate={createFile}
              onDelete={(p) => void deleteFile(p)}
              onRename={(f, t) => void renameFile(f, t)}
            />
          </div>
          <div className="h-full overflow-hidden">
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
        </section>

        <section className="row-start-2 overflow-hidden">
          <WebContainerPreview files={files} />
        </section>
      </div>
    </>
  );
}
