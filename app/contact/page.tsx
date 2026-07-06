// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import Link from "next/link";
import { Sparkles, Mail, Github, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact · Loop by Argilette Lab",
};

export default function ContactPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-16">
      <nav className="mb-12 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-5 w-5 text-primary" /> Loop
        </Link>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Home
        </Link>
      </nav>

      <h1 className="text-3xl font-bold">Contact</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Reach Argilette Lab any of these ways. We typically respond within a
        business day.
      </p>

      <div className="mt-8 space-y-3">
        <Row
          icon={<Mail className="h-4 w-4" />}
          label="General &amp; product"
          value="hello@loopafrica.org"
          href="mailto:hello@loopafrica.org"
        />
        <Row
          icon={<Mail className="h-4 w-4" />}
          label="Support"
          value="support@loopafrica.org"
          href="mailto:support@loopafrica.org"
        />
        <Row
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Security disclosures"
          value="security@loopafrica.org"
          href="mailto:security@loopafrica.org"
        />
        <Row
          icon={<Mail className="h-4 w-4" />}
          label="Legal &amp; privacy"
          value="legal@loopafrica.org"
          href="mailto:legal@loopafrica.org"
        />
        <Row
          icon={<Github className="h-4 w-4" />}
          label="Bug reports &amp; pull requests"
          value="github.com/babalekpam/zola/issues"
          href="https://github.com/babalekpam/zola/issues"
        />
      </div>

      <footer className="mt-16 border-t border-border pt-6 text-xs text-muted-foreground">
        © 2026 Argilette Lab. All rights reserved.
      </footer>
    </main>
  );
}

function Row({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noreferrer"
      className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-accent"
    >
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          <span dangerouslySetInnerHTML={{ __html: label }} />
        </div>
        <div className="mt-1 text-sm font-medium">{value}</div>
      </div>
      <span className="text-xs text-muted-foreground">→</span>
    </a>
  );
}
