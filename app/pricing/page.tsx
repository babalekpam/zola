// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import Link from "next/link";
import { Sparkles, Check } from "lucide-react";
import { LoopLogo } from "@/components/brand/logo";
import type { Metadata } from "next";
import { PLANS } from "@/lib/billing/plans";

export const metadata: Metadata = {
  title: "Pricing · Loop by Argilette Lab",
  description: "Simple, transparent pricing. Free tier available.",
};

export default function PricingPage() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-16">
      <nav className="mb-12 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <LoopLogo markClassName="h-6 w-6" />
        </Link>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Home
        </Link>
      </nav>

      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Pricing</h1>
        <p className="mt-3 text-base text-muted-foreground">
          Start free. Upgrade when you need more throughput.
        </p>
      </header>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {PLANS.map((p) => (
          <div
            key={p.id}
            className="flex flex-col rounded-xl border border-border bg-card p-6"
          >
            <h2 className="text-xl font-semibold">{p.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{p.blurb}</p>
            <div className="mt-4">
              <span className="text-4xl font-bold">${p.priceMonthly}</span>
              <span className="text-sm text-muted-foreground"> /mo</span>
            </div>
            <ul className="mt-6 flex-1 space-y-2 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href={p.id === "free" ? "/signup" : "/billing"}
              className="mt-6 inline-flex justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              {p.id === "free" ? "Get started" : `Subscribe to ${p.name}`}
            </Link>
          </div>
        ))}
      </div>

      <p className="mt-12 text-center text-xs text-muted-foreground">
        All plans billed in USD. Cancel anytime from your billing dashboard. VAT
        may apply.
      </p>
    </main>
  );
}
