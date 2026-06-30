// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { MODELS, type ProviderId } from "@/lib/ai/models";
import { cn } from "@/lib/utils";

const PROVIDER_LABEL: Record<ProviderId, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  openrouter: "OpenRouter",
  nvidia: "NVIDIA NIM",
};

interface Props {
  value: string;
  onChange: (id: string) => void;
}

export function ModelPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const current = MODELS.find((m) => m.id === value) ?? MODELS[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
      >
        <span className="text-muted-foreground">
          {PROVIDER_LABEL[current.provider]}
        </span>
        <span>{current.label}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>
      {open ? (
        <div
          className="absolute right-0 z-20 mt-1 w-72 overflow-hidden rounded-md border border-border bg-card shadow-lg"
          onMouseLeave={() => setOpen(false)}
        >
          {(
            ["nvidia", "anthropic", "openai", "google", "openrouter"] as ProviderId[]
          ).map(
            (provider) => {
              const models = MODELS.filter((m) => m.provider === provider);
              return (
                <div key={provider} className="border-b border-border last:border-b-0">
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {PROVIDER_LABEL[provider]}
                  </div>
                  {models.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        onChange(m.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-accent",
                        m.id === value && "bg-accent/60",
                      )}
                    >
                      <div>
                        <div className="font-medium">{m.label}</div>
                        {m.description ? (
                          <div className="text-[11px] text-muted-foreground">
                            {m.description}
                          </div>
                        ) : null}
                      </div>
                      {m.id === value ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : null}
                    </button>
                  ))}
                </div>
              );
            },
          )}
        </div>
      ) : null}
    </div>
  );
}