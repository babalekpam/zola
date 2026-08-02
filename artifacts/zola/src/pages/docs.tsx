// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardShell, PageHeader } from "@/components/dashboard/dashboard-shell";
import { RequireAuth } from "@/components/dashboard/require-auth";

interface DocSection {
  id: string;
  title: string;
  body: ReactNode;
}

function P({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{children}</p>;
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-muted px-1 py-0.5 text-[12px]">{children}</code>;
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mb-3 space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

const SECTIONS: DocSection[] = [
  {
    id: "quickstart",
    title: "Quickstart",
    body: (
      <>
        <P>
          Describe what you want on the home screen and press enter. Loop scaffolds a
          project, the app boots in an in-browser Node sandbox, and the preview appears in
          the Webview tab. From there you keep talking to it — every message can read and
          rewrite any file in the project.
        </P>
        <Bullets
          items={[
            <>
              <strong className="text-foreground">Run / Stop / Restart</strong> control the
              dev server. The sandbox is per-page, so switching tabs never restarts it.
            </>,
            <>
              A <strong className="text-foreground">checkpoint</strong> of every file is
              saved before each AI edit — the History tab rolls any change back.
            </>,
            <>
              Nothing installs on your machine: the runtime, the shell and the build all
              happen in the browser.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: "workspace",
    title: "The workspace",
    body: (
      <>
        <P>
          The right-hand pane holds one tool at a time; the tools list under the file tree
          switches between them. Panes stay alive once opened, so a running shell or a
          scrolled console survives a tab switch.
        </P>
        <Bullets
          items={[
            <>
              <strong className="text-foreground">Webview</strong> — the live app with an
              address bar.
            </>,
            <>
              <strong className="text-foreground">Console</strong> — dev server output.
            </>,
            <>
              <strong className="text-foreground">Shell</strong> — a real interactive shell
              inside the sandbox.
            </>,
            <>
              <strong className="text-foreground">Secrets</strong> — env vars injected into
              the dev server and shell.
            </>,
            <>
              <strong className="text-foreground">Integrations</strong> and{" "}
              <strong className="text-foreground">MCP</strong> — connected services and the
              tool servers the agent can call.
            </>,
            <>
              <strong className="text-foreground">Database</strong> — a key-value store the
              running app reaches over HTTP.
            </>,
            <>
              <strong className="text-foreground">History</strong>,{" "}
              <strong className="text-foreground">Publishing</strong>,{" "}
              <strong className="text-foreground">Domains</strong>,{" "}
              <strong className="text-foreground">Monitoring</strong>,{" "}
              <strong className="text-foreground">Security</strong>,{" "}
              <strong className="text-foreground">Skills</strong>,{" "}
              <strong className="text-foreground">Git</strong>.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: "chat",
    title: "Chat, models and modes",
    body: (
      <>
        <P>
          The model picker sits in the chat box. Leaving it on <Code>Auto</Code> classifies
          each message — design, code, planning or a quick fix — and routes it to the best
          model that's currently available. The{" "}
          <Link href="/ai-console" className="underline hover:text-foreground">
            AI Console
          </Link>{" "}
          shows that table and your usage against the monthly budget.
        </P>
        <Bullets
          items={[
            <>
              <strong className="text-foreground">Plan mode</strong> — Loop writes a plan
              instead of code. Good before a big change.
            </>,
            <>
              <strong className="text-foreground">Swarm mode (🐝)</strong> — an architect
              model splits the work into up to four parallel specialists with disjoint file
              ownership, then merges the results.
            </>,
            <>
              AI runs on platform keys, so there's no key to bring — usage is metered
              against your plan instead.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: "integrations",
    title: "Integrations",
    body: (
      <>
        <P>
          Connect a service once on the{" "}
          <Link href="/integrations" className="underline hover:text-foreground">
            Integrations page
          </Link>
          , then attach it to any project. Attaching does two things: it writes the
          credentials into that project's Secrets under conventional env var names (so the
          app you're building can use them), and — when the service ships an MCP server —
          registers that server so Loop can call its tools while it works.
        </P>
        <P>
          Detaching removes the MCP server but leaves the secrets, because your code may
          already reference them. Delete them from the Secrets tab when you're sure.
        </P>
      </>
    ),
  },
  {
    id: "mcp",
    title: "MCP servers",
    body: (
      <>
        <P>
          MCP (Model Context Protocol) is how Loop reaches things outside your project. A
          project's MCP tab lists its servers; anything enabled there is connected at the
          start of each message, and its tools are offered to the model for that turn.
        </P>
        <Bullets
          items={[
            <>
              Add from the catalog (Rube, GitHub, Supabase, Stripe, Linear, Notion, Sentry,
              Context7, DeepWiki and more) or paste any server's URL yourself.
            </>,
            <>
              <strong className="text-foreground">Rube</strong> is the broad one: a single
              Composio key exposes tools for 500+ apps.
            </>,
            <>
              <strong className="text-foreground">Test connection</strong> dials the server
              with your stored credentials and lists the tools it advertises — the fastest
              way to check a key is still good.
            </>,
            <>
              Servers must be <Code>https</Code> and can't point at private addresses.
              Credentials are stored server-side and never sent back to the browser.
            </>,
            <>
              Limits: 10 servers per project, 40 tools per server, 80 tools per message and
              8 tool rounds per turn — enough for read → act → confirm without runaway
              loops.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: "skills",
    title: "Agent Skills",
    body: (
      <>
        <P>
          Skills are reusable instruction packs Loop follows whenever a request matches
          them — brand voice, coding conventions, domain rules. They live in the project at{" "}
          <Code>.skills/&lt;name&gt;/SKILL.md</Code> with a small frontmatter block naming
          the skill and when to use it, so they're versioned with your code and editable
          like any other file.
        </P>
        <P>
          Create them from the Skills tab, or just ask Loop to remember a convention and it
          will write the file itself.
        </P>
      </>
    ),
  },
  {
    id: "secrets-db",
    title: "Secrets and the app database",
    body: (
      <>
        <P>
          Secrets are injected into the dev server and shell as environment variables.
          Client-side code only ever sees the ones prefixed <Code>VITE_</Code> — that's a
          Vite rule, and it's what stops a server key ending up in your bundle. You can
          paste a whole <Code>.env</Code> to import several at once.
        </P>
        <P>
          Every project also gets a key-value database reachable from the running app via{" "}
          <Code>ZOLA_DB_URL</Code>: <Code>GET $ZOLA_DB_URL/&lt;key&gt;</Code> reads,{" "}
          <Code>POST</Code> with the value as the body writes, <Code>DELETE</Code> removes,
          and <Code>GET $ZOLA_DB_URL?prefix=</Code> lists keys.
        </P>
      </>
    ),
  },
  {
    id: "publishing",
    title: "Publishing and domains",
    body: (
      <>
        <P>
          The Publishing tab builds the project in the sandbox and uploads the static
          output, serving it at <Code>/sites/&lt;slug&gt;/</Code>. Keep the project
          buildable as a static site and publishing stays one click.
        </P>
        <P>
          To use your own domain, add it in the Deploy tab, create the{" "}
          <Code>_zola-challenge.&lt;domain&gt;</Code> TXT record it shows you, then point a
          CNAME at the platform. Verified domains are served by Host header.{" "}
          <Link href="/published" className="underline hover:text-foreground">
            Published Projects
          </Link>{" "}
          lists everything that's live, with traffic.
        </P>
      </>
    ),
  },
  {
    id: "collaboration",
    title: "Collaboration and community",
    body: (
      <>
        <P>
          Invite people to a workspace from Organization; project members share files,
          secrets and MCP servers. Live presence avatars show who else is in a project, and
          file edits sync between collaborators (last write wins per file).
        </P>
        <P>
          Making a project public lists it on Explore, where anyone can read it and remix a
          copy into their own workspace. Public means the source — secrets never live in the
          file tree, but anything hardcoded into a file is visible.
        </P>
      </>
    ),
  },
];

function DocsBody() {
  const [active, setActive] = useState(SECTIONS[0].id);

  return (
    <div className="mx-auto max-w-5xl px-6 pb-16 pt-10">
      <PageHeader
        title="Documentation"
        description="How the platform works, end to end."
      />

      <div className="flex gap-8">
        <nav className="sticky top-10 hidden h-fit w-48 shrink-0 space-y-0.5 md:block">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              onClick={() => setActive(section.id)}
              className={cn(
                "block rounded-md px-2.5 py-1.5 text-xs",
                active === section.id
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              {section.title}
            </a>
          ))}
        </nav>

        <div className="min-w-0 flex-1">
          {SECTIONS.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="mb-10 scroll-mt-6 border-b border-border pb-8 last:border-0"
            >
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                <BookOpen className="h-4 w-4 text-primary" />
                {section.title}
              </h2>
              {section.body}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DocsPage() {
  return (
    <RequireAuth>
      {() => (
        <DashboardShell active="Documentation">
          <DocsBody />
        </DashboardShell>
      )}
    </RequireAuth>
  );
}
