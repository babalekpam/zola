// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Link } from "wouter";
import {
  ArrowRight,
  Blocks,
  BookOpen,
  Cpu,
  GraduationCap,
  Rocket,
  Sparkles,
  Wrench,
} from "lucide-react";
import { DashboardShell, PageHeader } from "@/components/dashboard/dashboard-shell";
import { RequireAuth } from "@/components/dashboard/require-auth";

interface Track {
  icon: typeof Rocket;
  title: string;
  minutes: number;
  summary: string;
  steps: string[];
  cta: { label: string; href: string };
}

/**
 * Each track ends somewhere real in the product. "Learn" pages that only link
 * to more reading don't teach anything — the last step is always something the
 * reader does in their own workspace.
 */
const TRACKS: Track[] = [
  {
    icon: Rocket,
    title: "Ship your first app",
    minutes: 10,
    summary:
      "From a one-line prompt to a public URL, without leaving the browser.",
    steps: [
      "Describe the app on the home screen — one sentence is enough to start.",
      "Press Run and watch it boot in the Webview tab.",
      "Ask for a change in chat; the diff is applied to your files, with a checkpoint saved first.",
      "Open the Publishing tab and publish. You get a live URL immediately.",
    ],
    cta: { label: "Start a project", href: "/projects" },
  },
  {
    icon: Cpu,
    title: "Get better answers from Loop",
    minutes: 8,
    summary:
      "Model routing, Plan mode and Swarm mode — when each one is the right tool.",
    steps: [
      "Leave the picker on Auto: each message is classified and sent to the best available model.",
      "Turn on Plan mode before anything structural — you get a plan to argue with instead of a diff to undo.",
      "Use Swarm mode for wide, separable work: several specialists edit disjoint files in parallel.",
      "Check the AI Console to see which models are actually available and what you've spent.",
    ],
    cta: { label: "Open the AI Console", href: "/ai-console" },
  },
  {
    icon: Blocks,
    title: "Connect your real services",
    minutes: 12,
    summary:
      "Give the agent — and the app you're building — access to the tools you already use.",
    steps: [
      "Connect a service on the Integrations page. Rube is the widest single connection: one Composio key, 500+ apps.",
      "Attach it to a project: the credentials land in Secrets, and the MCP server is registered for you.",
      "Open the project's MCP tab and hit Test connection to see the tools Loop can now call.",
      "Ask Loop something that needs the service — it will call the tool instead of guessing.",
    ],
    cta: { label: "Browse integrations", href: "/integrations" },
  },
  {
    icon: Wrench,
    title: "Teach Loop your conventions",
    minutes: 6,
    summary:
      "Skills turn 'remember to always…' into something the agent applies on its own.",
    steps: [
      "Open the Skills tab in a project and create a skill — a name, when to use it, and the instructions.",
      "Keep each skill narrow: brand voice, API conventions, and testing rules are three skills, not one.",
      "Skills live at .skills/<name>/SKILL.md, so they're versioned with the code and editable like any file.",
      "Ask Loop to write a skill for a convention it just learned — it can create the file itself.",
    ],
    cta: { label: "Read the Skills docs", href: "/docs#skills" },
  },
  {
    icon: Sparkles,
    title: "Go to production",
    minutes: 10,
    summary: "Secrets, custom domains, monitoring and the security checks worth doing.",
    steps: [
      "Move every key into Secrets. Only VITE_-prefixed values reach the browser bundle.",
      "Run the project's Security tab scan — it looks for keys committed into files and other risky patterns.",
      "Add a custom domain in the Deploy tab: TXT challenge to verify, CNAME to serve.",
      "Watch traffic in Monitoring, and review what's public from the account Security page.",
    ],
    cta: { label: "Review security", href: "/security" },
  },
];

function LearnBody() {
  return (
    <div className="mx-auto max-w-4xl px-6 pb-16 pt-10">
      <PageHeader
        title="Learn"
        description="Short tracks that each end with something working in your own workspace."
      />

      <div className="space-y-4">
        {TRACKS.map((track) => (
          <article key={track.title} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <track.icon className="h-4 w-4 text-primary" />
                  {track.title}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">{track.summary}</p>
              </div>
              <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                {track.minutes} min
              </span>
            </div>

            <ol className="mt-3 space-y-1.5">
              {track.steps.map((step, i) => (
                <li key={i} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-foreground">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>

            <Link
              href={track.cta.href}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {track.cta.label} <ArrowRight className="h-3 w-3" />
            </Link>
          </article>
        ))}
      </div>

      <div className="mt-8 flex items-start gap-3 rounded-xl border border-border bg-card p-4">
        <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="text-xs text-muted-foreground">
          Prefer to read it all at once? The{" "}
          <Link href="/docs" className="inline-flex items-center gap-1 underline hover:text-foreground">
            <BookOpen className="h-3 w-3" /> documentation
          </Link>{" "}
          covers the same ground as reference rather than as a walkthrough.
        </div>
      </div>
    </div>
  );
}

export default function LearnPage() {
  return (
    <RequireAuth>
      {() => (
        <DashboardShell active="Learn">
          <LearnBody />
        </DashboardShell>
      )}
    </RequireAuth>
  );
}
