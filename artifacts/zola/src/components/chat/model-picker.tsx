// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { MODELS } from "@/lib/ai/models";

interface Props {
  value: string;
  onChange: (id: string) => void;
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  openrouter: "OpenRouter",
  nvidia: "NVIDIA",
};

export function ModelPicker({ value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
    >
      {Object.entries(PROVIDER_LABELS).map(([provider, label]) => {
        const group = MODELS.filter((m) => m.provider === provider);
        if (group.length === 0) return null;
        return (
          <optgroup key={provider} label={label}>
            {group.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}
