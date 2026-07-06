// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { Check, Loader2, Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { ModelPicker } from "./model-picker";
import { Button } from "@/components/ui/button";
import { DEFAULT_MODEL_ID } from "@/lib/ai/models";
import { parseFileBlocks, stripFileBlocks } from "@/lib/ai/parse-files";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";

interface Props {
  projectId: string;
  files: Record<string, string>;
  initialMessages?: ChatMessage[];
  onApplyFiles: (files: { path: string; content: string }[]) => void;
}

export function ChatPanel({
  projectId,
  files,
  initialMessages,
  onApplyFiles,
}: Props) {
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastAppliedRef = useRef<string>("");
  const autoSentRef = useRef(false);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    append,
    status,
    error,
  } = useChat({
    api: "/api/chat",
    body: { modelId, projectFiles: files, projectId },
    id: projectId,
    initialMessages: (initialMessages ?? [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    onError(err) {
      const msg = err.message ?? "Chat request failed";
      if (msg.toLowerCase().includes("rate limit")) {
        toast.error("Rate limit hit — wait a minute before sending more.");
      } else if (msg.toLowerCase().includes("unauthorized")) {
        toast.error("Session expired — please sign in again.");
      } else {
        toast.error(msg.slice(0, 200));
      }
    },
  });

  // Replit-style: if the user typed their idea on the landing page, kick off
  // the first build automatically the moment the workspace opens.
  useEffect(() => {
    if (autoSentRef.current) return;
    autoSentRef.current = true;
    const key = `loop:initial-prompt:${projectId}`;
    const pending = sessionStorage.getItem(key);
    if (pending && messages.length === 0) {
      sessionStorage.removeItem(key);
      void append({ role: "user", content: pending });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, status]);

  useEffect(() => {
    if (status !== "ready") return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    if (last.id === lastAppliedRef.current) return;
    const blocks = parseFileBlocks(last.content);
    if (blocks.length > 0) {
      lastAppliedRef.current = last.id;
      onApplyFiles(blocks);
    }
  }, [messages, status, onApplyFiles]);

  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" />
          Agent
        </div>
        <ModelPicker value={modelId} onChange={setModelId} />
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && !busy ? (
          <EmptyState />
        ) : (
          messages.map((m, i) => (
            <MessageBubble
              key={m.id}
              role={m.role}
              content={m.content}
              streaming={busy && i === messages.length - 1 && m.role === "assistant"}
            />
          ))
        )}
        {busy && messages[messages.length - 1]?.role !== "assistant" ? (
          <WorkingIndicator />
        ) : null}
        {error ? (
          <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-xs text-destructive">
            {error.message}
          </div>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-lg border border-border bg-card p-2">
          <textarea
            value={input}
            onChange={handleInputChange}
            placeholder="Describe what to build or change…"
            rows={2}
            className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <Button type="submit" size="icon" disabled={busy || !input.trim()}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function WorkingIndicator() {
  return (
    <div className="mr-8 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
      Thinking about your app…
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <Sparkles className="mb-3 h-8 w-8 text-primary" />
      <h2 className="text-lg font-semibold">What should we build?</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Describe an app — “a pomodoro timer with dark mode”, “a recipe
        finder”. The agent writes the code and your app appears on the right.
      </p>
    </div>
  );
}

function MessageBubble({
  role,
  content,
  streaming,
}: {
  role: string;
  content: string;
  streaming?: boolean;
}) {
  const blocks = role === "assistant" ? parseFileBlocks(content) : [];
  const prose = role === "assistant" ? stripFileBlocks(content) : content;
  return (
    <div
      className={cn(
        "rounded-lg px-3 py-2 text-sm",
        role === "user"
          ? "ml-8 bg-accent"
          : "mr-8 border border-border bg-card",
      )}
    >
      <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        {role === "user" ? "You" : "Agent"}
        {streaming ? (
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
        ) : null}
      </div>
      <div className="prose prose-sm prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{prose}</ReactMarkdown>
      </div>
      {blocks.length > 0 ? (
        <div className="mt-2 space-y-1">
          {blocks.map((b) => (
            <div
              key={b.path}
              className="flex items-center gap-1.5 rounded bg-muted px-2 py-1 font-mono text-[11px]"
            >
              {streaming ? (
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
              ) : (
                <Check className="h-3 w-3 text-green-500" />
              )}
              {b.path}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
