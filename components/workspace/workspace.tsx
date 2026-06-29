"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { ChatPanel } from "@/components/chat/chat-panel";
import { FileTree } from "@/components/editor/file-tree";
import { CodeEditor } from "@/components/editor/code-editor";
import { WebContainerPreview } from "@/components/preview/webcontainer-preview";
import { Button } from "@/components/ui/button";
import type { Project, ProjectFile } from "@/lib/types";

interface Props {
  project: Project;
  initialFiles: ProjectFile[];
}

export function Workspace({ project, initialFiles }: Props) {
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

  const applyFiles = useCallback(
    (incoming: { path: string; content: string }[]) => {
      setFiles((prev) => {
        const next = { ...prev };
        for (const f of incoming) next[f.path] = f.content;
        return next;
      });
      if (incoming[0]) setActivePath(incoming[0].path);
      setDirty(true);
    },
    [],
  );

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`/api/projects/${project.id}/files`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          files: Object.entries(files).map(([path, content]) => ({
            path,
            content,
          })),
        }),
      });
      setDirty(false);
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
    <div className="grid h-screen w-screen grid-cols-[380px_1fr_1fr] grid-rows-[48px_1fr]">
      <header className="col-span-3 flex items-center justify-between border-b border-border bg-background px-4">
        <div className="flex items-center gap-3">
          <Link
            href="/projects"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Projects
          </Link>
          <span className="text-sm font-semibold">{project.name}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {dirty ? "Unsaved changes" : "All changes saved"}
          <Button
            size="sm"
            variant="outline"
            onClick={() => void save()}
            disabled={!dirty || saving}
          >
            <Save className="mr-1 h-3.5 w-3.5" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>

      <section className="border-r border-border">
        <ChatPanel
          projectId={project.id}
          files={files}
          onApplyFiles={applyFiles}
        />
      </section>

      <section className="grid grid-rows-[200px_1fr] border-r border-border">
        <div className="border-b border-border bg-card">
          <FileTree
            files={files}
            activePath={activePath}
            onSelect={onSelect}
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
      </section>

      <section>
        <WebContainerPreview files={files} />
      </section>
    </div>
  );
}
