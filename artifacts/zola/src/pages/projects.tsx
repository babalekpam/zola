// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Sparkles, Trash2, FolderOpen } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useProjects, useCreateProject, useDeleteProject } from "@/hooks/use-projects";
import { formatRelativeTime } from "@/lib/utils";
import type { Project } from "@/lib/types";

export default function ProjectsPage() {
  const { user, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const [creating, setCreating] = useState(false);

  if (!user) { setLocation("/login"); return null; }

  async function handleCreate() {
    setCreating(true);
    const project = await createProject.mutateAsync({ name: "Untitled project" });
    setCreating(false);
    setLocation(`/projects/${project.id}`);
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-5 w-5 text-primary" /> Loop
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/billing" className="text-muted-foreground hover:text-foreground">Billing</Link>
          <Link href="/account" className="text-muted-foreground hover:text-foreground">Account</Link>
          <button type="button" onClick={signOut} className="text-muted-foreground hover:text-foreground">Sign out</button>
        </div>
      </header>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Your projects</h1>
          <p className="text-sm text-muted-foreground">{projects?.length ?? 0} project{(projects?.length ?? 0) === 1 ? "" : "s"}</p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating || createProject.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> New project
        </button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : projects && projects.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onDelete={() => deleteProject.mutate(p.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState onNew={handleCreate} creating={creating} />
      )}
    </main>
  );
}

function ProjectCard({ project, onDelete }: { project: Project; onDelete: () => void }) {
  const [, setLocation] = useLocation();
  return (
    <div className="group relative rounded-xl border border-border bg-card p-6 space-y-3 hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setLocation(`/projects/${project.id}`)}>
      <div className="flex items-start justify-between">
        <FolderOpen className="h-5 w-5 text-muted-foreground" />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 rounded p-1 hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div>
        <h3 className="font-semibold truncate">{project.name}</h3>
        {project.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{project.description}</p>}
      </div>
      <p className="text-xs text-muted-foreground">{formatRelativeTime(project.updated_at)}</p>
    </div>
  );
}

function EmptyState({ onNew, creating }: { onNew: () => void; creating: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center">
      <Plus className="mb-3 h-8 w-8 text-muted-foreground" />
      <h3 className="text-lg font-semibold">No projects yet</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">Create your first project and ask Loop to build something.</p>
      <button onClick={onNew} disabled={creating} className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
        {creating ? "Creating…" : "Create first project"}
      </button>
    </div>
  );
}
