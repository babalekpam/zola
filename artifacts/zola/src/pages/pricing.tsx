// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Link } from "wouter";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { PLANS } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

export default function PricingPage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <header className="mb-10 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-5 w-5 text-primary" /> Loop
        </Link>
        <Link href="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </header>

      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold">Simple pricing</h1>
        <p className="mt-2 text-muted-foreground">Start for free. Upgrade when you're ready to ship faster.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        {PLANS.map((plan, i) => (
          <div
            key={plan.id}
            className={cn(
              "rounded-xl border p-6 space-y-4",
              i === 1 ? "border-primary bg-card ring-1 ring-primary" : "border-border bg-card",
            )}
          >
            {i === 1 && (
              <span className="text-[10px] uppercase tracking-widest font-bold text-primary">Most popular</span>
            )}
            <div>
              <h2 className="text-xl font-semibold">{plan.name}</h2>
              <p className="text-3xl font-bold mt-1">
                {plan.priceMonthly === 0 ? "Free" : `$${plan.priceMonthly}`}
                {plan.priceMonthly > 0 && <span className="text-base font-normal text-muted-foreground">/mo</span>}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{plan.blurb}</p>
            </div>
            <ul className="space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {f}
                </li>
              ))}
            </ul>
            <Link
              href={plan.priceMonthly === 0 ? "/signup" : "/billing"}
              className={cn(
                "block w-full rounded-md px-4 py-2 text-center text-sm font-medium",
                i === 1
                  ? "bg-primary text-primary-foreground"
                  : "border border-border hover:bg-accent",
              )}
            >
              {plan.priceMonthly === 0 ? "Get started free" : `Get ${plan.name}`}
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}
