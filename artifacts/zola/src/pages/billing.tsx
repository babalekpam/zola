// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Sparkles, Check } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/hooks/use-projects";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { PLANS, getPlan } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

interface Sub {
  plan: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export default function BillingPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [sub, setSub] = useState<Sub | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (!user) { setLocation("/login"); return; }
    const sb = createSupabaseBrowserClient();
    sb.from("subscriptions")
      .select("plan, status, current_period_end, cancel_at_period_end")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setSub(data as Sub | null);
        setLoading(false);
      });
  }, [user, setLocation]);

  const current = getPlan(sub?.plan);

  async function checkout(planId: string) {
    setCheckingOut(planId);
    try {
      const { url } = await apiFetch<{ url: string }>("/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: planId }),
      });
      window.location.href = url;
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setCheckingOut(null);
    }
  }

  async function openPortal() {
    setPortalLoading(true);
    try {
      const { url } = await apiFetch<{ url: string }>("/api/stripe/portal", {
        method: "POST",
        body: JSON.stringify({}),
      });
      window.location.href = url;
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setPortalLoading(false);
    }
  }

  if (!user || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/projects" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Projects
        </Link>
        <Link href="/" className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> Zola
        </Link>
      </header>

      <h1 className="text-2xl font-semibold">Billing</h1>
      <p className="text-sm text-muted-foreground">
        You're on the <strong>{current.name}</strong> plan · {current.chatPerMinute} AI requests / minute
        {sub?.current_period_end ? (
          <> · renews {new Date(sub.current_period_end).toLocaleDateString()}{sub.cancel_at_period_end ? " (cancellation pending)" : ""}</>
        ) : null}
      </p>

      {sub && sub.plan !== "free" && (
        <div className="mt-4">
          <button
            type="button"
            onClick={openPortal}
            disabled={portalLoading}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            {portalLoading ? "Opening portal…" : "Manage subscription →"}
          </button>
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = current.id === plan.id;
          return (
            <div
              key={plan.id}
              className={cn(
                "rounded-xl border p-6 space-y-4",
                isCurrent ? "border-primary bg-card" : "border-border bg-card",
              )}
            >
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">{plan.name}</h2>
                  {isCurrent && (
                    <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">Current</span>
                  )}
                </div>
                <p className="mt-1 text-2xl font-bold">
                  {plan.priceMonthly === 0 ? "Free" : `$${plan.priceMonthly}/mo`}
                </p>
                <p className="text-xs text-muted-foreground">{plan.blurb}</p>
              </div>
              <ul className="space-y-1.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              {!isCurrent && plan.id !== "free" && (
                <button
                  type="button"
                  onClick={() => checkout(plan.id)}
                  disabled={!!checkingOut}
                  className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {checkingOut === plan.id ? "Redirecting…" : `Upgrade to ${plan.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
