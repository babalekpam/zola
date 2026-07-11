// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { usePresence } from "@/hooks/use-presence";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const COLORS = [
  "bg-blue-600",
  "bg-emerald-600",
  "bg-violet-600",
  "bg-rose-600",
  "bg-amber-600",
  "bg-cyan-600",
];

function colorFor(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

/** Live "who's here" avatar stack, Replit multiplayer style. */
export function PresenceAvatars({ projectId }: { projectId: string }) {
  const users = usePresence(projectId);
  if (users.length <= 1) return null;

  const shown = users.slice(0, 5);
  const extra = users.length - shown.length;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center -space-x-1.5">
        {shown.map((u) => (
          <Tooltip key={u.id}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold uppercase text-white",
                  colorFor(u.id),
                )}
              >
                {u.email[0] ?? "?"}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {u.email}
              {u.self ? " (you)" : ""}
            </TooltipContent>
          </Tooltip>
        ))}
        {extra > 0 && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium text-muted-foreground">
            +{extra}
          </span>
        )}
      </div>
    </TooltipProvider>
  );
}
