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
  description?: string;
  contextWindow?: number;
}

export const MODELS: ModelDescriptor[] = [
  {
    id: "claude-opus-4-8",
    label: "Claude Opus 4.8",
    provider: "anthropic",
    modelId: "claude-opus-4-8",
    description: "Anthropic's flagship reasoning model",
    contextWindow: 200_000,
  },
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: "anthropic",
    modelId: "claude-sonnet-4-6",
    description: "Balanced quality and speed",
    contextWindow: 200_000,
  },
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    provider: "anthropic",
    modelId: "claude-haiku-4-5-20251001",
    description: "Fast and inexpensive",
    contextWindow: 200_000,
  },
  {
    id: "gpt-5",
    label: "GPT-5",
    provider: "openai",
    modelId: "gpt-5",
    description: "OpenAI's flagship",
    contextWindow: 400_000,
  },
  {
    id: "gpt-5-mini",
    label: "GPT-5 mini",
    provider: "openai",
    modelId: "gpt-5-mini",
    description: "Smaller, faster GPT-5",
    contextWindow: 400_000,
  },
  {
    id: "gpt-4.1",
    label: "GPT-4.1",
    provider: "openai",
    modelId: "gpt-4.1",
    description: "Strong general-purpose model",
    contextWindow: 1_000_000,
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "google",
    modelId: "gemini-2.5-pro",
    description: "Google's flagship",
    contextWindow: 2_000_000,
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "google",
    modelId: "gemini-2.5-flash",
    description: "Fast and cheap",
    contextWindow: 1_000_000,
  },
  {
    id: "kimi-k2",
    label: "Kimi K2 (via OpenRouter)",
    provider: "openrouter",
    modelId: "moonshotai/kimi-k2",
    description: "Moonshot AI's coding model",
    contextWindow: 128_000,
  },
  {
    id: "deepseek-v3",
    label: "DeepSeek V3 (via OpenRouter)",
    provider: "openrouter",
    modelId: "deepseek/deepseek-chat",
    description: "Strong open coding model",
    contextWindow: 128_000,
  },
  {
    id: "llama-3.3-70b",
    label: "Llama 3.3 70B (via OpenRouter)",
    provider: "openrouter",
    modelId: "meta-llama/llama-3.3-70b-instruct",
    description: "Meta's open model",
    contextWindow: 128_000,
  },
  {
    id: "nvidia-qwen-coder-32b",
    label: "Qwen 2.5 Coder 32B (NVIDIA)",
    provider: "nvidia",
    modelId: "qwen/qwen2.5-coder-32b-instruct",
    description: "Strong open-weight coding model on NVIDIA NIM",
    contextWindow: 32_000,
  },
  {
    id: "nvidia-llama-3.3-70b",
    label: "Llama 3.3 70B (NVIDIA)",
    provider: "nvidia",
    modelId: "meta/llama-3.3-70b-instruct",
    description: "Meta's flagship open model on NVIDIA NIM",
    contextWindow: 128_000,
  },
  {
    id: "nvidia-deepseek-r1",
    label: "DeepSeek R1 (NVIDIA)",
    provider: "nvidia",
    modelId: "deepseek-ai/deepseek-r1",
    description: "Open-weight reasoning model on NVIDIA NIM",
    contextWindow: 128_000,
  },
  {
    id: "nvidia-llama-3.1-nemotron-70b",
    label: "Llama 3.1 Nemotron 70B (NVIDIA)",
    provider: "nvidia",
    modelId: "nvidia/llama-3.1-nemotron-70b-instruct",
    description: "NVIDIA-tuned Llama, strong general-purpose",
    contextWindow: 128_000,
  },
];

export const DEFAULT_MODEL_ID = "nvidia-qwen-coder-32b";

export function getModelById(id: string): ModelDescriptor | undefined {
  return MODELS.find((m) => m.id === id);
}

export function getModelsByProvider(
  provider: ProviderId,
): ModelDescriptor[] {
  return MODELS.filter((m) => m.provider === provider);
}
