// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useRef, useState } from "react";
import { Check, Copy, ExternalLink, Globe, Link2, Rocket, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useDeployments,
  useCreateDeployment,
  siteUrl,
} from "@/hooks/use-deployments";
import { runtime } from "@/lib/webcontainer/runtime";
import {
  useDomains,
  useAddDomain,
  useVerifyDomain,
  useDeleteDomain,
} from "@/hooks/use-domains";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

        {current && <DomainsSection projectId={projectId} />}

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

/** Link an organization's own domain to this deployment, Replit-style. */
function DomainsSection({ projectId }: { projectId: string }) {
  const { data: domains } = useDomains(projectId);
  const add = useAddDomain(projectId);
  const verify = useVerifyDomain(projectId);
  const remove = useDeleteDomain(projectId);
  const [draft, setDraft] = useState("");
  const platformHost = (() => {
    try {
      const api = import.meta.env.VITE_API_URL as string | undefined;
      return new URL(api || window.location.origin).host;
    } catch {
      return window.location.host;
    }
  })();

  function submit() {
    const domain = draft.trim();
    if (!domain) return;
    add.mutate(domain, {
      onSuccess: () => setDraft(""),
      onError: (err) => toast.error(err.message),
    });
  }

  return (
    <div className="mt-4">
      <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Custom domains
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="app.yourdomain.com"
          className="h-8 font-mono text-xs"
        />
        <Button size="sm" variant="outline" onClick={submit} disabled={add.isPending}>
          <Link2 className="mr-1 h-3.5 w-3.5" /> Link
        </Button>
      </div>

      {domains?.map((d) => (
        <div key={d.id} className="mt-2 rounded-md border border-border p-2.5">
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium">
              {d.domain}
            </span>
            {d.verified ? (
              <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600">
                <ShieldCheck className="h-3 w-3" /> Live
              </span>
            ) : (
              <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] font-medium text-yellow-600">
                Pending DNS
              </span>
            )}
            <button
              type="button"
              onClick={() =>
                remove.mutate(d.id, { onError: (err) => toast.error(err.message) })
              }
              className="rounded p-1 text-muted-foreground hover:text-destructive"
              title="Remove domain"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {!d.verified && (
            <div className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <p>Add these DNS records at your registrar:</p>
              <div className="rounded bg-muted/40 p-2 font-mono text-[10px]">
                <div className="flex items-center gap-1">
                  <span className="min-w-0 flex-1 truncate">
                    TXT&nbsp; _zola-challenge.{d.domain} = {d.token}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(d.token);
                      toast.success("Token copied");
                    }}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                    title="Copy token"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
                <div className="mt-1 truncate">
                  CNAME {d.domain} → {platformHost}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-full text-xs"
                onClick={() =>
                  verify.mutate(d.id, {
                    onSuccess: () => toast.success(`${d.domain} is live`),
                    onError: (err) => toast.error(err.message),
                  })
                }
                disabled={verify.isPending}
              >
                <Check className="mr-1 h-3 w-3" />
                {verify.isPending ? "Checking DNS…" : "Verify"}
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
