// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { notFound } from "next/navigation";
import { Workspace } from "@/components/workspace/workspace";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Project, ProjectFile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single<Project>();
  if (!project) notFound();

  const { data: files } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", id)
    .returns<ProjectFile[]>();

  return <Workspace project={project} initialFiles={files ?? []} />;
}