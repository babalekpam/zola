// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Sparkles, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <Link href="/" className="mb-8 flex items-center gap-2 text-lg font-semibold">
        <Sparkles className="h-5 w-5 text-primary" /> Zola
      </Link>
      <p className="text-sm text-muted-foreground">Something went wrong</p>
      <h1 className="mt-2 max-w-lg text-2xl font-bold">
        We&apos;ve hit an unexpected error.
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Our team has been notified. You can try again, or head back home.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          ref: {error.digest}
        </p>
      ) : null}
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
