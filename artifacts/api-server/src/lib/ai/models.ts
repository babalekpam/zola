// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
export type ProviderId =
  | "anthropic"
  | "openai"
  | "google"
  | "openrouter"
  | "nvidia";

export interface ModelDescriptor {
  id: string;
  label: string;
  provider: ProviderId;
  modelId: string;
}

export const MODELS: ModelDescriptor[] = [
  { id: "claude-opus-4-8", label: "Claude Opus 4.8", provider: "anthropic", modelId: "claude-opus-4-8" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic", modelId: "claude-sonnet-4-6" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "anthropic", modelId: "claude-haiku-4-5-20251001" },
  { id: "gpt-5", label: "GPT-5", provider: "openai", modelId: "gpt-5" },
  { id: "gpt-5-mini", label: "GPT-5 mini", provider: "openai", modelId: "gpt-5-mini" },
  { id: "gpt-4.1", label: "GPT-4.1", provider: "openai", modelId: "gpt-4.1" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "google", modelId: "gemini-2.5-pro" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "google", modelId: "gemini-2.5-flash" },
  { id: "kimi-k2", label: "Kimi K2", provider: "openrouter", modelId: "moonshotai/kimi-k2" },
  { id: "deepseek-v3", label: "DeepSeek V3", provider: "openrouter", modelId: "deepseek/deepseek-chat" },
  { id: "llama-3.3-70b", label: "Llama 3.3 70B", provider: "openrouter", modelId: "meta-llama/llama-3.3-70b-instruct" },
  { id: "nvidia-qwen-coder-32b", label: "Qwen 2.5 Coder 32B", provider: "nvidia", modelId: "qwen/qwen2.5-coder-32b-instruct" },
  { id: "nvidia-llama-3.3-70b", label: "Llama 3.3 70B (NVIDIA)", provider: "nvidia", modelId: "meta/llama-3.3-70b-instruct" },
  { id: "nvidia-deepseek-r1", label: "DeepSeek R1 (NVIDIA)", provider: "nvidia", modelId: "deepseek-ai/deepseek-r1" },
  { id: "nvidia-llama-3.1-nemotron-70b", label: "Llama 3.1 Nemotron 70B", provider: "nvidia", modelId: "nvidia/llama-3.1-nemotron-70b-instruct" },
];

export const DEFAULT_MODEL_ID = "claude-sonnet-4-6";

// First model to try per provider when falling back.
export const PROVIDER_DEFAULT_MODEL: Record<ProviderId, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-5-mini",
  google: "gemini-2.5-flash",
  openrouter: "kimi-k2",
  nvidia: "nvidia-qwen-coder-32b",
};

// Fallback order when the requested provider has no API key.
export const PROVIDER_PRIORITY: ProviderId[] = [
  "anthropic",
  "openai",
  "google",
  "nvidia",
  "openrouter",
];

export function getModelById(id: string): ModelDescriptor | undefined {
  return MODELS.find((m) => m.id === id);
}
