// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";

const SUGGESTIONS = [
  "A landing page for a coffee shop",
  "A todo app with dark mode",
  "A personal portfolio site",
  "A quiz game about geography",
];

function deriveProjectName(prompt: string): string {
  const words = prompt.trim().split(/\s+/).slice(0, 6).join(" ");
  return words.length > 2 ? words : "New app";
}

export function PromptBox({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (!signedIn) {
      sessionStorage.setItem("loop:pending-prompt", trimmed);
      router.push("/signup");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: deriveProjectName(trimmed) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not create project");
      sessionStorage.setItem(`loop:initial-prompt:${json.project.id}`, trimmed);
      router.push(`/projects/${json.project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setCreating(false);
    }
  }

  return (
    <div className="w-full max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void start(prompt);
        }}
        className="rounded-2xl border border-border bg-card p-3 shadow-lg focus-within:ring-2 focus-within:ring-ring"
      >
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void start(prompt);
            }
          }}
          placeholder="Describe an app or site you want to build…"
          rows={3}
          className="w-full resize-none bg-transparent px-2 py-1 text-base outline-none placeholder:text-muted-foreground"
          disabled={creating}
        />
        <div className="flex items-center justify-between pt-2">
          <span className="px-2 text-[11px] text-muted-foreground">
            Powered by Claude · press Enter to start
          </span>
          <button
            type="submit"
            disabled={creating || !prompt.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
          >
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Creating…
              </>
            ) : (
              <>
                Start building <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setPrompt(s)}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
