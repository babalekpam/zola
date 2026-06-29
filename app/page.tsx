import Link from "next/link";
import { ArrowRight, Code2, Cpu, Sparkles, Terminal } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function LandingPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const ctaHref = data.user ? "/projects" : "/signup";

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-20">
      <nav className="flex items-center justify-between pb-16">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-5 w-5 text-primary" /> Zola
        </div>
        <div className="flex items-center gap-3 text-sm">
          {data.user ? (
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
        <h1 className="text-5xl font-bold tracking-tight md:text-6xl">
          Build apps by chatting.
          <br />
          <span className="text-muted-foreground">
            Run them in the browser.
          </span>
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Zola is a Replit-style coding workspace where you describe what you
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

      <section className="mt-24 grid gap-6 md:grid-cols-3">
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
