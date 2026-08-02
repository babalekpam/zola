// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Router } from "express";
import {
  streamText,
  pipeDataStreamToResponse,
  formatDataStreamPart,
  type CoreMessage,
  type ToolSet,
} from "ai";
import {
  resolveAutoModel,
  resolveModelWithFallback,
  resolveTaskModel,
  markProviderUnhealthyFromError,
} from "../lib/ai/providers";
import { CODING_SYSTEM_PROMPT, DESIGN_SYSTEM_PROMPT, PLANNING_SYSTEM_PROMPT } from "../lib/ai/system-prompt";
import { AUTO_MODEL_ID, DEFAULT_MODEL_ID } from "../lib/ai/models";
import { checkAiQuota, recordAiUsage } from "../lib/ai/quota";
import { buildSkillsSection, isSkillFile } from "../lib/ai/skills";
import { startSwarm } from "../lib/ai/swarm";
import {
  buildMcpSection,
  closeConnections,
  connectMcpServers,
  type McpConnection,
  type McpServerRow,
} from "../lib/mcp/client";
import { createSupabaseServerClient } from "../lib/supabase";

const router = Router();

// Abuse caps: chat is resold platform AI, so inputs are bounded server-side.
const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 32_000;
const MAX_CONTEXT_CHARS = 240_000;
// Tool-call rounds per turn. High enough for a read → act → confirm sequence,
// low enough that a looping model can't burn the user's quota.
const MAX_TOOL_STEPS = 8;

function lastUserText(messages: CoreMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  return last && typeof last.content === "string" ? last.content : "";
}

