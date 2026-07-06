// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useProjects, useCreateProject, useDeleteProject } from "@/hooks/use-projects";
import { HomeDashboard } from "@/components/home/home-dashboard";

export default function ProjectsPage() {
  const { user, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const [creating, setCreating] = useState(false);

  if (!user) { setLocation("/login"); return null; }

  const userName =
    (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    user.email?.split("@")[0] ??
    "there";

  async function handleCreate(prompt?: string) {
    if (creating) return;
    setCreating(true);
    const name = prompt?.trim() ? prompt.trim().slice(0, 60) : "Untitled project";
    try {
      const project = await createProject.mutateAsync({ name });
      setLocation(`/projects/${project.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <HomeDashboard
      userName={userName}
      userId={user.id}
      projects={projects}
      isLoading={isLoading}
      creating={creating || createProject.isPending}
      onCreate={handleCreate}
      onOpenProject={(id) => setLocation(`/projects/${id}`)}
      onDeleteProject={(id) => deleteProject.mutate(id)}
      onSignOut={signOut}
    />
  );
}
