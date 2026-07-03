// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BillingActions } from "@/components/billing/billing-actions";
import { getPlan, PLANS } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

interface Sub {
  plan: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export default async function BillingPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end, cancel_at_period_end")
    .eq("user_id", userData.user.id)
    .maybeSingle<Sub>();

  const current = getPlan(sub?.plan ?? "free");

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <Link
          href="/projects"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Projects
        </Link>
        <Link href="/" className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> Zola
        </Link>
      </header>

      <h1 className="text-2xl font-semibold">Billing</h1>
      <p className="text-sm text-muted-foreground">
        You&apos;re on the <strong>{current.name}</strong> plan ·{" "}
        {current.chatPerMinute} AI requests / minute
        {sub?.current_period_end ? (
          <>
            {" "}
            · renews{" "}
            {new Date(sub.current_period_end).toLocaleDateString()}
            {sub.cancel_at_period_end ? " (cancellation pending)" : ""}
          </>
        ) : null}
      </p>

      <BillingActions
        currentPlan={(sub?.plan as "free" | "pro" | "team" | undefined) ?? "free"}
        plans={PLANS}
      />
    </main>
  );
}
