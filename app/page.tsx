// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import Link from "next/link";
import { ArrowRight, Code2, Cpu, Sparkles, Terminal } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  const ctaHref = signedIn ? "/projects" : "/signup";

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10 sm:py-20">
      <nav className="flex flex-wrap items-center justify-between gap-3 pb-10 sm:pb-16">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-5 w-5 text-primary" /> Loop
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

      <section className="space-y-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" /> Vibe-coding for the multi-LLM era
        </span>
        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
          Build apps by chatting.
          <br />
          <span className="text-muted-foreground">
            Run them in the browser.
          </span>
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Loop is a Replit-style coding workspace where you describe what you
          want, the model writes the files, and a live preview boots in the
          browser. Switch between Claude, GPT, Gemini, and OpenRouter models on
          the fly.
        </p>
        <div>
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 font-medium text-primary-foreground"
          >
            Start building <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
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