import { anthropic } from "@ai-sdk/anthropic";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { getModelById, type ModelDescriptor } from "./models";

function openrouter() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }
  return createOpenRouter({ apiKey });
}

function nvidia() {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is not configured");
  }
  return createOpenAI({
    apiKey,
    baseURL: "https://integrate.api.nvidia.com/v1",
    compatibility: "compatible",
  });
}

function ensureProviderKey(provider: ModelDescriptor["provider"]) {
  const key = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    google: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    nvidia: process.env.NVIDIA_API_KEY,
  }[provider];
  if (!key) {
    throw new Error(
      `Missing API key for provider "${provider}". Set the matching env var.`,
    );
  }
}

export function resolveModel(modelId: string): LanguageModel {
  const descriptor = getModelById(modelId);
  if (!descriptor) {
    throw new Error(`Unknown model: ${modelId}`);
  }
  ensureProviderKey(descriptor.provider);

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
  }
}

export function listEnabledProviders(): Record<
  ModelDescriptor["provider"],
  boolean
> {
  return {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    google: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY,
    nvidia: !!process.env.NVIDIA_API_KEY,
  };
}
