// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
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
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

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
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" />
          Zola Chat
        </div>
        <ModelPicker value={modelId} onChange={setModelId} />
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map((m) => (
            <MessageBubble key={m.id} role={m.role} content={m.content} />
          ))
        )}
        {error ? (
          <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-xs text-destructive">
            {error.message}
          </div>
        ) : null}
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-border p-3"
      >
        <div className="flex items-end gap-2 rounded-lg border border-border bg-card p-2">
          <textarea
            value={input}
            onChange={handleInputChange}
            placeholder="Ask Zola to build, refactor, or fix something…"
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
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <Sparkles className="mb-3 h-8 w-8 text-primary" />
      <h2 className="text-lg font-semibold">Vibe-code your next idea</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Try “Build a Pomodoro timer with dark mode” or “Add a navbar with React
        Router”. Zola will write the files and the preview will reload.
      </p>
    </div>
  );
}

function MessageBubble({ role, content }: { role: string; content: string }) {
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
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {role}
      </div>
      <div className="prose prose-sm prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{prose}</ReactMarkdown>
      </div>
      {blocks.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {blocks.map((b) => (
            <span
              key={b.path}
              className="rounded bg-muted px-2 py-0.5 font-mono text-[10px]"
            >
              {b.path}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}