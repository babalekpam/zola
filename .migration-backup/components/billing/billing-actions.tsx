// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Plan, PlanId } from "@/lib/billing/plans";

interface Props {
  currentPlan: PlanId;
  plans: Plan[];
}

export function BillingActions({ currentPlan, plans }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  async function subscribe(plan: PlanId) {
    setLoading(plan);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const json = await res.json();
    if (!res.ok || !json.url) {
      toast.error(json.error ?? "Could not start checkout");
      setLoading(null);
      return;
    }
    window.location.href = json.url;
  }

  async function manage() {
    setLoading("portal");
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const json = await res.json();
    if (!res.ok || !json.url) {
      toast.error(json.error ?? "Could not open billing portal");
      setLoading(null);
      return;
    }
    window.location.href = json.url;
  }

  return (
    <div className="mt-8 space-y-4">
      {currentPlan !== "free" ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold">Manage subscription</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Update payment method, view invoices, or cancel.
          </p>
          <Button
            onClick={() => void manage()}
            variant="outline"
            className="mt-3"
            disabled={loading !== null}
          >
            {loading === "portal" ? "Opening…" : "Open billing portal"}
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = p.id === currentPlan;
          return (
            <div
              key={p.id}
              className="flex flex-col rounded-xl border border-border bg-card p-5"
            >
              <h3 className="text-base font-semibold">{p.name}</h3>
              <div className="mt-2">
                <span className="text-2xl font-bold">${p.priceMonthly}</span>
                <span className="text-xs text-muted-foreground"> /mo</span>
              </div>
              <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="mt-5"
                size="sm"
                variant={isCurrent ? "secondary" : "default"}
                onClick={() => p.id !== "free" && !isCurrent && void subscribe(p.id)}
                disabled={isCurrent || p.id === "free" || loading !== null}
              >
                {isCurrent
                  ? "Current plan"
                  : p.id === "free"
                    ? "Default"
                    : loading === p.id
                      ? "Redirecting…"
                      : `Upgrade to ${p.name}`}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
