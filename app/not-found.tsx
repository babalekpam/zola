// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <Link href="/" className="mb-8 flex items-center gap-2 text-lg font-semibold">
        <Sparkles className="h-5 w-5 text-primary" /> Loop
      </Link>
      <p className="text-sm text-muted-foreground">404</p>
      <h1 className="mt-2 text-3xl font-bold">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Back home
        </Link>
        <Link
          href="/projects"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          My projects
        </Link>
      </div>
    </main>
  );
}
