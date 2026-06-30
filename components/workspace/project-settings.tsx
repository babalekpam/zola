// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MODELS } from "@/lib/ai/models";
import type { Project } from "@/lib/types";

interface Props {
  project: Project;
}

export function ProjectSettings({ project }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [defaultModel, setDefaultModel] = useState(project.default_model);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, description, default_model: defaultModel }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Could not save");
      return;
    }
    toast.success("Project settings saved");
    setOpen(false);
    router.refresh();
  }

  async function remove() {
    if (
      !confirm(
        `Delete "${project.name}" and all its files & chat history? This cannot be undone.`,
      )
    )
      return;
    setDeleting(true);
    const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      toast.error("Could not delete project");
      return;
    }
    toast.success("Project deleted");
    router.push("/projects");
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        aria-label="Project settings"
      >
        <Settings className="h-3.5 w-3.5" />
      </Button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Project settings</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-muted-foreground">Name</span>
                <input
                  className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-xs text-muted-foreground">Description</span>
                <textarea
                  className="mt-1 w-full resize-none rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-xs text-muted-foreground">
                  Default model
                </span>
                <select
                  className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                >
                  {MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-5 flex justify-between">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void remove()}
                disabled={deleting}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                {deleting ? "Deleting…" : "Delete project"}
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={() => void save()} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
