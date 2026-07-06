// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { NextResponse } from "next/server";
import { getStripe, stripeEnabled } from "@/lib/billing/stripe";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PLANS, type PlanId } from "@/lib/billing/plans";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!stripeEnabled()) {
    return NextResponse.json(
      { error: "Billing is not configured." },
      { status: 503 },
    );
  }
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { plan } = (await req.json()) as { plan: PlanId };
  const planDef = PLANS.find((p) => p.id === plan);
  if (!planDef || !planDef.priceEnvVar) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }
  const priceId = process.env[planDef.priceEnvVar];
  if (!priceId) {
    return NextResponse.json(
      { error: `Missing ${planDef.priceEnvVar}` },
      { status: 500 },
    );
  }

  const origin = new URL(req.url).origin;
  const stripe = getStripe();

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer: existing?.stripe_customer_id ?? undefined,
    customer_email: existing?.stripe_customer_id
      ? undefined
      : (userData.user.email ?? undefined),
    client_reference_id: userData.user.id,
    success_url: `${origin}/billing?status=success`,
    cancel_url: `${origin}/billing?status=cancelled`,
    metadata: { user_id: userData.user.id, plan },
    subscription_data: { metadata: { user_id: userData.user.id, plan } },
  });

  return NextResponse.json({ url: session.url });
}
