// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { ChatPanel } from "@/components/chat/chat-panel";
import { FileTree } from "@/components/editor/file-tree";
import { CodeEditor } from "@/components/editor/code-editor";
import { EditorTabs } from "@/components/editor/editor-tabs";
import { ToolPane } from "@/components/workspace/tool-pane";
import { RunButton } from "@/components/workspace/run-button";
import { PresenceAvatars } from "@/components/workspace/presence-avatars";
import { ProjectSettings } from "@/components/workspace/project-settings";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { apiFetch } from "@/hooks/use-projects";
import { useSecrets } from "@/hooks/use-secrets";
import { createAutoSnapshot } from "@/hooks/use-snapshots";
import { dbUrlFor } from "@/components/workspace/database-pane";
import { runtime } from "@/lib/webcontainer/runtime";
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
  const initialPath =
    initialFiles.find((f) => f.path === "src/App.tsx")?.path ??
    initialFiles[0]?.path ??
    null;
  const [activePath, setActivePath] = useState<string | null>(initialPath);
  const [openPaths, setOpenPaths] = useState<string[]>(
    initialPath ? [initialPath] : [],
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const { data: secrets, isLoading: secretsLoading } = useSecrets(project.id);

  // Keep the WebContainer runtime fed with the latest files (hot remount while
  // running) and project secrets (picked up on the next Run / shell spawn).
  useEffect(() => {
    void runtime.setFiles(files);
  }, [files]);

  useEffect(() => {
    const env = Object.fromEntries(
      (secrets ?? []).map((s) => [s.key, s.value]),
    );
    // The app's key-value store rides along like REPLIT_DB_URL does.
    if (project.db_token) env.ZOLA_DB_URL = dbUrlFor(project.db_token);
    runtime.setEnv(env);
  }, [secrets, project.db_token]);

  // Auto-run once when the workspace opens, after secrets have loaded (or
  // failed to), so the webview comes up without pressing Run — matching the
  // old preview behavior.
  useEffect(() => {
    if (secretsLoading) return;
    if (runtime.state.status === "idle") void runtime.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secretsLoading]);

  const openFile = useCallback((p: string) => {
    setActivePath(p);
    setOpenPaths((prev) => (prev.includes(p) ? prev : [...prev, p]));
  }, []);

  const closeTab = useCallback(
    (p: string) => {
      const idx = openPaths.indexOf(p);
      const next = openPaths.filter((x) => x !== p);
      setOpenPaths(next);
      if (activePath === p) {
        setActivePath(next[idx] ?? next[idx - 1] ?? null);
      }
    },
    [openPaths, activePath],
  );

  const updateFile = useCallback((path: string, next: string) => {
    setFiles((prev) => ({ ...prev, [path]: next }));
    setDirty(true);
  }, []);

  const createFile = useCallback(
    (path: string) => {
      if (files[path] !== undefined) {
        toast.error(`${path} already exists`);
        return;
      }
      setFiles((prev) => ({ ...prev, [path]: "" }));
      setActivePath(path);
      setOpenPaths((prev) => (prev.includes(path) ? prev : [...prev, path]));
      setDirty(true);
    },
    [files],
  );

  const deleteFile = useCallback(
    async (path: string) => {
      setFiles((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
      const idx = openPaths.indexOf(path);
      const nextOpen = openPaths.filter((x) => x !== path);
      setOpenPaths(nextOpen);
      if (activePath === path) {
        setActivePath(nextOpen[idx] ?? nextOpen[idx - 1] ?? null);
      }
      try {
        await apiFetch(`/api/projects/${project.id}/files?path=${encodeURIComponent(path)}`, { method: "DELETE" });
        toast.success(`Deleted ${path}`);
      } catch {
        toast.error("Delete failed on server");
      }
    },
    [project.id, openPaths, activePath],
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
      setOpenPaths((prev) => prev.map((x) => (x === from ? to : x)));
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
      // Replit-style safety net: checkpoint the pre-edit state so any AI
      // change can be rolled back from the History tab.
      createAutoSnapshot(project.id, "Before AI edit", files);
      setFiles((prev) => {
        const next = { ...prev };
        for (const { path, content } of incoming) {
          next[path] = content;
        }
        return next;
      });
      if (incoming[0]) openFile(incoming[0].path);
      setDirty(true);
    },
    [openFile, project.id, files],
  );

  const restoreFiles = useCallback((restored: Record<string, string>) => {
    setFiles(restored);
    const paths = Object.keys(restored);
    setOpenPaths((prev) => prev.filter((p) => restored[p] !== undefined));
    setActivePath((cur) =>
      cur && restored[cur] !== undefined
        ? cur
        : paths.find((p) => p === "src/App.tsx") ?? paths[0] ?? null,
    );
    // The restore endpoint already wrote these files server-side.
    setDirty(false);
  }, []);

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
      <div className="hidden h-screen w-screen flex-col md:flex">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-4">
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
          <div className="flex items-center gap-3">
            <PresenceAvatars projectId={project.id} />
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
            <RunButton />
          </div>
        </header>

        <ResizablePanelGroup
          direction="horizontal"
          autoSaveId="zola-workspace-layout"
          className="min-h-0 flex-1"
        >
          <ResizablePanel defaultSize={24} minSize={16} className="overflow-hidden">
            <ChatPanel
              projectId={project.id}
              files={files}
              initialMessages={initialMessages}
              onApplyFiles={applyFiles}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel
            defaultSize={14}
            minSize={10}
            maxSize={28}
            className="overflow-hidden bg-card"
          >
            <FileTree
              files={files}
              activePath={activePath}
              onSelect={openFile}
              onCreate={createFile}
              onDelete={(p) => void deleteFile(p)}
              onRename={(f, t) => void renameFile(f, t)}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={37} minSize={20} className="overflow-hidden">
            <div className="flex h-full flex-col">
              <EditorTabs
                openPaths={openPaths}
                activePath={activePath}
                onSelect={openFile}
                onClose={closeTab}
              />
              <div className="min-h-0 flex-1">
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
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={25} minSize={15} className="overflow-hidden">
            <ToolPane
              projectId={project.id}
              dbToken={project.db_token ?? null}
              files={files}
              onRestore={restoreFiles}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </>
  );
}
