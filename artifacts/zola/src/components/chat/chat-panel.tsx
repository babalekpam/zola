// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { Send, Sparkles, Mic } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { ModelPicker } from "./model-picker";
import { DEFAULT_MODEL_ID } from "@/lib/ai/models";
import { parseFileBlocks, stripFileBlocks } from "@/lib/ai/parse-files";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";

const API_URL = import.meta.env.VITE_API_URL ?? "";

interface Props {
  projectId: string;
  files: Record<string, string>;
  initialMessages?: ChatMessage[];
  onApplyFiles: (files: { path: string; content: string }[]) => void;
}

export function ChatPanel({ projectId, files, initialMessages, onApplyFiles }: Props) {
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [planMode, setPlanMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("loop_plan_mode") !== "false";
  });
  const [swarmMode, setSwarmMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("loop_swarm_mode") === "true";
  });
  const [recording, setRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastAppliedRef = useRef<string>("");
  const recognitionRef = useRef<any>(null);
  const baseInputRef = useRef("");
  const finalRef = useRef("");

  useEffect(() => {
    localStorage.setItem("loop_plan_mode", String(planMode));
  }, [planMode]);

  useEffect(() => {
    localStorage.setItem("loop_swarm_mode", String(swarmMode));
  }, [swarmMode]);

  const { messages, input, setInput, handleInputChange, handleSubmit, status, error } = useChat({
    api: `${API_URL}/api/chat`,
    body: { modelId, projectFiles: files, projectId, planMode, swarmMode },
    id: projectId,
    credentials: "include",
    initialMessages: (initialMessages ?? [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content })),
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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (status !== "ready") return;
    if (planMode) return; // Plan mode never writes files, even if the model emits blocks.
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    if (last.id === lastAppliedRef.current) return;
    const blocks = parseFileBlocks(last.content);
    if (blocks.length > 0) {
      lastAppliedRef.current = last.id;
      onApplyFiles(blocks);
    }
  }, [messages, status, onApplyFiles, planMode]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  function toggleMic() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Voice input isn't supported in this browser.");
      return;
    }
    if (recording) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    baseInputRef.current = input.trim();
    finalRef.current = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const seg = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalRef.current += seg;
        else interim += seg;
      }
      const spoken = (finalRef.current + interim).trim();
      setInput([baseInputRef.current, spoken].filter(Boolean).join(" "));
    };
    rec.onerror = () => {
      setRecording(false);
      toast.error("Voice input failed. Try again.");
    };
    rec.onend = () => setRecording(false);
    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
  }

  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <img src={`${import.meta.env.BASE_URL}loop-mark.png`} alt="Loop" className="h-5 w-5" />
          Loop Chat
        </div>
        <ModelPicker value={modelId} onChange={setModelId} />
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <EmptyState planMode={planMode} />
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
        {busy && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="animate-pulse">Loop is thinking…</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-border p-3">
        <div className="rounded-lg border border-border bg-card p-2">
          <textarea
            value={input}
            onChange={handleInputChange}
            placeholder={
              planMode
                ? "Describe what you want — Loop will plan it out…"
                : "Ask Loop to build, refactor, or fix something…"
            }
            rows={2}
            className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPlanMode((p) => !p)}
                aria-pressed={planMode}
                title={
                  planMode
                    ? "Plan mode — Loop drafts a plan instead of writing code. Turn off to build."
                    : "Build mode — Loop writes the code. Turn on Plan to draft an approach first."
                }
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  planMode
                    ? "border-blue-500 bg-blue-500/10 text-foreground ring-1 ring-blue-500"
                    : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full border",
                    planMode ? "border-blue-500 bg-blue-500" : "border-current",
                  )}
                />
                Plan
              </button>
              <button
                type="button"
                onClick={() => setSwarmMode((v) => !v)}
                aria-pressed={swarmMode}
                title={
                  swarmMode
                    ? "Swarm mode — an architect splits the work across parallel specialist agents, each on the best model for its task. Turn off for a single agent."
                    : "Single agent. Turn on Swarm to fan the work out across parallel specialist agents for big builds."
                }
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  swarmMode
                    ? "border-amber-500 bg-amber-500/10 text-foreground ring-1 ring-amber-500"
                    : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                🐝 Swarm
              </button>
              <button
                type="button"
                onClick={toggleMic}
                title="Voice input"
                aria-pressed={recording}
                className={cn(
                  "rounded-md p-1.5 transition-colors",
                  recording
                    ? "bg-red-500/10 text-red-500"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                <Mic className="h-4 w-4" />
              </button>
            </div>
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-md bg-primary p-2 text-primary-foreground disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function EmptyState({ planMode }: { planMode: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
      <Sparkles className="mb-3 h-8 w-8 text-primary" />
      <h2 className="text-lg font-semibold">Vibe-code your next idea</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Try "Build a Pomodoro timer with dark mode" or "Add a navbar with React Router".
        {planMode
          ? " Plan mode is on — Loop drafts an approach first. Turn it off to have Loop write the files."
          : " Loop will write the files and the preview will reload."}
      </p>
    </div>
  );
}

function MessageBubble({ role, content }: { role: string; content: string }) {
  const blocks = role === "assistant" ? parseFileBlocks(content) : [];
  const prose = role === "assistant" ? stripFileBlocks(content) : content;
  return (
    <div className={cn(
      "rounded-lg px-3 py-2 text-sm",
      role === "user" ? "ml-8 bg-accent" : "mr-8 border border-border bg-card",
    )}>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{role}</div>
      <div className="prose prose-sm prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{prose}</ReactMarkdown>
      </div>
      {blocks.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {blocks.map((b) => (
            <span key={b.path} className="rounded bg-muted px-2 py-0.5 font-mono text-[10px]">{b.path}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
