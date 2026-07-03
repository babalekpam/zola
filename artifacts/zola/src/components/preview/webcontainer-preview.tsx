// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useEffect, useRef, useState } from "react";
import { WebContainer } from "@webcontainer/api";
import { ExternalLink, RefreshCw, Terminal as TerminalIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  files: Record<string, string>;
}

type Status = "idle" | "booting" | "installing" | "starting" | "running" | "error";

interface LogLine {
  id: number;
  text: string;
}

let wcInstance: WebContainer | null = null;
let wcBooting = false;

export function WebContainerPreview({ files }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const logIdRef = useRef(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const filesRef = useRef(files);
  const bootedRef = useRef(false);

  function addLog(text: string) {
    setLogs((prev) => [...prev.slice(-200), { id: ++logIdRef.current, text }]);
  }

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (bootedRef.current && wcInstance) {
        // Mount updated files
        const mfs = toMountStructure(filesRef.current);
        await wcInstance.mount(mfs);
        return;
      }
      if (wcBooting) return;
      wcBooting = true;
      setStatus("booting");
      addLog("Booting WebContainer…");
      try {
        wcInstance = await WebContainer.boot();
        addLog("WebContainer booted.");
        if (cancelled) return;

        setStatus("installing");
        addLog("Mounting project files…");
        const mfs = toMountStructure(filesRef.current);
        await wcInstance.mount(mfs);
        addLog("Installing dependencies (npm install)…");
        const install = await wcInstance.spawn("npm", ["install"]);
        install.output.pipeTo(
          new WritableStream({ write: (data) => addLog(data) }),
        );
        const code = await install.exit;
        if (code !== 0) throw new Error(`npm install failed (exit ${code})`);
        if (cancelled) return;

        setStatus("starting");
        addLog("Starting dev server (npm run dev)…");
        const dev = await wcInstance.spawn("npm", ["run", "dev"]);
        dev.output.pipeTo(
          new WritableStream({ write: (data) => addLog(data) }),
        );

        wcInstance.on("server-ready", (_port, serverUrl) => {
          if (cancelled) return;
          addLog(`Server ready at ${serverUrl}`);
          setUrl(serverUrl);
          setStatus("running");
        });

        bootedRef.current = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        addLog(`Error: ${msg}`);
        setStatus("error");
      } finally {
        wcBooting = false;
      }
    }

    void boot();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When files change and container is running, hot-update files
  useEffect(() => {
    if (!wcInstance || !bootedRef.current) return;
    const mfs = toMountStructure(files);
    void wcInstance.mount(mfs).catch(() => {});
  }, [files]);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Preview</span>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <button
            type="button"
            onClick={() => setShowLogs((v) => !v)}
            className={cn(
              "rounded p-1 text-muted-foreground hover:text-foreground",
              showLogs && "text-foreground",
            )}
            title="Toggle terminal logs"
          >
            <TerminalIcon className="h-3.5 w-3.5" />
          </button>
          {url && (
            <>
              <button
                type="button"
                onClick={() => iframeRef.current?.contentWindow?.location.reload()}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
                title="Reload preview"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded p-1 text-muted-foreground hover:text-foreground"
                title="Open in new tab"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </>
          )}
        </div>
      </div>

      {showLogs ? (
        <div className="flex-1 overflow-y-auto bg-black p-3 font-mono text-[11px] text-green-400">
          {logs.map((l) => (
            <div key={l.id} className="whitespace-pre-wrap">{l.text}</div>
          ))}
        </div>
      ) : url ? (
        <iframe
          ref={iframeRef}
          src={url}
          className="flex-1 w-full border-0"
          title="Preview"
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center px-6">
          <StatusIcon status={status} />
          <p className="text-sm text-muted-foreground">{STATUS_TEXT[status]}</p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const colors: Record<Status, string> = {
    idle: "bg-muted text-muted-foreground",
    booting: "bg-yellow-500/20 text-yellow-400",
    installing: "bg-blue-500/20 text-blue-400",
    starting: "bg-blue-500/20 text-blue-400",
    running: "bg-green-500/20 text-green-400",
    error: "bg-destructive/20 text-destructive",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] uppercase font-medium", colors[status])}>
      {status}
    </span>
  );
}

const STATUS_TEXT: Record<Status, string> = {
  idle: "WebContainer not started yet.",
  booting: "Booting WebContainer…",
  installing: "Installing dependencies…",
  starting: "Starting dev server…",
  running: "Server is starting…",
  error: "Something went wrong. Check logs.",
};

function StatusIcon({ status }: { status: Status }) {
  if (status === "error") {
    return <div className="text-3xl">⚠️</div>;
  }
  return (
    <div className={cn("h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin", status === "running" && "border-green-500")} />
  );
}

type FileSystemTree = Record<string, { file: { contents: string } } | { directory: FileSystemTree }>;

function toMountStructure(files: Record<string, string>): FileSystemTree {
  const root: FileSystemTree = {};
  for (const [path, content] of Object.entries(files)) {
    const segs = path.split("/");
    let cur = root;
    segs.forEach((seg, i) => {
      if (i === segs.length - 1) {
        cur[seg] = { file: { contents: content } };
      } else {
        if (!cur[seg]) cur[seg] = { directory: {} };
        cur = (cur[seg] as { directory: FileSystemTree }).directory;
      }
    });
  }
  return root;
}
