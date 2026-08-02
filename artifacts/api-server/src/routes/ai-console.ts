// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Router } from "express";
import { createSupabaseServerClient } from "../lib/supabase";
import {
  AUTO_MODEL_ID,
  DEFAULT_MODEL_ID,
  MODELS,
  PROVIDER_PRIORITY,
  TASK_ROUTES,
  type ProviderId,
  type TaskKind,
} from "../lib/ai/models";
import { PROVIDER_ENV, providerHasKey } from "../lib/ai/providers";
import { checkAiQuota } from "../lib/ai/quota";

const router = Router();

const PROVIDER_LABELS: Record<ProviderId, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  groq: "Groq",
  deepseek: "DeepSeek",
  qwen: "Qwen (DashScope)",
  moonshot: "Moonshot (Kimi)",
  xai: "xAI (Grok)",
  nvidia: "NVIDIA",
  openrouter: "OpenRouter",
};

const TASK_LABELS: Record<TaskKind, string> = {
  design: "Design & UI work",
  code: "Writing and editing code",
  plan: "Planning & architecture",
  quick: "Small edits and fixes",
};

/**
 * AI Console: what the platform can actually run right now.
 *
 * Availability is derived from the platform's own provider keys, not the
 * user's — Zola resells AI, so "is this model usable?" is a property of the
 * deployment. The console shows the resulting routing so a user can see why
 * Auto picked what it picked, rather than treating it as a black box.
 */
router.get("/ai/console", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const providers = PROVIDER_PRIORITY.map((id) => ({
    id,
    label: PROVIDER_LABELS[id],
    envVar: PROVIDER_ENV[id],
    configured: providerHasKey(id),
    models: MODELS.filter((m) => m.provider === id).map((m) => ({
      id: m.id,
      label: m.label,
      modelId: m.modelId,
    })),
  }));

  // The same walk resolveTaskModel does, surfaced as data: for each task, the
  // candidate list in order with the winner marked.
  const routing = (Object.keys(TASK_ROUTES) as TaskKind[]).map((task) => {
    const candidates = TASK_ROUTES[task].map((modelId) => {
      const descriptor = MODELS.find((m) => m.id === modelId);
      return {
        modelId,
        label: descriptor?.label ?? modelId,
        provider: descriptor?.provider ?? null,
        available: descriptor ? providerHasKey(descriptor.provider) : false,
      };
    });
    return {
      task,
      label: TASK_LABELS[task],
      candidates,
      resolved: candidates.find((c) => c.available)?.modelId ?? null,
    };
  });

  const quota = await checkAiQuota(userData.user.id);

  res.json({
    providers,
    routing,
    quota,
    defaultModelId: DEFAULT_MODEL_ID,
    autoModelId: AUTO_MODEL_ID,
    modelCount: MODELS.length,
    providersConfigured: providers.filter((p) => p.configured).length,
  });
});

const MAX_USAGE_DAYS = 90;
const USAGE_ROW_CAP = 5_000;

interface UsageRow {
  model_id: string;
  kind: string;
  prompt_tokens: number;
  completion_tokens: number;
  project_id: string | null;
  created_at: string;
}

/** Per-user usage history for the console's charts. RLS scopes it to self. */
router.get("/ai/usage", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const requested = Number(req.query.days ?? 30);
  const days = Math.min(
    MAX_USAGE_DAYS,
    Math.max(1, Number.isFinite(requested) ? requested : 30),
  );
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data, error } = await supabase
    .from("ai_usage")
    .select("model_id, kind, prompt_tokens, completion_tokens, project_id, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(USAGE_ROW_CAP);

  if (error) { res.status(500).json({ error: error.message }); return; }
  const rows = (data ?? []) as UsageRow[];

  const byDay = new Map<string, { day: string; requests: number; tokens: number }>();
  const byModel = new Map<string, { modelId: string; requests: number; tokens: number }>();
  const byProject = new Map<string, { projectId: string; requests: number; tokens: number }>();
  const byKind = new Map<string, number>();
  let totalTokens = 0;

  for (const row of rows) {
    const tokens = (row.prompt_tokens ?? 0) + (row.completion_tokens ?? 0);
    totalTokens += tokens;

    const day = row.created_at.slice(0, 10);
    const dayEntry = byDay.get(day) ?? { day, requests: 0, tokens: 0 };
    dayEntry.requests += 1;
    dayEntry.tokens += tokens;
    byDay.set(day, dayEntry);

    const modelEntry = byModel.get(row.model_id) ?? { modelId: row.model_id, requests: 0, tokens: 0 };
    modelEntry.requests += 1;
    modelEntry.tokens += tokens;
    byModel.set(row.model_id, modelEntry);

    if (row.project_id) {
      const projectEntry =
        byProject.get(row.project_id) ?? { projectId: row.project_id, requests: 0, tokens: 0 };
      projectEntry.requests += 1;
      projectEntry.tokens += tokens;
      byProject.set(row.project_id, projectEntry);
    }

    byKind.set(row.kind, (byKind.get(row.kind) ?? 0) + 1);
  }

  res.json({
    days,
    totalRequests: rows.length,
    totalTokens,
    truncated: rows.length >= USAGE_ROW_CAP,
    byDay: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
    byModel: [...byModel.values()].sort((a, b) => b.requests - a.requests),
    byProject: [...byProject.values()].sort((a, b) => b.requests - a.requests).slice(0, 10),
    byKind: [...byKind.entries()].map(([kind, requests]) => ({ kind, requests })),
  });
});

export default router;
