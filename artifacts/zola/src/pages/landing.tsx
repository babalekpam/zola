// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Link } from "wouter";
import { ArrowRight, Code2, Cpu, Terminal, Sparkles, Zap } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function LandingPage() {
  const { user } = useAuth();
  const ctaHref = user ? "/projects" : "/signup";

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Nav — full width, borderless */}
      <nav className="flex items-center justify-between px-8 py-5">
        <Link href="/" className="flex items-center">
          <img src={`${import.meta.env.BASE_URL}loop-logo.png`} alt="loopafrica" className="h-8 w-auto" />
        </Link>
        <div className="hidden sm:flex items-center gap-8 text-sm text-muted-foreground">
          <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          <Link href="/about" className="hover:text-foreground transition-colors">About</Link>
          <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <Link href="/projects" className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Sign in
              </Link>
              <Link href="/signup" className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground">
                Get started
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero — centered */}
      <section className="flex flex-col items-center text-center px-6 pt-20 pb-16 sm:pt-28 sm:pb-20">
        <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <Zap className="h-3 w-3" /> Vibe-coding for the multi-LLM era
        </span>

        <h1 className="max-w-3xl text-4xl font-bold leading-[1.12] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          Loop is your AI coding agent for building ambitious apps.
        </h1>

        <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
          Describe what you want, pick your model, and watch it write the files — while a live Node.js preview runs right in your browser.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 font-medium text-primary-foreground text-sm hover:opacity-90 transition-opacity"
          >
            Start building <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-md border border-border px-6 py-2.5 font-medium text-foreground text-sm hover:bg-accent transition-colors"
          >
            See pricing
          </Link>
        </div>
      </section>

      {/* Product mock / visual */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {/* Fake IDE chrome */}
          <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
            <div className="h-3 w-3 rounded-full bg-muted" />
            <div className="h-3 w-3 rounded-full bg-muted" />
            <div className="h-3 w-3 rounded-full bg-muted" />
            <span className="ml-3 text-xs text-muted-foreground font-mono">Loop Workspace</span>
          </div>
          <div className="grid grid-cols-5 min-h-[300px] sm:min-h-[380px]">
            {/* Chat panel */}
            <div className="col-span-2 border-r border-border p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-4">
                <Sparkles className="h-3.5 w-3.5" /> Loop Chat
              </div>
              {[
                { role: "user", text: "Build a Pomodoro timer with dark mode" },
                { role: "ai", text: "Sure! I'll scaffold a Vite + React app with a 25-minute timer, pause/resume, and a dark mode toggle." },
                { role: "user", text: "Add a notification sound when time's up" },
                { role: "ai", text: "Done — I used the Web Audio API to play a subtle chime. Check the preview." },
              ].map((m, i) => (
                <div key={i} className={`rounded-lg px-3 py-2 text-xs ${m.role === "user" ? "bg-primary text-primary-foreground ml-4" : "bg-muted text-muted-foreground mr-4"}`}>
                  {m.text}
                </div>
              ))}
            </div>
            {/* Editor panel */}
            <div className="col-span-3 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 border-b border-border pb-2">
                <span className="rounded bg-muted px-2 py-0.5 font-mono">src/App.tsx</span>
              </div>
              <pre className="text-[11px] leading-relaxed font-mono text-muted-foreground overflow-hidden">
{`import { useState, useEffect } from 'react'

export default function Pomodoro() {
  const [time, setTime] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [dark, setDark] = useState(false)

  useEffect(() => {
    if (!running) return
    const t = setInterval(() =>
      setTime(s => s > 0 ? s - 1 : 0), 1000)
    return () => clearInterval(t)
  }, [running])

  const mm = String(Math.floor(time/60)).padStart(2,'0')
  const ss = String(time % 60).padStart(2,'0')

  return (
    <div className={dark ? 'dark' : ''}>
      <h1>{mm}:{ss}</h1>
      ...
    </div>
  )
}`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: <Cpu className="h-5 w-5" />,
              title: "Multi-LLM routing",
              body: "Claude, GPT-4o, Gemini, DeepSeek, and NVIDIA NIM — switch models mid-conversation without losing context.",
            },
            {
              icon: <Terminal className="h-5 w-5" />,
              title: "In-browser Node.js",
              body: "WebContainers run a full Node.js environment in WebAssembly. npm install, vite dev — all local, no cloud VM needed.",
            },
            {
              icon: <Code2 className="h-5 w-5" />,
              title: "Monaco editor",
              body: "The same editor that powers VS Code. Syntax highlighting, autocomplete, and keyboard shortcuts out of the box.",
            },
          ].map((card) => (
            <div key={card.title} className="rounded-xl border border-border bg-card p-6 space-y-3">
              <div className="text-muted-foreground">{card.icon}</div>
              <h3 className="font-semibold text-sm">{card.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-8 py-8">
        <div className="mx-auto max-w-5xl flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center">
            <img src={`${import.meta.env.BASE_URL}loop-logo.png`} alt="loopafrica" className="h-6 w-auto" />
          </div>
          <div className="flex flex-wrap gap-6">
            <Link href="/about" className="hover:text-foreground transition-colors">About</Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          </div>
          <span>© {new Date().getFullYear()} Argilette Lab</span>
        </div>
      </footer>
    </div>
  );
}
