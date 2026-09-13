// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Router, type Request, type Response } from "express";
import { generateText } from "ai";
import {
  resolveTaskModel,
  markProviderUnhealthyFromError,
} from "../lib/ai/providers";
import { checkAiQuota, quotaErrorMessage, recordAiUsage } from "../lib/ai/quota";
import { createSupabaseServerClient } from "../lib/supabase";

const router = Router();

// Inline AI is the most abuse-prone surface in the product — every keystroke
// can trigger a call — so inputs stay small, the model is always the
// platform's fastest tier, and both endpoints reuse the chat burst limiter
// and monthly plan quota.
const MAX_PREFIX_CHARS = 8_000;
const MAX_SUFFIX_CHARS = 2_000;
const MAX_COMPLETION_CHARS = 400;
const MAX_SELECTION_CHARS = 8_000;
const MAX_INSTRUCTION_CHARS = 2_000;
const MAX_EDIT_CHARS = 4_000;

type SupabaseServer = ReturnType<typeof createSupabaseServerClient>;

// Shared auth + rate-limit + quota gate. Mirrors /chat so inline AI can't be
// used to bypass the abuse controls.
async function guardInlineAi(
  req: Request,
  res: Response,
): Promise<{ supabase: SupabaseServer; userId: string } | null> {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const userId = userData.user.id;

  // Plan quota first: accounts with no AI budget (Free) are turned away
  // before the burst limiter spends a usage_log row on them.
  const quota = await checkAiQuota(userId);
  if (!quota.allowed) {
    res.status(402).json({ error: quotaErrorMessage(quota) });
    return null;
  }

  const { data: allowed, error: rateErr } = await supabase.rpc(
    "check_chat_rate_limit",
    { p_user_id: userId },
  );
  if (rateErr) {
    req.log.error({ err: rateErr }, "inline-ai rate-limit rpc failed");
  } else if (allowed === false) {
    res
      .status(429)
      .json({ error: "Rate limit exceeded. Please wait a minute and try again." });
    return null;
  }
  return { supabase, userId };
}

// The language id is interpolated into the prompt and a markdown fence, so
// only plain identifiers (typescript, c++, objective-c) get through.
function sanitizeLanguage(value: unknown): string {
  return typeof value === "string" && /^[A-Za-z0-9+#._-]{1,40}$/.test(value)
    ? value
    : "text";
}

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```[\w-]*\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
}

// --- Ghost-text autocomplete (Cursor's Tab-to-accept) ---------------------
router.post("/ai/complete", async (req, res) => {
  try {
    const auth = await guardInlineAi(req, res);
    if (!auth) return;
    const { userId } = auth;

    const body = req.body as {
      prefix?: unknown;
      suffix?: unknown;
      language?: unknown;
      projectId?: unknown;
    };
    const prefix =
      typeof body.prefix === "string" ? body.prefix.slice(0, MAX_PREFIX_CHARS) : "";
    const suffix =
      typeof body.suffix === "string" ? body.suffix.slice(0, MAX_SUFFIX_CHARS) : "";
    const language = sanitizeLanguage(body.language);
    const projectId = typeof body.projectId === "string" ? body.projectId : null;
    if (!prefix.trim() && !suffix.trim()) {
      res.status(400).json({ error: "prefix or suffix required" });
      return;
    }

    // Latency is everything for ghost text: always the fastest configured tier.
    const { model, usedModelId } = resolveTaskModel("quick");

    // Qwen Coder natively speaks FIM (<|fim_*|>); every other model gets an
    // explicit cursor marker, which instruct models follow reliably.
    const prompt = usedModelId.startsWith("qwen")
      ? `<|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`
      : [
          `Complete the ${language} code at <CURSOR>.`,
          "Rules: output ONLY the code that belongs at the cursor (from the cursor forward).",
          "No markdown fences, no explanations, no restating existing code.",
          "",
          "```" + language,
          `${prefix}<CURSOR>${suffix}`,
          "```",
        ].join("\n");

    try {
      const { text, usage } = await generateText({
        model,
        prompt,
        temperature: 0.2,
        maxTokens: 150,
      });

      // Cut at the first blank line — anything after it is usually the model
      // wandering into the next function or adding commentary.
      let completion = stripCodeFences(text).slice(0, MAX_COMPLETION_CHARS);
      const lines = completion.split("\n");
      const blankAt = lines.findIndex((l, i) => i > 0 && !l.trim());
      if (blankAt > 0) completion = lines.slice(0, blankAt).join("\n");

      await recordAiUsage([
        {
          userId,
          orgId: null,
          projectId,
          modelId: usedModelId,
          kind: "completion",
          promptTokens: usage?.promptTokens,
          completionTokens: usage?.completionTokens,
        },
      ]);
      res.json({ completion });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      markProviderUnhealthyFromError(usedModelId, message);
      req.log.error({ err, modelId: usedModelId }, "completion failed");
      res.status(502).json({ error: "Completion failed. Try again in a moment." });
    }
  } catch (err) {
    // Never echo internal error text to the client; details stay in logs.
    req.log.error({ err }, "ai/complete route error");
    if (!res.headersSent) {
      res.status(500).json({ error: "Completion is unavailable right now." });
    }
  }
});

// --- Ctrl/Cmd+K inline edit (Cursor's cmd-K) -------------------------------
router.post("/ai/inline-edit", async (req, res) => {
  try {
    const auth = await guardInlineAi(req, res);
    if (!auth) return;
    const { userId } = auth;

    const body = req.body as {
      code?: unknown;
      instruction?: unknown;
      language?: unknown;
      projectId?: unknown;
    };
    const code =
      typeof body.code === "string" ? body.code.slice(0, MAX_SELECTION_CHARS) : "";
    const instruction =
      typeof body.instruction === "string"
        ? body.instruction.slice(0, MAX_INSTRUCTION_CHARS)
        : "";
    const language = sanitizeLanguage(body.language);
    const projectId = typeof body.projectId === "string" ? body.projectId : null;
    if (!code.trim() || !instruction.trim()) {
      res.status(400).json({ error: "code and instruction required" });
      return;
    }

    const { model, usedModelId } = resolveTaskModel("quick");

    try {
      const { text, usage } = await generateText({
        model,
        system: [
          "You are an expert pair programmer embedded in an IDE (Cursor-style inline edit).",
          "Rewrite the user's code exactly according to their instruction.",
          "Output ONLY the complete replacement code: no markdown fences, no",
          "explanations, no commentary, and never a diff format — plain code only.",
        ].join("\n"),
        prompt: [
          `Language: ${language}`,
          "",
          "Code:",
          "```" + language,
          code,
          "```",
          "",
          `Instruction: ${instruction}`,
          "",
          "Replacement code:",
        ].join("\n"),
        temperature: 0.3,
        maxTokens: 2_000,
      });

      const replacement = stripCodeFences(text).slice(0, MAX_EDIT_CHARS);

      await recordAiUsage([
        {
          userId,
          orgId: null,
          projectId,
          modelId: usedModelId,
          kind: "inline-edit",
          promptTokens: usage?.promptTokens,
          completionTokens: usage?.completionTokens,
        },
      ]);
      res.json({ code: replacement });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      markProviderUnhealthyFromError(usedModelId, message);
      req.log.error({ err, modelId: usedModelId }, "inline edit failed");
      res.status(502).json({ error: "Inline edit failed. Try again in a moment." });
    }
  } catch (err) {
    req.log.error({ err }, "ai/inline-edit route error");
    if (!res.headersSent) {
      res.status(500).json({ error: "Inline edit is unavailable right now." });
    }
  }
});

export default router;
