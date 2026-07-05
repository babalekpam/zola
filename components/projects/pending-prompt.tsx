// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

function deriveProjectName(prompt: string): string {
  const words = prompt.trim().split(/\s+/).slice(0, 6).join(" ");
  return words.length > 2 ? words : "New app";
}

/**
 * If the user typed a prompt on the landing page before signing up,
 * pick it up here and drop them straight into a new workspace.
 */
export function PendingPromptHandler() {
  const router = useRouter();
  const [active, setActive] = useState(false);

  useEffect(() => {
    const pending = sessionStorage.getItem("loop:pending-prompt");
    if (!pending) return;
    setActive(true);
    sessionStorage.removeItem("loop:pending-prompt");
    (async () => {
      try {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: deriveProjectName(pending) }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error();
        sessionStorage.setItem(
          `loop:initial-prompt:${json.project.id}`,
          pending,
        );
        router.push(`/projects/${json.project.id}`);
      } catch {
        setActive(false);
      }
    })();
  }, [router]);

  if (!active) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background/95">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">
        Creating your app workspace…
      </p>
    </div>
  );
}
