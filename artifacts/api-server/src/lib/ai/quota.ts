// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "../supabase";
import { getPlan } from "../billing/plans";

// Monthly AI-request quotas exist because the platform sells AI on its own
// provider keys (no BYOK): every call costs the platform real money, so every
// call is metered and capped by plan.

export interface QuotaResult {
  allowed: boolean;
  used: number;
  limit: number;
  plan: string;
}

function monthStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/**
 * Check the caller's monthly AI budget. Fails OPEN when the service role is
 * not configured (dev environments) — quota is a billing control, not a
 * security boundary.
 */
export async function checkAiQuota(userId: string): Promise<QuotaResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { allowed: true, used: 0, limit: 0, plan: "free" };

  const { data: sub } = await admin
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", userId)
    .maybeSingle();
  const planId =
    sub && (sub.status === "active" || sub.status === "trialing")
      ? sub.plan
      : "free";
  const plan = getPlan(planId);

  const { count } = await admin
    .from("ai_usage")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", monthStart());
  const used = count ?? 0;

  return { allowed: used < plan.aiMonthly, used, limit: plan.aiMonthly, plan: plan.id };
}

export interface UsageRecord {
  userId: string;
  orgId?: string | null;
  projectId?: string | null;
  modelId: string;
  kind: "chat" | "swarm-architect" | "swarm-worker" | "completion" | "inline-edit";
  promptTokens?: number;
  completionTokens?: number;
}

/** Best-effort usage write — metering must never break a chat response. */
export async function recordAiUsage(records: UsageRecord[]): Promise<void> {
  const admin: SupabaseClient | null = createSupabaseAdminClient();
  if (!admin || records.length === 0) return;
  await admin
    .from("ai_usage")
    .insert(
      records.map((r) => ({
        user_id: r.userId,
        org_id: r.orgId ?? null,
        project_id: r.projectId ?? null,
        model_id: r.modelId,
        kind: r.kind,
        prompt_tokens: Number.isFinite(r.promptTokens) ? r.promptTokens : 0,
        completion_tokens: Number.isFinite(r.completionTokens) ? r.completionTokens : 0,
      })),
    )
    .then(({ error }) => {
      if (error) console.error("ai_usage insert failed:", error.message);
    });
}
