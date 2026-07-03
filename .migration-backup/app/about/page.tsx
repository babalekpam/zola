// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import Link from "next/link";
import { Sparkles, Code2, Cpu, Globe } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About · Zola by Argilette Lab",
  description:
    "Zola is a multi-LLM vibe-coding platform built by Argilette Lab. Chat, edit, and preview web apps in the browser.",
};

export default function AboutPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <nav className="mb-12 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-5 w-5 text-primary" /> Zola
        </Link>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Home
        </Link>
      </nav>

      <h1 className="text-4xl font-bold tracking-tight">
        Vibe coding for the multi-LLM era.
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Zola is an AI coding workspace built by{" "}
        <strong className="text-foreground">Argilette Lab</strong>. It lets you
        describe what you want, the model writes the files, and a live preview
        boots in the browser — no installs, no cloud sandbox bills.
      </p>

      <section className="mt-12 grid gap-6 md:grid-cols-3">
        <Card
          icon={<Cpu className="h-5 w-5" />}
          title="Model-agnostic"
          body="Switch between Claude, GPT, Gemini, NVIDIA NIM, and OpenRouter on the fly. Pick the right tool per task."
        />
        <Card
          icon={<Code2 className="h-5 w-5" />}
          title="Real IDE"
          body="Monaco editor, file tree, project persistence. Edit alongside the agent — not just chat-and-pray."
        />
        <Card
          icon={<Globe className="h-5 w-5" />}
          title="Runs in your browser"
          body="WebContainers boot a Node.js sandbox client-side. Your code, your machine. Nothing leaves except your prompts."
        />
      </section>

      <section className="mt-16 space-y-4 text-sm text-muted-foreground">
        <h2 className="text-xl font-semibold text-foreground">
          About Argilette Lab
        </h2>
        <p>
          Argilette Lab is an independent product studio focused on AI-native
          developer tools. We believe coding is being unbundled — from typing
          syntax in an editor to describing intent and reviewing output — and
          the tooling needs to catch up.
        </p>
        <p>
          Zola is our take on what a Replit successor should feel like when
          frontier models do most of the keyboarding.
        </p>
      </section>

      <section className="mt-16 rounded-xl border border-border bg-card p-6">
        <h2 className="text-xl font-semibold">Open source</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The Zola codebase is MIT-licensed. Fork it, run it, modify it. Find us
          on GitHub.
        </p>
        <Link
          href="https://github.com/babalekpam/zola"
          className="mt-3 inline-flex items-center gap-1 text-sm text-foreground underline"
          target="_blank"
          rel="noreferrer"
        >
          github.com/babalekpam/zola
        </Link>
      </section>

      <footer className="mt-16 border-t border-border pt-6 text-xs text-muted-foreground">
        © 2026 Argilette Lab. All rights reserved.
      </footer>
    </main>
  );
}

function Card({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md bg-accent text-primary">
        {icon}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
