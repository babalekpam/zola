// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { runtime } from "@/lib/webcontainer/runtime";
import type { WebContainerProcess } from "@webcontainer/api";

/**
 * Interactive shell into the project's WebContainer — the equivalent of
 * Replit's Shell tab. One jsh process lives for as long as the pane is
 * mounted; the tool pane keeps it mounted across tab switches.
 */
export function ShellPane() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    let disposed = false;
    let proc: WebContainerProcess | null = null;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      theme: { background: "#0a0a0a" },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    fit.fit();

    async function connect() {
      term.writeln("Connecting to shell…");
      try {
        const shell = await runtime.spawnShell(term.cols, term.rows);
        if (disposed) {
          shell.kill();
          return;
        }
        proc = shell;
        term.clear();

        shell.output.pipeTo(
          new WritableStream({
            write: (data) => {
              if (!disposed) term.write(data);
            },
          }),
        );
        const input = shell.input.getWriter();
        term.onData((data) => void input.write(data));
        term.onResize(({ cols, rows }) => shell.resize({ cols, rows }));

        void shell.exit.then((code) => {
          if (!disposed) term.writeln(`\r\n[shell exited with code ${code}]`);
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!disposed) {
          term.writeln(`\r\nCould not start shell: ${msg}`);
          setError(msg);
        }
      }
    }
    void connect();

    const observer = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        // host may be display:none while another tab is active
      }
    });
    observer.observe(hostRef.current);

    return () => {
      disposed = true;
      proc?.kill();
      observer.disconnect();
      term.dispose();
    };
  }, []);

  return (
    <div className="flex h-full flex-col bg-[#0a0a0a]">
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Shell
        </span>
        {error && (
          <span className="truncate text-[11px] text-destructive/90">{error}</span>
        )}
      </div>
      <div ref={hostRef} className="min-h-0 flex-1 pl-2 pt-1" />
    </div>
  );
}
