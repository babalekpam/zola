// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Router } from "express";
import { streamText } from "ai";
import { resolveModel } from "../lib/ai/providers";
import { CODING_SYSTEM_PROMPT } from "../lib/ai/system-prompt";
import { DEFAULT_MODEL_ID } from "../lib/ai/models";
import { createSupabaseServerClient } from "../lib/supabase";

type CoreMessage = {
  role: "user" | "assistant" | "system";
  content: string | Array<{ type: string; text?: string; [key: string]: unknown }>;
};

const router = Router();

router.post("/chat", async (req, res) => {
  try {
    const supabase = createSupabaseServerClient(req, res);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { data: allowed, error: rateErr } = await supabase.rpc(
      "check_chat_rate_limit",
      { p_user_id: userData.user.id },
    );
    if (rateErr) {
      req.log.error({ err: rateErr }, "rate-limit rpc failed");
    } else if (allowed === false) {
      res.status(429).json({ error: "Rate limit exceeded. Please wait a minute and try again." });
      return;
    }

    const body = req.body as {
      messages: CoreMessage[];
      modelId?: string;
      projectFiles?: Record<string, string>;
      projectId?: string;
    };
    const modelId = body.modelId ?? DEFAULT_MODEL_ID;
    const model = resolveModel(modelId);

    const projectContext = body.projectFiles
      ? `\n\nCurrent project files:\n${Object.entries(body.projectFiles)
          .map(([p, c]) => `--- ${p} ---\n${c.slice(0, 4000)}`)
          .join("\n\n")}`
      : "";

    if (body.projectId && body.messages.length > 0) {
      const lastUser = [...body.messages]
        .reverse()
        .find((m) => m.role === "user");
      if (lastUser && typeof lastUser.content === "string") {
        await supabase.from("messages").insert({
          project_id: body.projectId,
          role: "user",
          content: lastUser.content,
          model_id: modelId,
        });
      }
    }

    const result = streamText({
      model,
      system: CODING_SYSTEM_PROMPT + projectContext,
      messages: body.messages,
      temperature: 0.4,
      async onFinish({ text }) {
        if (body.projectId && text) {
          await supabase.from("messages").insert({
            project_id: body.projectId,
            role: "assistant",
            content: text,
            model_id: modelId,
          });
        }
      },
    });

    result.pipeUIMessageStreamToResponse(res);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "chat route error");
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    }
  }
});

export default router;
