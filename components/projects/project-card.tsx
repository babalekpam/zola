// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { Project } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";

export function ProjectCard({ project }: { project: Project }) {
  const router = useRouter();

  async function onDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${project.name}"?`)) return;
    await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group relative block rounded-xl border border-border bg-card p-5 transition-colors hover:border-accent"
    >
      <div className="flex items-start justify-between">
        <h3 className="line-clamp-1 text-base font-semibold">{project.name}</h3>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete project"
          className="rounded p-1 text-muted-foreground opacity-0 transition hover:bg-accent hover:text-destructive group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {project.description ? (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {project.description}
        </p>
      ) : null}
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>{project.default_model}</span>
        <span>{formatRelativeTime(project.updated_at)}</span>
      </div>
    </Link>
  );
}