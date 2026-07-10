// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Play, RotateCw, Square } from "lucide-react";
import { runtime, type RuntimeStatus } from "@/lib/webcontainer/runtime";
import { useRuntimeState } from "@/hooks/use-runtime";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<RuntimeStatus, string> = {
  idle: "",
  booting: "Booting…",
  installing: "Installing…",
  starting: "Starting…",
  running: "Running",
  stopped: "Stopped",
  error: "Error",
};

/** Replit's green Run button: Run ↔ Stop, plus a restart shortcut while running. */
export function RunButton() {
  const { status } = useRuntimeState();
  const busy =
    status === "booting" || status === "installing" || status === "starting";
  const running = status === "running";

  return (
    <div className="flex items-center gap-2">
      {STATUS_LABEL[status] && (
        <span
          className={cn(
            "hidden text-xs lg:inline",
            running
              ? "text-green-600"
              : status === "error"
                ? "text-destructive"
                : "text-muted-foreground",
          )}
        >
          {STATUS_LABEL[status]}
        </span>
      )}
      {running && (
        <button
          type="button"
          onClick={() => void runtime.restart()}
          className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground"
          title="Restart app"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          if (running || busy) runtime.stop();
          else void runtime.run();
        }}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md px-4 text-sm font-semibold text-white",
          running || busy
            ? "bg-neutral-700 hover:bg-neutral-600"
            : "bg-green-600 hover:bg-green-500",
        )}
      >
        {busy ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Stop
          </>
        ) : running ? (
          <>
            <Square className="h-3.5 w-3.5 fill-current" /> Stop
          </>
        ) : (
          <>
            <Play className="h-3.5 w-3.5 fill-current" /> Run
          </>
        )}
      </button>
    </div>
  );
}
