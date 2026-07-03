// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Link } from "wouter";
import { ArrowRight, Code2, Cpu, Sparkles, Terminal } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function LandingPage() {
  const { user } = useAuth();
  const ctaHref = user ? "/projects" : "/signup";

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10 sm:py-20">
      <nav className="flex flex-wrap items-center justify-between gap-3 pb-10 sm:pb-16">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-5 w-5 text-primary" /> Zola
          <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
            by Argilette Lab
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/pricing" className="text-muted-foreground hover:text-foreground">Pricing</Link>
          <Link href="/about" className="hidden text-muted-foreground hover:text-foreground sm:inline">About</Link>
          {user ? (
            <Link href="/projects" className="text-muted-foreground hover:text-foreground">My projects</Link>
          ) : (
            <>
              <Link href="/login" className="text-muted-foreground hover:text-foreground">Sign in</Link>
              <Link href="/signup" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">Get started</Link>
            </>
          )}
        </div>
      </nav>

      <section className="space-y-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" /> Vibe-coding for the multi-LLM era
        </span>
        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
          Build apps by chatting.<br />
          <span className="text-muted-foreground">Run them in the browser.</span>
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Zola is a coding workspace where you describe what you want, the model writes the files, and a live preview boots in your browser — no servers, no deploys, no waiting.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={ctaHref} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 font-medium text-primary-foreground">
            Start building <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/pricing" className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-2.5 font-medium text-foreground hover:bg-accent">
            See pricing
          </Link>
        </div>
      </section>

      <section className="mt-24 grid gap-6 sm:grid-cols-3">
        {[
          { icon: <Cpu className="h-5 w-5 text-primary" />, title: "Multi-LLM routing", body: "Claude, GPT, Gemini, DeepSeek, Kimi K2, and NVIDIA NIM — switch mid-conversation." },
          { icon: <Terminal className="h-5 w-5 text-primary" />, title: "In-browser Node.js", body: "WebContainers run a full Node.js environment. npm install, vite dev — all local, no cloud VM." },
          { icon: <Code2 className="h-5 w-5 text-primary" />, title: "Monaco editor", body: "The same editor that powers VS Code. Syntax highlighting, autocomplete, keyboard shortcuts." },
        ].map((card) => (
          <div key={card.title} className="rounded-xl border border-border bg-card p-6 space-y-3">
            {card.icon}
            <h3 className="font-semibold">{card.title}</h3>
            <p className="text-sm text-muted-foreground">{card.body}</p>
          </div>
        ))}
      </section>

      <footer className="mt-24 flex flex-wrap gap-4 border-t border-border pt-8 text-sm text-muted-foreground">
        <Link href="/about" className="hover:text-foreground">About</Link>
        <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
        <Link href="/contact" className="hover:text-foreground">Contact</Link>
        <Link href="/terms" className="hover:text-foreground">Terms</Link>
        <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
        <span className="ml-auto">© {new Date().getFullYear()} Argilette Lab</span>
      </footer>
    </main>
  );
}