router.post("/chat", async (req, res) => {
  try {
    const supabase = createSupabaseServerClient(req, res);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const userId = userData.user.id;

    // Per-minute burst limit (DB-side) + monthly plan quota (metered usage).
    const { data: allowed, error: rateErr } = await supabase.rpc(
      "check_chat_rate_limit",
      { p_user_id: userId },
    );
    if (rateErr) {
      req.log.error({ err: rateErr }, "rate-limit rpc failed");
    } else if (allowed === false) {
      res.status(429).json({ error: "Rate limit exceeded. Please wait a minute and try again." });
      return;
    }

    const quota = await checkAiQuota(userId);
    if (!quota.allowed) {
      res.status(402).json({
        error: `Monthly AI limit reached (${quota.used}/${quota.limit} on the ${quota.plan} plan). Upgrade your plan to keep building.`,
      });
      return;
    }

    const body = req.body as {
      messages: CoreMessage[];
      modelId?: string;
      projectFiles?: Record<string, string>;
      projectId?: string;
      planMode?: boolean;
      swarmMode?: boolean;
      designMode?: boolean;
    };

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      res.status(400).json({ error: "messages required" });
      return;
    }
    const messages = body.messages.slice(-MAX_MESSAGES);
    for (const m of messages) {
      if (typeof m.content === "string" && m.content.length > MAX_MESSAGE_CHARS) {
        res.status(400).json({ error: "Message too long" });
        return;
      }
    }

    const prompt = lastUserText(messages);

    // Model routing: explicit pick, or the Auto task router (design work to
    // the design model, coding to the coding model, quick edits to the fast
    // one) with provider-availability fallback either way.
    const requestedModelId = body.modelId ?? DEFAULT_MODEL_ID;
    let model;
    let modelId: string;
    if (requestedModelId === AUTO_MODEL_ID) {
      // Design mode always deserves the design-tier model; otherwise classify.
      const routed = body.designMode
        ? { ...resolveTaskModel("design"), task: "design" as const }
        : resolveAutoModel(prompt);
      model = routed.model;
      modelId = routed.usedModelId;
    } else {
      const resolved = resolveModelWithFallback(requestedModelId);
      model = resolved.model;
      modelId = resolved.usedModelId;
    }

    // Skills get their own prompt section (never truncated away with the
    // file listing), and skill files are excluded from the listing so they
    // aren't sent twice.
    const skillsSection = body.projectFiles ? buildSkillsSection(body.projectFiles) : "";
    let fileListing = body.projectFiles
      ? `\n\nCurrent project files:\n${Object.entries(body.projectFiles)
          .filter(([p]) => !isSkillFile(p))
          .map(([p, c]) => `--- ${p} ---\n${c.slice(0, 4000)}`)
          .join("\n\n")}`
      : "";
    if (fileListing.length > MAX_CONTEXT_CHARS) {
      fileListing = fileListing.slice(0, MAX_CONTEXT_CHARS);
    }
    const projectContext = skillsSection + fileListing;

    let orgId: string | null = null;
    if (body.projectId) {
      const { data: project } = await supabase
        .from("projects")
        .select("org_id")
        .eq("id", body.projectId)
        .maybeSingle();
      orgId = project?.org_id ?? null;
      if (prompt) {
        await supabase.from("messages").insert({
          project_id: body.projectId,
          role: "user",
          content: prompt,
          model_id: modelId,
        });
      }
    }

    const saveAssistant = async (text: string, usedModel: string) => {
      if (body.projectId && text) {
        await supabase.from("messages").insert({
          project_id: body.projectId,
          role: "assistant",
          content: text,
          model_id: usedModel,
        });
      }
    };

    // --- Swarm mode: architect → parallel specialists → merged stream ------
    if (body.swarmMode && !body.planMode) {
      pipeDataStreamToResponse(res, {
        execute: async (writer) => {
          const emit = (text: string) =>
            writer.write(formatDataStreamPart("text", text));

          emit("🐝 **Swarm** — planning…\n\n");
          const run = await startSwarm(prompt, projectContext);
          emit(
            `Plan (${run.tasks.length} agent${run.tasks.length > 1 ? "s" : ""}): ${run.tasks
              .map((t) => `**${t.title}** [${t.kind}]`)
              .join(" · ")}\n\n---\n\n`,
          );

          let fullText = "";
          for (const workerPromise of run.workers) {
            const worker = await workerPromise;
            const section = `### ${worker.task.title} · \`${worker.modelId}\`\n\n${worker.text}\n\n`;
            emit(section);
            fullText += section;
          }

          await saveAssistant(
            `🐝 Swarm (${run.tasks.length} agents)\n\n${fullText}`,
            "swarm",
          );
          await recordAiUsage(
            run.usages.map((u) => ({
              ...u,
              userId,
              orgId,
              projectId: body.projectId ?? null,
            })),
          );
        },
        onError: (err) =>
          err instanceof Error ? err.message : "Swarm failed",
      });
      return;
    }

    // --- Single-agent mode --------------------------------------------------
    const basePrompt = body.planMode
      ? PLANNING_SYSTEM_PROMPT
      : body.designMode
        ? DESIGN_SYSTEM_PROMPT
        : CODING_SYSTEM_PROMPT;

    // MCP: dial the project's enabled tool servers and hand their tools to the
    // model. Servers that don't answer are skipped rather than fatal — a dead
    // third-party endpoint must not cost the user their chat turn.
    let mcpConnections: McpConnection[] = [];
    let mcpTools: ToolSet = {};
    if (body.projectId) {
      const { data: mcpRows } = await supabase
        .from("project_mcp_servers")
        .select("id, name, transport, url, headers")
        .eq("project_id", body.projectId)
        .eq("enabled", true);
      if (mcpRows && mcpRows.length > 0) {
        const connected = await connectMcpServers(mcpRows as McpServerRow[]);
        mcpConnections = connected.connections;
        mcpTools = connected.tools;
        for (const failure of connected.failures) {
          req.log.warn({ failure }, "mcp server unavailable");
        }
      }
    }
    const mcpSection = buildMcpSection(mcpConnections);
    const hasTools = Object.keys(mcpTools).length > 0;

    const result = streamText({
      model,
      system: basePrompt + projectContext + mcpSection,
      messages,
      temperature: 0.4,
      ...(hasTools
        ? { tools: mcpTools, maxSteps: MAX_TOOL_STEPS }
        : {}),
      async onFinish({ text, usage, steps }) {
        await closeConnections(mcpConnections);
        // With tools the answer spans several steps; the visible reply is every
        // step's prose joined, not just the last one.
        const full = steps?.length
          ? steps.map((s) => s.text).filter(Boolean).join("\n\n")
          : text;
        await saveAssistant(full, modelId);
        await recordAiUsage([
          {
            userId,
            orgId,
            projectId: body.projectId ?? null,
            modelId,
            kind: "chat",
            promptTokens: usage?.promptTokens,
            completionTokens: usage?.completionTokens,
          },
        ]);
      },
      async onError({ error }) {
        await closeConnections(mcpConnections);
        const message = error instanceof Error ? error.message : String(error);
        // Bench providers with dead keys so the next Auto request routes around them.
        const benched = markProviderUnhealthyFromError(modelId, message);
        req.log.error({ err: error, modelId, benched }, "chat stream error");
      },
    });

    result.pipeDataStreamToResponse(res, {
      getErrorMessage: (error) => {
        const message = error instanceof Error ? error.message : String(error);
        return `Model ${modelId} failed: ${message.slice(0, 300)}. Try again — a failing provider is skipped for a few minutes — or pick another model.`;
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "chat route error");
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    }
  }
});

export default router;
