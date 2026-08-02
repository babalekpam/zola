// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useState } from "react";
import { Link } from "wouter";
import { Check, Copy, Gift, Megaphone, Sparkles, Ticket } from "lucide-react";
import { toast } from "sonner";
import { cn, formatRelativeTime } from "@/lib/utils";
import { PLANS } from "@/lib/billing/plans";
import { DashboardShell, PageHeader } from "@/components/dashboard/dashboard-shell";
import { RequireAuth } from "@/components/dashboard/require-auth";
import { useReferral } from "@/hooks/use-referral";

function PromotionsBody() {
  const { data: referral, isLoading } = useReferral();
  const [copied, setCopied] = useState(false);

  const link = referral?.code
    ? `${window.location.origin}/signup?ref=${referral.code}`
    : "";

  function copyLink() {
    if (!link) return;
    navigator.clipboard.writeText(link).then(
      () => {
        setCopied(true);
        toast.success("Referral link copied");
        setTimeout(() => setCopied(false), 2000);
      },
      () => toast.error("Couldn't copy — select the link and copy manually"),
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 pb-16 pt-10">
      <PageHeader
        title="Promotions"
        description="Credit you've earned and the offers available on your account."
      />

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Gift className="h-4 w-4 text-primary" /> Refer &amp; Earn
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Share your link. When someone signs up through it and upgrades to a paid plan,
          you both get $20 in credit.
        </p>

        {isLoading ? (
          <div className="mt-4 h-9 animate-pulse rounded-md bg-muted" />
        ) : (
          <>
            <div className="mt-4 flex gap-2">
              <input
                readOnly
                value={link || "Generating your link…"}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-xs"
              />
              <button
                type="button"
                onClick={copyLink}
                disabled={!link}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-background p-3">
                <div className="text-[11px] text-muted-foreground">Credit earned</div>
                <div className="mt-0.5 text-xl font-semibold tabular-nums">
                  ${((referral?.credit_cents ?? 0) / 100).toFixed(2)}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <div className="text-[11px] text-muted-foreground">Signed up</div>
                <div className="mt-0.5 text-xl font-semibold tabular-nums">
                  {referral?.total ?? 0}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <div className="text-[11px] text-muted-foreground">Upgraded</div>
                <div className="mt-0.5 text-xl font-semibold tabular-nums">
                  {referral?.qualified ?? 0}
                </div>
              </div>
            </div>

            {referral && referral.referrals.length > 0 && (
              <ul className="mt-4 space-y-1 border-t border-border pt-3">
                {referral.referrals.slice(0, 8).map((entry, i) => (
                  <li
                    key={`${entry.created_at}-${i}`}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-muted-foreground">
                      Referral · {formatRelativeTime(entry.created_at)}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        entry.status === "qualified"
                          ? "bg-primary/10 text-primary"
                          : "border border-border text-muted-foreground",
                      )}
                    >
                      {entry.status === "qualified"
                        ? `+$${(entry.reward_cents / 100).toFixed(0)}`
                        : "Pending upgrade"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Ticket className="h-4 w-4 text-primary" /> Plans &amp; offers
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <div key={plan.id} className="flex flex-col rounded-xl border border-border bg-card p-4">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-medium">{plan.name}</h3>
                <span className="text-sm font-semibold tabular-nums">
                  {plan.priceMonthly === 0 ? "Free" : `$${plan.priceMonthly}/mo`}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{plan.blurb}</p>
              <ul className="mt-3 flex-1 space-y-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-1.5 text-[11px] text-muted-foreground">
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href="/billing"
                className="mt-3 inline-flex items-center justify-center rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                {plan.priceMonthly === 0 ? "Current tier" : `Upgrade to ${plan.name}`}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 flex items-start gap-3 rounded-xl border border-border bg-card p-4">
        <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Building for a community?</span>{" "}
          Education and non-profit teams can request discounted Team seats — reach out from
          the{" "}
          <Link href="/contact" className="underline hover:text-foreground">
            contact page
          </Link>{" "}
          with a short description of the project.
        </div>
      </section>

      <p className="mt-6 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Sparkles className="h-3 w-3" /> Credit applies automatically to your next invoice.
      </p>
    </div>
  );
}

export default function PromotionsPage() {
  return (
    <RequireAuth>
      {() => (
        <DashboardShell active="Promotions">
          <PromotionsBody />
        </DashboardShell>
      )}
    </RequireAuth>
  );
}
