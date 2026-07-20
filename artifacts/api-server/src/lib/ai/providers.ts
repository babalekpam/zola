// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { anthropic } from "@ai-sdk/anthropic";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import {
  classifyTask,
  getModelById,
  PROVIDER_DEFAULT_MODEL,
  PROVIDER_PRIORITY,
  TASK_ROUTES,
  type ModelDescriptor,
  type ProviderId,
  type TaskKind,
} from "./models";

function openrouter() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");
  return createOpenRouter({ apiKey });
}

// OpenAI-compatible providers share one factory; each needs only a key + URL.
function openAICompatible(
  envVar: string,
  baseURL: string,
  name: string,
) {
  const apiKey = process.env[envVar];
  if (!apiKey) throw new Error(`${envVar} is not configured`);
  return createOpenAI({ apiKey, baseURL, name });
}

const nvidia = () =>
  openAICompatible("NVIDIA_API_KEY", "https://integrate.api.nvidia.com/v1", "nvidia");
const groq = () =>
  openAICompatible("GROQ_API_KEY", "https://api.groq.com/openai/v1", "groq");
const deepseek = () =>
  openAICompatible("DEEPSEEK_API_KEY", "https://api.deepseek.com/v1", "deepseek");
const qwen = () =>
  openAICompatible(
    "DASHSCOPE_API_KEY",
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    "qwen",
  );
const moonshot = () =>
  openAICompatible("MOONSHOT_API_KEY", "https://api.moonshot.ai/v1", "moonshot");
const xai = () =>
  openAICompatible("XAI_API_KEY", "https://api.x.ai/v1", "xai");

const PROVIDER_ENV: Record<ProviderId, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  nvidia: "NVIDIA_API_KEY",
  groq: "GROQ_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  qwen: "DASHSCOPE_API_KEY",
  moonshot: "MOONSHOT_API_KEY",
  xai: "XAI_API_KEY",
};

function ensureProviderKey(provider: ModelDescriptor["provider"]) {
  if (!process.env[PROVIDER_ENV[provider]]) {
    throw new Error(
      `Missing API key for provider "${provider}". Set ${PROVIDER_ENV[provider]}.`,
    );
  }
}

function providerHasKey(provider: ProviderId): boolean {
  return !!process.env[PROVIDER_ENV[provider]];
}

function instantiate(descriptor: ModelDescriptor): LanguageModel {
  switch (descriptor.provider) {
    case "anthropic":
      return anthropic(descriptor.modelId);
    case "openai":
      return openai(descriptor.modelId);
    case "google":
      return google(descriptor.modelId);
    case "openrouter":
      return openrouter().chat(descriptor.modelId);
    case "nvidia":
      return nvidia()(descriptor.modelId);
    case "groq":
      return groq()(descriptor.modelId);
    case "deepseek":
      return deepseek()(descriptor.modelId);
    case "qwen":
      return qwen()(descriptor.modelId);
    case "moonshot":
      return moonshot()(descriptor.modelId);
    case "xai":
      return xai()(descriptor.modelId);
  }
}

export function resolveModel(modelId: string): LanguageModel {
  const descriptor = getModelById(modelId);
  if (!descriptor) throw new Error(`Unknown model: ${modelId}`);
  ensureProviderKey(descriptor.provider);
  return instantiate(descriptor);
}

/**
 * Resolve the requested model, falling back to the first provider that has
 * an API key configured (Anthropic first) when the requested provider's key
 * is missing. Chat works as long as any one provider key is set.
 */
export function resolveModelWithFallback(modelId: string): {
  model: LanguageModel;
  usedModelId: string;
  fellBack: boolean;
} {
  const requested = getModelById(modelId);
  if (requested && providerHasKey(requested.provider)) {
    return {
      model: instantiate(requested),
      usedModelId: requested.id,
      fellBack: false,
    };
  }

  for (const provider of PROVIDER_PRIORITY) {
    if (!providerHasKey(provider)) continue;
    const descriptor = getModelById(PROVIDER_DEFAULT_MODEL[provider]);
    if (!descriptor) continue;
    return {
      model: instantiate(descriptor),
      usedModelId: descriptor.id,
      fellBack: true,
    };
  }

  throw new Error(
    "No AI provider is configured. Set at least one API key (ANTHROPIC_API_KEY recommended).",
  );
}

/**
 * Resolve a model for a task kind: first candidate in the task's route whose
 * provider key is configured, else the global fallback chain.
 */
export function resolveTaskModel(task: TaskKind): {
  model: LanguageModel;
  usedModelId: string;
} {
  for (const candidateId of TASK_ROUTES[task]) {
    const descriptor = getModelById(candidateId);
    if (descriptor && providerHasKey(descriptor.provider)) {
      return { model: instantiate(descriptor), usedModelId: descriptor.id };
    }
  }
  const fallback = resolveModelWithFallback("");
  return { model: fallback.model, usedModelId: fallback.usedModelId };
}

/**
 * The "Auto" router: classify the prompt, then route to the best available
 * model for that kind of work (design → design model, coding → coding model…).
 */
export function resolveAutoModel(prompt: string): {
  model: LanguageModel;
  usedModelId: string;
  task: TaskKind;
} {
  const task = classifyTask(prompt);
  const { model, usedModelId } = resolveTaskModel(task);
  return { model, usedModelId, task };
}
