import { streamText, type CoreMessage } from "ai";
import { NextResponse } from "next/server";
import { resolveModel } from "@/lib/ai/providers";
import { CODING_SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { DEFAULT_MODEL_ID } from "@/lib/ai/models";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      messages: CoreMessage[];
      modelId?: string;
      projectFiles?: Record<string, string>;
    };
    const modelId = body.modelId ?? DEFAULT_MODEL_ID;
    const model = resolveModel(modelId);

    const projectContext = body.projectFiles
      ? `\n\nCurrent project files:\n${Object.entries(body.projectFiles)
          .map(([p, c]) => `--- ${p} ---\n${c.slice(0, 4000)}`)
          .join("\n\n")}`
      : "";

    const result = streamText({
      model,
      system: CODING_SYSTEM_PROMPT + projectContext,
      messages: body.messages,
      temperature: 0.4,
    });

    return result.toDataStreamResponse();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
