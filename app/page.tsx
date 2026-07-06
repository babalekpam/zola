// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import Link from "next/link";
import { Code2, Cpu, Sparkles, Terminal } from "lucide-react";
import { LoopLogo } from "@/components/brand/logo";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PromptBox } from "@/components/home/prompt-box";

export default async function LandingPage() {
  let signedIn = false;
  try {
    if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase.auth.getUser();
      signedIn = !!data.user;
    }
  } catch {
    // Supabase unreachable or misconfigured — still render the landing page.
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10 sm:py-20">
      <nav className="flex flex-wrap items-center justify-between gap-3 pb-10 sm:pb-16">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <LoopLogo markClassName="h-6 w-6" />
          <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
            by Argilette Lab
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link
            href="/pricing"
            className="text-muted-foreground hover:text-foreground"
          >
            Pricing
          </Link>
          <Link
            href="/about"
            className="hidden text-muted-foreground hover:text-foreground sm:inline"
          >
            About
          </Link>
          {signedIn ? (
            <Link href="/projects" className="text-muted-foreground hover:text-foreground">
              My projects
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-muted-foreground hover:text-foreground"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </nav>

      <section className="flex flex-col items-center space-y-8 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" /> Powered by Claude · multi-LLM under the hood
        </span>
        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
          Turn your idea into an app.
          <br />
          <span className="text-muted-foreground">Just describe it.</span>
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Type what you want to build. Loop writes the code and runs it live in
          your browser — no setup, no installs. Refine it by chatting.
        </p>
        <PromptBox signedIn={signedIn} />
      </section>

      <section className="mt-16 grid gap-6 sm:mt-24 md:grid-cols-3">
        <Feature
          icon={<Cpu className="h-5 w-5" />}
          title="Multi-LLM router"
          body="Claude Opus/Sonnet/Haiku, GPT-5, Gemini 2.5, plus Kimi, DeepSeek, and Llama via OpenRouter. Pick the best model per task."
        />
        <Feature
          icon={<Code2 className="h-5 w-5" />}
          title="Monaco editor + file tree"
          body="A real IDE in the browser. The agent edits files; you can tweak them by hand."
        />
        <Feature
          icon={<Terminal className="h-5 w-5" />}
          title="Live preview"
          body="WebContainers boot a Node.js sandbox in the browser. Vite + React projects run with npm install and hot reload."
        />
      </section>

      <footer className="mt-24 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-8 text-xs text-muted-foreground">
        <span>© 2026 Argilette Lab. All rights reserved.</span>
        <span className="flex flex-wrap items-center gap-4">
          <Link href="/about" className="hover:text-foreground">
            About
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="/contact" className="hover:text-foreground">
            Contact
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <span>MIT License</span>
        </span>
      </footer>
    </main>
  );
}

function Feature({
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