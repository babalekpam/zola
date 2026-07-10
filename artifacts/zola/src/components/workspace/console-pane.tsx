// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useEffect, useRef } from "react";
import { Ban } from "lucide-react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { runtime } from "@/lib/webcontainer/runtime";

/**
 * Read-only stream of the npm install / dev-server output. Rendered through
 * xterm so ANSI colors and carriage-return progress bars from npm/vite display
 * correctly instead of as escape garbage.
 */
export function ConsolePane() {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const term = new Terminal({
      convertEol: true,
      disableStdin: true,
      fontSize: 12,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      theme: { background: "#0a0a0a" },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    fit.fit();
    termRef.current = term;

    const unsubscribe = runtime.subscribeConsole((chunk) => term.write(chunk));
    const observer = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        // host may be display:none while another tab is active
      }
    });
    observer.observe(hostRef.current);

    return () => {
      unsubscribe();
      observer.disconnect();
      term.dispose();
      termRef.current = null;
    };
  }, []);

  return (
    <div className="flex h-full flex-col bg-[#0a0a0a]">
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Console
        </span>
        <button
          type="button"
          onClick={() => {
            runtime.clearConsole();
            termRef.current?.clear();
          }}
          className="flex items-center gap-1 rounded p-1 text-[11px] text-muted-foreground hover:text-foreground"
          title="Clear console"
        >
          <Ban className="h-3 w-3" /> Clear
        </button>
      </div>
      <div ref={hostRef} className="min-h-0 flex-1 pl-2 pt-1" />
    </div>
  );
}
