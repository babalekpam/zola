// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Link } from "wouter";
import { ArrowLeft, Sparkles } from "lucide-react";

export default function ContactPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <header className="mb-10 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-5 w-5 text-primary" /> Zola
        </Link>
        <Link href="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </header>
      <h1 className="text-3xl font-bold">Contact</h1>
      <p className="mt-4 text-muted-foreground">
        Have a question, bug report, or partnership inquiry? Reach out to the Argilette Lab team.
      </p>
      <div className="mt-8 space-y-3">
        <p className="text-sm">
          <strong>General / support:</strong>{" "}
          <a href="mailto:hello@argilette.com" className="text-primary underline">hello@argilette.com</a>
        </p>
        <p className="text-sm">
          <strong>Security:</strong>{" "}
          <a href="mailto:security@argilette.com" className="text-primary underline">security@argilette.com</a>
        </p>
      </div>
    </main>
  );
}
