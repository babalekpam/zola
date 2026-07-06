// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./use-projects";

export interface ReferralEntry {
  status: "pending" | "qualified";
  reward_cents: number;
  created_at: string;
  qualified_at: string | null;
}

export interface ReferralInfo {
  code: string | null;
  credit_cents: number;
  total: number;
  qualified: number;
  referrals: ReferralEntry[];
}

export function useReferral(enabled = true) {
  return useQuery({
    queryKey: ["referral"],
    queryFn: () => apiFetch<ReferralInfo>("/api/referral"),
    enabled,
  });
}
