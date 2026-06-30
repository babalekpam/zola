// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FileSystemTree, WebContainer } from "@webcontainer/api";
import { RefreshCw, Square, Play, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";

let bootPromise: Promise<WebContainer> | null = null;
async function getContainer(): Promise<WebContainer> {
  if (!bootPromise) {
    bootPromise = import("@webcontainer/api").then(({ WebContainer }) =>
      WebContainer.boot(),
    );
  }
  return bootPromise;
}

function filesToTree(files: Record<string, string>): FileSystemTree {
  const tree: FileSystemTree = {};
  for (const [path, content] of Object.entries(files)) {
    const segs = path.split("/");
    let cur: FileSystemTree = tree;
    segs.forEach((seg, i) => {
      if (i === segs.length - 1) {
        cur[seg] = { file: { contents: content } };
      } else {
        if (!cur[seg]) cur[seg] = { directory: {} };
        const node = cur[seg] as { directory: FileSystemTree };
        cur = node.directory;
      }
    });
  }
  return tree;
}

interface Props {
  files: Record<string, string>;
}

export function WebContainerPreview({ files }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const containerRef = useRef<WebContainer | null>(null);
  const devProcessRef = useRef<{ kill: () => void } | null>(null);

  const appendLog = useCallback((line: string) => {
    setLogs((prev) => [...prev.slice(-400), line]);
  }, []);

  const run = useCallback(async () => {
    setLogs([]);
    setUrl(null);
    setRunning(true);
    try {
      const container = await getContainer();
      containerRef.current = container;
      await container.mount(filesToTree(files));

      appendLog("$ npm install");
      const install = await container.spawn("npm", ["install"]);
      install.output.pipeTo(
        new WritableStream({ write: (chunk) => appendLog(chunk) }),
      );
      const code = await install.exit;
      if (code !== 0) {
        appendLog(`npm install exited with code ${code}`);
        setRunning(false);
        return;
      }

      appendLog("$ npm run dev");
      const dev = await container.spawn("npm", ["run", "dev"]);
      devProcessRef.current = dev;
      dev.output.pipeTo(
        new WritableStream({ write: (chunk) => appendLog(chunk) }),
      );

      container.on("server-ready", (_port, serverUrl) => {
        setUrl(serverUrl);
      });
    } catch (e) {
      appendLog(e instanceof Error ? e.message : String(e));
      setRunning(false);
    }
  }, [files, appendLog]);

  const stop = useCallback(() => {
    try {
      devProcessRef.current?.kill();
    } catch {
      // ignore
    }
    devProcessRef.current = null;
    setUrl(null);
    setRunning(false);
  }, []);

  useEffect(() => {
    if (!containerRef.current || !running) return;
    let cancelled = false;
    (async () => {
      const container = containerRef.current!;
      for (const [path, content] of Object.entries(files)) {
        if (cancelled) return;
        try {
          await container.fs.writeFile(path, content);
        } catch {
          const dir = path.split("/").slice(0, -1).join("/");
          if (dir) {
            await container.fs.mkdir(dir, { recursive: true });
            await container.fs.writeFile(path, content);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [files, running]);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="text-xs font-medium text-muted-foreground">
          Preview
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowLogs((s) => !s)}
          >
            <Terminal className="mr-1 h-3.5 w-3.5" />
            {showLogs ? "Hide logs" : "Logs"}
          </Button>
          {running ? (
            <>
              <Button size="sm" variant="outline" onClick={() => stop()}>
                <Square className="mr-1 h-3.5 w-3.5" /> Stop
              </Button>
              <Button size="sm" variant="outline" onClick={() => void run()}>
                <RefreshCw className="mr-1 h-3.5 w-3.5" /> Restart
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => void run()}>
              <Play className="mr-1 h-3.5 w-3.5" /> Run
            </Button>
          )}
        </div>
      </div>
      <div className="relative flex-1">
        {url ? (
          <iframe
            key={url}
            src={url}
            className="absolute inset-0 h-full w-full bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {running ? "Booting WebContainer…" : "Press Run to launch the app."}
          </div>
        )}
        {showLogs ? (
          <div className="absolute bottom-0 left-0 right-0 h-1/2 overflow-y-auto border-t border-border bg-background/95 p-2 font-mono text-[11px] text-muted-foreground">
            {logs.length === 0 ? (
              <div>No output yet.</div>
            ) : (
              logs.map((l, i) => (
                <div key={i} className="whitespace-pre-wrap">
                  {l}
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}