// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Link } from "wouter";
import { ArrowLeft, Sparkles } from "lucide-react";

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <header className="mb-10 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-5 w-5 text-primary" /> Loop
        </Link>
        <Link href="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </header>
      <article className="prose max-w-none">
        <h1>Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: July 3, 2026</p>
        <p>
          Argilette Lab ("we," "us," or "our") operates the Loop service. This policy explains how we
          collect, use, and protect your data.
        </p>
        <h2>1. What we collect</h2>
        <ul>
          <li>Email address and auth credentials (via Supabase)</li>
          <li>Project files and chat messages you create in Loop</li>
          <li>Usage data (request counts, model selections)</li>
          <li>Payment data (processed by Stripe — we do not store card numbers)</li>
        </ul>
        <h2>2. How we use it</h2>
        <ul>
          <li>To provide and improve the Service</li>
          <li>To manage your subscription and billing</li>
          <li>To enforce rate limits and terms of service</li>
        </ul>
        <h2>3. Data sharing</h2>
        <p>
          We do not sell your data. We share it only with sub-processors necessary to operate the
          Service (Supabase, Stripe, AI model providers).
        </p>
        <h2>4. Data retention</h2>
        <p>
          Your projects and messages are retained until you delete your account. You can delete your
          account at any time from the Account settings page.
        </p>
        <h2>5. Contact</h2>
        <p>
          Privacy questions? Email <a href="mailto:privacy@argilette.com">privacy@argilette.com</a>.
        </p>
      </article>
    </main>
  );
}
