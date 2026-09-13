// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { apiFetch } from "@/hooks/use-projects";

export interface AiCompleteRequest {
  prefix: string;
  suffix: string;
  language: string;
  projectId?: string;
}

export interface InlineEditRequest {
  code: string;
  instruction: string;
  language: string;
  projectId?: string;
}

// Plain non-streaming JSON: ghost text renders as one atomic snippet and a
// completion fires per typing-pause, so a data stream buys nothing here.
export async function fetchCompletion(
  req: AiCompleteRequest,
  signal?: AbortSignal,
): Promise<string> {
  const data = await apiFetch<{ completion: string }>("/api/ai/complete", {
    method: "POST",
    body: JSON.stringify(req),
    ...(signal ? { signal } : {}),
  });
  return data.completion;
}

export async function fetchInlineEdit(req: InlineEditRequest): Promise<string> {
  const data = await apiFetch<{ code: string }>("/api/ai/inline-edit", {
    method: "POST",
    body: JSON.stringify(req),
  });
  return data.code;
}
