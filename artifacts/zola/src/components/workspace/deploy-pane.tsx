// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useRef, useState } from "react";
import { ExternalLink, Globe, Rocket } from "lucide-react";
import { toast } from "sonner";
import {
  useDeployments,
  useCreateDeployment,
  siteUrl,
} from "@/hooks/use-deployments";
import { runtime } from "@/lib/webcontainer/runtime";
import { Button } from "@/components/ui/button";

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/**
 * Replit-style Deployments: builds the project inside the WebContainer and
 * publishes the static output to a stable public URL, keeping a history.
 */
export function DeployPane({ projectId }: { projectId: string }) {
  const { data: deployments, isLoading } = useDeployments(projectId);
  const createDeployment = useCreateDeployment(projectId);
  const [building, setBuilding] = useState(false);
  const [log, setLog] = useState("");
  const logRef = useRef<HTMLPreElement>(null);

  const current = deployments?.[0];

  async function deploy() {
    setBuilding(true);
    setLog("");
    try {
      const files = await runtime.buildForDeploy((line) => {
        setLog((prev) => (prev + line).slice(-20_000));
        requestAnimationFrame(() => {
          logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
        });
      });
      const deployment = await createDeployment.mutateAsync(files);
      toast.success("Deployed!");
      setLog((prev) => `${prev}\nLive at ${siteUrl(deployment.slug)}\n`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
      setLog((prev) => `${prev}\nError: ${msg}\n`);
    } finally {
      setBuilding(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Deployments
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {current && (
          <a
            href={siteUrl(current.slug)}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 flex items-center gap-2 rounded-md border border-green-600/40 bg-green-500/5 px-3 py-2 text-xs hover:bg-green-500/10"
          >
            <Globe className="h-3.5 w-3.5 shrink-0 text-green-600" />
            <span className="min-w-0 flex-1 truncate font-mono">
              {siteUrl(current.slug)}
            </span>
            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
          </a>
        )}

        <Button onClick={() => void deploy()} disabled={building} className="w-full">
          {building ? (
            <>
              <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Building & deploying…
            </>
          ) : (
            <>
              <Rocket className="mr-2 h-3.5 w-3.5" />
              {current ? "Redeploy" : "Deploy to the web"}
            </>
          )}
        </Button>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Builds your app (<code className="rounded bg-muted px-1">vite build</code>)
          and publishes the static output to a public URL. Redeploys keep the
          same URL.
        </p>

        {log && (
          <pre
            ref={logRef}
            className="mt-3 max-h-48 overflow-y-auto rounded-md bg-black p-2 font-mono text-[10px] leading-relaxed text-green-400 whitespace-pre-wrap"
          >
            {log}
          </pre>
        )}

        <div className="mt-4">
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            History
          </div>
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : !deployments?.length ? (
            <p className="text-xs text-muted-foreground">No deployments yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {deployments.map((d, i) => (
                <li
                  key={d.id}
                  className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs"
                >
                  <span
                    className={
                      i === 0
                        ? "h-1.5 w-1.5 shrink-0 rounded-full bg-green-500"
                        : "h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40"
                    }
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {i === 0 ? "Live" : "Superseded"} · {d.file_count} files
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {timeAgo(d.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
