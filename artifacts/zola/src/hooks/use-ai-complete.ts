// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
const API = import.meta.env.VITE_API_URL ?? "";

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

/** Error carrying the HTTP status so the editor can react to 402 (no AI on
 *  this plan) and 429 (burst limit) instead of retrying on every keystroke. */
export class AiHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AiHttpError";
  }
}

async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new AiHttpError(data.error ?? res.statusText, res.status);
  }
  return res.json() as Promise<T>;
}

// Plain non-streaming JSON: ghost text renders as one atomic snippet and a
// completion fires per typing-pause, so a data stream buys nothing here.
export async function fetchCompletion(
  req: AiCompleteRequest,
  signal?: AbortSignal,
): Promise<string> {
  const data = await postJson<{ completion: string }>("/api/ai/complete", req, signal);
  return data.completion;
}

export async function fetchInlineEdit(req: InlineEditRequest): Promise<string> {
  const data = await postJson<{ code: string }>("/api/ai/inline-edit", req);
  return data.code;
}
