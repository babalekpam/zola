// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { getStripe, stripeEnabled } from "../lib/billing/stripe";
import { PLANS, type PlanId } from "../lib/billing/plans";
import { createSupabaseServerClient } from "../lib/supabase";
import type Stripe from "stripe";

const router = Router();

router.post("/stripe/checkout", async (req, res) => {
  if (!stripeEnabled()) {
    res.status(503).json({ error: "Billing is not configured." });
    return;
  }
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { plan } = req.body as { plan: PlanId };
  const planDef = PLANS.find((p) => p.id === plan);
  if (!planDef || !planDef.priceEnvVar) { res.status(400).json({ error: "Invalid plan" }); return; }
  const priceId = process.env[planDef.priceEnvVar];
  if (!priceId) { res.status(500).json({ error: `Missing ${planDef.priceEnvVar}` }); return; }

  const origin = `${req.protocol}://${req.get("host")}`;
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
    customer_email: existing?.stripe_customer_id ? undefined : (userData.user.email ?? undefined),
    client_reference_id: userData.user.id,
    success_url: `${origin}/billing?status=success`,
    cancel_url: `${origin}/billing?status=cancelled`,
    metadata: { user_id: userData.user.id, plan },
    subscription_data: { metadata: { user_id: userData.user.id, plan } },
  });

  res.json({ url: session.url });
});

router.post("/stripe/portal", async (req, res) => {
  if (!stripeEnabled()) {
    res.status(503).json({ error: "Billing is not configured." });
    return;
  }
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!sub?.stripe_customer_id) {
    res.status(404).json({ error: "No active subscription found." });
    return;
  }

  const origin = `${req.protocol}://${req.get("host")}`;
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${origin}/billing`,
  });
  res.json({ url: session.url });
});

router.post("/stripe/webhook", async (req, res) => {
  if (!stripeEnabled()) {
    res.status(503).json({ error: "Stripe not configured" });
    return;
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) { res.status(500).json({ error: "STRIPE_WEBHOOK_SECRET not set" }); return; }

  const sig = req.headers["stripe-signature"];
  if (!sig) { res.status(400).json({ error: "no signature" }); return; }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    // Need raw body for webhook verification
    const payload = req.body as Buffer;
    event = stripe.webhooks.constructEvent(payload, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "bad signature";
    res.status(400).json({ error: msg });
    return;
  }

  function adminClient() {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Service-role Supabase not configured");
    return createClient(url, key, { auth: { persistSession: false } });
  }

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
    await adminClient()
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
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
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

  res.json({ received: true });
});

export default router;
