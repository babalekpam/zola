// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
export type ProviderId =
  | "anthropic"
  | "openai"
  | "google"
  | "openrouter"
  | "nvidia"
  | "groq"
  | "deepseek"
  | "qwen"
  | "moonshot"
  | "xai";

export interface ModelDescriptor {
  id: string;
  label: string;
  provider: ProviderId;
  modelId: string;
}

export const MODELS: ModelDescriptor[] = [
  // Anthropic
  { id: "claude-opus-4-8", label: "Claude Opus 4.8", provider: "anthropic", modelId: "claude-opus-4-8" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic", modelId: "claude-sonnet-4-6" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "anthropic", modelId: "claude-haiku-4-5-20251001" },
  // OpenAI
  { id: "gpt-5", label: "GPT-5", provider: "openai", modelId: "gpt-5" },
  { id: "gpt-5-mini", label: "GPT-5 mini", provider: "openai", modelId: "gpt-5-mini" },
  { id: "gpt-4.1", label: "GPT-4.1", provider: "openai", modelId: "gpt-4.1" },
  // xAI (Grok)
  { id: "grok-4", label: "Grok 4", provider: "xai", modelId: "grok-4" },
  { id: "grok-4-fast", label: "Grok 4 Fast", provider: "xai", modelId: "grok-4-fast" },
  { id: "grok-code-fast-1", label: "Grok Code Fast", provider: "xai", modelId: "grok-code-fast-1" },
  // Google
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "google", modelId: "gemini-2.5-pro" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "google", modelId: "gemini-2.5-flash" },
  // Groq (ultra-fast inference)
  { id: "groq-kimi-k2", label: "Kimi K2 (Groq)", provider: "groq", modelId: "moonshotai/kimi-k2-instruct" },
  { id: "groq-llama-3.3-70b", label: "Llama 3.3 70B (Groq)", provider: "groq", modelId: "llama-3.3-70b-versatile" },
  // DeepSeek (direct)
  { id: "deepseek-chat", label: "DeepSeek V3", provider: "deepseek", modelId: "deepseek-chat" },
  { id: "deepseek-reasoner", label: "DeepSeek R1 (Reasoner)", provider: "deepseek", modelId: "deepseek-reasoner" },
  // Qwen (Alibaba DashScope, direct)
  { id: "qwen3-coder", label: "Qwen3 Coder", provider: "qwen", modelId: "qwen3-coder-plus" },
  { id: "qwen-max", label: "Qwen Max", provider: "qwen", modelId: "qwen-max" },
  // Kimi / Moonshot (direct)
  { id: "kimi-k2", label: "Kimi K2", provider: "moonshot", modelId: "kimi-k2-turbo-preview" },
  // OpenRouter (gateway fallbacks)
  { id: "or-kimi-k2", label: "Kimi K2 (OpenRouter)", provider: "openrouter", modelId: "moonshotai/kimi-k2" },
  { id: "or-deepseek-v3", label: "DeepSeek V3 (OpenRouter)", provider: "openrouter", modelId: "deepseek/deepseek-chat" },
  { id: "llama-3.3-70b", label: "Llama 3.3 70B", provider: "openrouter", modelId: "meta-llama/llama-3.3-70b-instruct" },
  // NVIDIA
  { id: "nvidia-qwen-coder-32b", label: "Qwen 2.5 Coder 32B", provider: "nvidia", modelId: "qwen/qwen2.5-coder-32b-instruct" },
  { id: "nvidia-llama-3.3-70b", label: "Llama 3.3 70B (NVIDIA)", provider: "nvidia", modelId: "meta/llama-3.3-70b-instruct" },
  { id: "nvidia-deepseek-r1", label: "DeepSeek R1 (NVIDIA)", provider: "nvidia", modelId: "deepseek-ai/deepseek-r1" },
  { id: "nvidia-llama-3.1-nemotron-70b", label: "Llama 3.1 Nemotron 70B", provider: "nvidia", modelId: "nvidia/llama-3.1-nemotron-70b-instruct" },
];

export const DEFAULT_MODEL_ID = "claude-sonnet-4-6";

/**
 * The virtual "Auto" model: the router classifies each request and picks the
 * best available model for the task. Not in MODELS — it never instantiates
 * directly.
 */
export const AUTO_MODEL_ID = "auto";

export type TaskKind = "design" | "code" | "plan" | "quick";

// Candidate models per task, best first. The resolver walks the list and
// uses the first whose provider key is configured, so the routing degrades
// gracefully with whatever keys the platform has.
export const TASK_ROUTES: Record<TaskKind, string[]> = {
  design: ["gpt-5", "claude-sonnet-4-6", "gemini-2.5-pro", "qwen-max"],
  code: ["claude-sonnet-4-6", "qwen3-coder", "gpt-5", "deepseek-chat", "groq-kimi-k2"],
  plan: ["claude-opus-4-8", "deepseek-reasoner", "gpt-5", "gemini-2.5-pro", "kimi-k2"],
  quick: ["groq-kimi-k2", "claude-haiku-4-5", "gemini-2.5-flash", "gpt-5-mini", "deepseek-chat"],
};

const DESIGN_RE =
  /\b(design|redesign|styl(e|ing)|css|tailwind|color|colour|theme|font|layout|responsive|beautiful|pretty|landing page|ui|ux|look and feel|animation|dark mode|logo|branding)\b/i;
const PLAN_RE =
  /\b(plan|architect(ure)?|approach|strategy|roadmap|think through|design doc|structure the|how should|compare|trade-?offs?)\b/i;
const QUICK_RE =
  /^(fix|change|update|rename|remove|delete|adjust|tweak|bump|correct)\b/i;

/** Cheap deterministic task classifier — no extra model call, no latency. */
export function classifyTask(prompt: string): TaskKind {
  const p = prompt.trim();
  if (PLAN_RE.test(p) && p.length > 40) return "plan";
  if (DESIGN_RE.test(p)) return "design";
  if (QUICK_RE.test(p) && p.length < 120) return "quick";
  return "code";
}

// First model to try per provider when falling back.
export const PROVIDER_DEFAULT_MODEL: Record<ProviderId, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-5-mini",
  google: "gemini-2.5-flash",
  groq: "groq-kimi-k2",
  deepseek: "deepseek-chat",
  qwen: "qwen3-coder",
  moonshot: "kimi-k2",
  xai: "grok-4-fast",
  openrouter: "or-kimi-k2",
  nvidia: "nvidia-qwen-coder-32b",
};

// Fallback order when the requested provider has no API key.
export const PROVIDER_PRIORITY: ProviderId[] = [
  "anthropic",
  "openai",
  "google",
  "deepseek",
  "qwen",
  "groq",
  "moonshot",
  "xai",
  "nvidia",
  "openrouter",
];

export function getModelById(id: string): ModelDescriptor | undefined {
  return MODELS.find((m) => m.id === id);
}
