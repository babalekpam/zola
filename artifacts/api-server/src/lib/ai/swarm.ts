// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { generateText } from "ai";
import { resolveTaskModel } from "./providers";
import { CODING_SYSTEM_PROMPT } from "./system-prompt";
import { classifyTask, type TaskKind } from "./models";
import type { UsageRecord } from "./quota";

// Coordinated agent swarm: an architect model decomposes the request into
// parallel specialist tasks with DISJOINT file assignments, each task runs on
// the best available model for its kind (design work on the design model,
// logic on the coding model, …), and the outputs merge into one response.
// Disjoint ownership is what makes naive parallel merging safe.

export interface SwarmTask {
  title: string;
  kind: TaskKind;
  files: string[];
  instructions: string;
}

export interface SwarmWorkerResult {
  task: SwarmTask;
  modelId: string;
  text: string;
}

const MAX_TASKS = 4;

const ARCHITECT_PROMPT = `You are the architect of a swarm of AI coding agents building a web app together.

Decompose the user's request into 2-${MAX_TASKS} INDEPENDENT tasks that can run in parallel. Rules:
- Each task OWNS a disjoint set of files — two tasks must NEVER touch the same file.
- kind is one of: "design" (visual/UI/styling work), "code" (logic, state, data), "quick" (small mechanical edits), "plan" (only if research is truly needed — avoid).
- Prefer 2-3 tasks. Use 1 task if the request is small — do not pad.
- files lists the project file paths the task will create or modify.
- instructions must be self-contained: the worker sees the project files and ONLY its own instructions, not the other tasks.

Respond with ONLY this JSON, no prose, no code fences:
{"tasks":[{"title":"...","kind":"code","files":["src/App.tsx"],"instructions":"..."}]}`;

function parseTasks(raw: string, fallbackPrompt: string): SwarmTask[] {
  try {
    const cleaned = raw
      .trim()
      .replace(/^```(json)?/i, "")
      .replace(/```$/, "")
      .trim();
    const parsed = JSON.parse(cleaned) as { tasks?: SwarmTask[] };
    const tasks = (parsed.tasks ?? [])
      .filter(
        (t) =>
          t &&
          typeof t.instructions === "string" &&
          Array.isArray(t.files),
      )
      .slice(0, MAX_TASKS)
      .map((t) => ({
        title: String(t.title ?? "Task"),
        kind: (["design", "code", "plan", "quick"] as TaskKind[]).includes(t.kind)
          ? t.kind
          : "code",
        files: t.files.map(String),
        instructions: t.instructions,
      }));
    // Enforce disjoint ownership: a file claimed twice stays with the first
    // task that claimed it.
    const owned = new Set<string>();
    for (const task of tasks) {
      task.files = task.files.filter((f) => {
        if (owned.has(f)) return false;
        owned.add(f);
        return true;
      });
    }
    if (tasks.length > 0) return tasks;
  } catch {
    // fall through to single-task fallback
  }
  return [
    {
      title: "Build the request",
      kind: classifyTask(fallbackPrompt),
      files: [],
      instructions: fallbackPrompt,
    },
  ];
}

export interface SwarmRun {
  tasks: SwarmTask[];
  architectModelId: string;
  /** Resolves in task order; each promise is one worker's finished output. */
  workers: Promise<SwarmWorkerResult>[];
  usages: Omit<UsageRecord, "userId" | "orgId" | "projectId">[];
}

export async function startSwarm(
  prompt: string,
  projectContext: string,
): Promise<SwarmRun> {
  const usages: SwarmRun["usages"] = [];

  const architect = resolveTaskModel("plan");
  const planResult = await generateText({
    model: architect.model,
    system: ARCHITECT_PROMPT,
    prompt: `User request: ${prompt}\n${projectContext}`,
    temperature: 0.2,
    maxTokens: 1500,
  });
  usages.push({
    modelId: architect.usedModelId,
    kind: "swarm-architect",
    promptTokens: planResult.usage?.promptTokens,
    completionTokens: planResult.usage?.completionTokens,
  });

  const tasks = parseTasks(planResult.text, prompt);

  // All workers start immediately (parallel); consumers await in order.
  const workers = tasks.map(async (task): Promise<SwarmWorkerResult> => {
    const { model, usedModelId } = resolveTaskModel(task.kind);
    const scope =
      task.files.length > 0
        ? `You may ONLY create or modify these files: ${task.files.join(", ")}. Other agents own the rest of the codebase — do not touch their files.`
        : "";
    const result = await generateText({
      model,
      system: `${CODING_SYSTEM_PROMPT}\n\nYou are one specialist agent in a coordinated swarm. ${scope}\nKeep prose to one short paragraph after your file blocks.`,
      prompt: `Overall user request (for context): ${prompt}\n\nYOUR task — ${task.title}: ${task.instructions}\n${projectContext}`,
      temperature: 0.4,
    });
    usages.push({
      modelId: usedModelId,
      kind: "swarm-worker",
      promptTokens: result.usage?.promptTokens,
      completionTokens: result.usage?.completionTokens,
    });
    return { task, modelId: usedModelId, text: result.text };
  });

  return { tasks, architectModelId: architect.usedModelId, workers, usages };
}
