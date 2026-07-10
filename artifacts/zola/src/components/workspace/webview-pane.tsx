// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useRef } from "react";
import { ExternalLink, Globe, RefreshCw } from "lucide-react";
import { useRuntimeState } from "@/hooks/use-runtime";
import type { RuntimeStatus } from "@/lib/webcontainer/runtime";
import { cn } from "@/lib/utils";

const STATUS_TEXT: Record<RuntimeStatus, string> = {
  idle: "Press Run to start your app.",
  booting: "Booting WebContainer…",
  installing: "Installing dependencies…",
  starting: "Starting dev server…",
  running: "Server is starting…",
  stopped: "App stopped. Press Run to start it again.",
  error: "Something went wrong. Check the Console tab.",
};

export function WebviewPane() {
  const { status, url, error } = useRuntimeState();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1">
          <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {url ?? "—"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            // Cross-origin iframe: contentWindow.location is inaccessible, so
            // force a reload by re-assigning src.
            if (iframeRef.current && url) iframeRef.current.src = url;
          }}
          disabled={!url}
          className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
          title="Reload webview"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <a
          href={url ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "rounded p-1 text-muted-foreground hover:text-foreground",
            !url && "pointer-events-none opacity-40",
          )}
          title="Open in new tab"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {url ? (
        <iframe
          ref={iframeRef}
          src={url}
          className="w-full flex-1 border-0 bg-white"
          title="Webview"
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          {status === "error" ? (
            <div className="text-3xl">⚠️</div>
          ) : status === "idle" || status === "stopped" ? (
            <Globe className="h-6 w-6 text-muted-foreground" />
          ) : (
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
          <p className="text-sm text-muted-foreground">{STATUS_TEXT[status]}</p>
          {status === "error" && error && (
            <p className="max-w-md text-xs leading-relaxed text-destructive/90">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
