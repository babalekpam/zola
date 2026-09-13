// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "../supabase";
import { getPlan } from "../billing/plans";
import { isDeployed } from "../env";

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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only well-formed UUIDs reach the usage table: a malformed id would make the
 *  insert fail, and a failed (best-effort) insert would leave the call
 *  unmetered — a way around the monthly quota. */
function asUuid(value: string | null | undefined): string | null {
  return typeof value === "string" && UUID_RE.test(value) ? value : null;
}

/** Human-readable reason for a rejected quota check (402 body). */
export function quotaErrorMessage(quota: QuotaResult): string {
  if (quota.limit <= 0) {
    return "AI features require a paid plan. Upgrade to Pro or Team to build with AI.";
  }
  return `Monthly AI limit reached (${quota.used}/${quota.limit} on the ${quota.plan} plan). Upgrade your plan to keep building.`;
}

/**
 * Check the caller's monthly AI budget. Plans with no AI budget (Free) are
 * rejected before any usage rows are read. Without the service role the plan
 * cannot be determined: dev environments fail open, production fails closed
 * so a missing key can never hand out unmetered AI.
 */
export async function checkAiQuota(userId: string): Promise<QuotaResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (isDeployed()) {
      return { allowed: false, used: 0, limit: 0, plan: "unconfigured" };
    }
    return { allowed: true, used: 0, limit: 0, plan: "dev" };
  }

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
  if (plan.aiMonthly <= 0) {
    return { allowed: false, used: 0, limit: 0, plan: plan.id };
  }

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
        org_id: asUuid(r.orgId),
        project_id: asUuid(r.projectId),
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
