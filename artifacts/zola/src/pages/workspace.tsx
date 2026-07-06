// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useProject } from "@/hooks/use-projects";
import { Workspace } from "@/components/workspace/workspace";
import type { ChatMessage, ProjectFile } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function WorkspacePage() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/projects/:id");
  const id = params?.id;
  const { data, isLoading, error } = useProject(id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!authLoading && !user) setLocation("/login");
  }, [user, authLoading, setLocation]);

  useEffect(() => {
    if (!id || !user) return;
    const sb = createSupabaseBrowserClient();
    sb.from("messages")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: true })
      .returns<ChatMessage[]>()
      .then(({ data }) => setMessages(data ?? []));
  }, [id, user]);

  if (authLoading || isLoading) {
    return (
      <main className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </main>
    );
  }

  if (error || !data?.project) {
    return (
      <main className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold">Project not found</p>
          <button
            type="button"
            onClick={() => setLocation("/projects")}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
          >
            Back to projects
          </button>
        </div>
      </main>
    );
  }

  return (
    <Workspace
      project={data.project}
      initialFiles={data.files as unknown as ProjectFile[]}
      initialMessages={messages}
    />
  );
}
