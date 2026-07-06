// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
export type PlanId = "free" | "pro" | "team";

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number;
  blurb: string;
  features: string[];
  chatPerMinute: number;
  priceEnvVar?: string;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    blurb: "Try Loop, no card required.",
    features: [
      "15 AI requests per minute",
      "Unlimited projects",
      "Bring your own NVIDIA / OpenRouter key",
      "Community support",
    ],
    chatPerMinute: 15,
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 19,
    blurb: "For serious builders shipping side projects.",
    features: [
      "60 AI requests per minute",
      "All Free features",
      "Higher token limits",
      "Email support",
    ],
    chatPerMinute: 60,
    priceEnvVar: "STRIPE_PRICE_PRO",
  },
  {
    id: "team",
    name: "Team",
    priceMonthly: 49,
    blurb: "For teams and agencies.",
    features: [
      "200 AI requests per minute",
      "All Pro features",
      "Priority routing",
      "Priority support · SOC2 roadmap",
    ],
    chatPerMinute: 200,
    priceEnvVar: "STRIPE_PRICE_TEAM",
  },
];

export function getPlan(id: PlanId | string | null | undefined): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}
