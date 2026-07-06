// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface Props {
  redirectTo?: string;
}

const PROVIDERS: { id: "google" | "github"; label: string; icon: string }[] = [
  {
    id: "google",
    label: "Continue with Google",
    icon: "M21.35 11.1h-9.18v2.94h5.27c-.23 1.4-1.66 4.1-5.27 4.1-3.17 0-5.76-2.62-5.76-5.85s2.59-5.85 5.76-5.85c1.81 0 3.02.77 3.71 1.43l2.53-2.44C16.97 3.86 14.78 3 12.17 3 7.13 3 3 7.13 3 12.18s4.13 9.18 9.17 9.18c5.3 0 8.8-3.72 8.8-8.95 0-.6-.07-1.06-.18-1.31z",
  },
  {
    id: "github",
    label: "Continue with GitHub",
    icon: "M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.16c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.27-5.24-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.17.91-.25 1.89-.38 2.86-.38.97 0 1.95.13 2.86.38 2.19-1.48 3.15-1.17 3.15-1.17.62 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.36.78 1.05.78 2.12v3.14c0 .31.21.67.8.56 4.56-1.52 7.85-5.83 7.85-10.91C23.5 5.65 18.35.5 12 .5z",
  },
];

export function OAuthButtons({ redirectTo = "/projects" }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  async function signIn(provider: "google" | "github") {
    setLoading(provider);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    });
  }

  return (
    <div className="space-y-2">
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => void signIn(p.id)}
          disabled={loading !== null}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
            <path d={p.icon} />
          </svg>
          {loading === p.id ? "Redirecting…" : p.label}
        </button>
      ))}
      <div className="flex items-center gap-2 py-1">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          or
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
