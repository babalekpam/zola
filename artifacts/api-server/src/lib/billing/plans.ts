// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
export type PlanId = "free" | "pro" | "team";

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number;
  blurb: string;
  features: string[];
  chatPerMinute: number;
  /** Monthly AI request budget (chat + swarm calls) — platform keys, no BYOK. */
  aiMonthly: number;
  priceEnvVar?: string;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    blurb: "Browse and manage projects. AI building requires a paid plan.",
    features: [
      "No AI requests — upgrade to build with AI",
      "Unlimited projects",
      "Community support",
    ],
    // Free accounts never spend platform AI credit: every AI call costs real
    // money on the platform's provider keys, so the budget is zero and the
    // quota gate rejects the call before any provider is contacted.
    chatPerMinute: 0,
    aiMonthly: 0,
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 19,
    blurb: "For serious builders shipping side projects.",
    features: [
      "5,000 AI requests per month",
      "Auto model routing (best model per task)",
      "Agent swarm mode",
      "Email support",
    ],
    chatPerMinute: 60,
    aiMonthly: 5000,
    priceEnvVar: "STRIPE_PRICE_PRO",
  },
  {
    id: "team",
    name: "Team",
    priceMonthly: 49,
    blurb: "For teams and agencies.",
    features: [
      "20,000 AI requests per month",
      "All Pro features",
      "Priority routing",
      "Priority support · SOC2 roadmap",
    ],
    chatPerMinute: 200,
    aiMonthly: 20000,
    priceEnvVar: "STRIPE_PRICE_TEAM",
  },
];

export function getPlan(id: PlanId | string | null | undefined): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}
