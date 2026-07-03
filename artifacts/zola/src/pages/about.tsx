// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Link } from "wouter";
import { ArrowLeft, Sparkles } from "lucide-react";

export default function AboutPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <header className="mb-10 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-5 w-5 text-primary" /> Loop
        </Link>
        <Link href="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </header>
      <article className="prose prose-invert max-w-none">
        <h1>About Loop</h1>
        <p>
          Loop is a vibe-coding workspace built by <strong>Argilette Lab</strong>. It lets you describe
          what you want in plain English and have a frontier AI model write the code, while a live
          Node.js sandbox (powered by WebContainers) runs it instantly in your browser.
        </p>
        <h2>Why Loop?</h2>
        <p>
          Most AI coding tools force you to pick one model. Loop routes your chat to whichever
          model is best for your task — Claude for reasoning, GPT for general work, Gemini for long
          context, NVIDIA NIM for open-weight models — without switching tabs.
        </p>
        <h2>The tech</h2>
        <ul>
          <li><strong>WebContainers</strong> — a full Node.js environment running in WebAssembly in your browser.</li>
          <li><strong>Monaco editor</strong> — the same editor that powers VS Code.</li>
          <li><strong>Vercel AI SDK</strong> — streaming chat with multi-LLM support.</li>
          <li><strong>Supabase</strong> — auth and project storage.</li>
        </ul>
        <h2>Contact</h2>
        <p>
          Questions? Reach us at <a href="mailto:hello@argilette.com">hello@argilette.com</a> or
          file an issue on GitHub.
        </p>
      </article>
    </main>
  );
}
