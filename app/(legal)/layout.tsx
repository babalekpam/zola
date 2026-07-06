// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { LoopLogo } from "@/components/brand/logo";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <nav className="mb-12 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <LoopLogo markClassName="h-6 w-6" />
        </Link>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to home
        </Link>
      </nav>
      <article className="prose prose-invert max-w-none prose-headings:font-semibold prose-h1:text-3xl prose-h2:mt-8 prose-h2:text-xl prose-p:text-muted-foreground prose-a:text-foreground">
        {children}
      </article>
      <footer className="mt-16 border-t border-border pt-6 text-xs text-muted-foreground">
        © 2026 Argilette Lab. All rights reserved.
      </footer>
    </main>
  );
}
