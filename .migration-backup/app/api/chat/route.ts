// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { streamText, type CoreMessage } from "ai";
import { NextResponse } from "next/server";
import { resolveModel } from "@/lib/ai/providers";
import { CODING_SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { DEFAULT_MODEL_ID } from "@/lib/ai/models";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: allowed, error: rateErr } = await supabase.rpc(
      "check_chat_rate_limit",
      { p_user_id: userData.user.id },
    );
    if (rateErr) {
      console.error("rate-limit rpc failed", rateErr);
    } else if (allowed === false) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait a minute and try again." },
        { status: 429 },
      );
    }

    const body = (await req.json()) as {
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

    return result.toDataStreamResponse();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
