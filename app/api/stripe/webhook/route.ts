// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStripe, stripeEnabled } from "@/lib/billing/stripe";
import type Stripe from "stripe";

export const runtime = "nodejs";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Service-role Supabase not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  if (!stripeEnabled()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET not set" },
      { status: 500 },
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "no signature" }, { status: 400 });

  const stripe = getStripe();
  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "bad signature";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const sb = admin();

  async function upsertFromSubscription(sub: Stripe.Subscription) {
    let userId = (sub.metadata?.user_id as string | undefined) ?? null;
    if (!userId && typeof sub.customer !== "string" && sub.customer) {
      const cust = sub.customer as Stripe.Customer | Stripe.DeletedCustomer;
      if (!("deleted" in cust)) {
        userId = (cust.metadata?.user_id as string | undefined) ?? null;
      }
    }
    if (!userId) return;
    const plan =
      (sub.metadata?.plan as string | undefined) ??
      (sub.items.data[0]?.price?.metadata?.plan as string | undefined) ??
      "pro";
    const firstItem = sub.items.data[0];
    const periodEnd =
      (firstItem as { current_period_end?: number } | undefined)
        ?.current_period_end ??
      (sub as unknown as { current_period_end?: number }).current_period_end;
    await sb
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          stripe_customer_id:
            typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
          stripe_subscription_id: sub.id,
          plan,
          status: sub.status,
          current_period_end: periodEnd
            ? new Date(periodEnd * 1000).toISOString()
            : null,
          cancel_at_period_end: sub.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(
          session.subscription as string,
        );
        await upsertFromSubscription(sub);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await upsertFromSubscription(event.data.object as Stripe.Subscription);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
