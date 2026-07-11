// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useState } from "react";
import { Check, ExternalLink, GitBranch, Upload } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/hooks/use-projects";
import { useSecrets } from "@/hooks/use-secrets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Project } from "@/lib/types";

interface PushResult {
  repo: string;
  branch: string;
  commit: string;
  url: string;
  fileCount: number;
}

/**
 * Git tab: export/push the project to a GitHub repository as a commit
 * (Replit's GitHub integration). Import already exists on the dashboard.
 */
export function GitPane({ project }: { project: Project }) {
  const { data: secrets } = useSecrets(project.id);
  const savedToken = secrets?.find((s) => s.key === "GITHUB_TOKEN")?.value ?? "";
  const [repo, setRepo] = useState(project.github_repo ?? "");
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState<PushResult | null>(null);

  async function push() {
    const repoName = repo.trim();
    if (!/^[\w.-]+\/[\w.-]+$/.test(repoName)) {
      toast.error("Repository must look like owner/name");
      return;
    }
    setPushing(true);
    setResult(null);
    try {
      const res = await apiFetch<PushResult>(
        `/api/projects/${project.id}/github/push`,
        {
          method: "POST",
          body: JSON.stringify({
            repo: repoName,
            token: token.trim() || savedToken || undefined,
            message: message.trim() || undefined,
          }),
        },
      );
      setResult(res);
      setMessage("");
      toast.success(`Pushed ${res.fileCount} files to ${res.repo}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Push failed");
    } finally {
      setPushing(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Git
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          Push this project to GitHub as a commit. The repo is created
          (private) if it doesn't exist. To import a repo, use{" "}
          <span className="font-medium">Import</span> on the dashboard.
        </p>

        <div className="space-y-2 rounded-md border border-border p-3">
          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">
              Repository (owner/name)
            </label>
            <Input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="yourname/my-app"
              className="h-8 font-mono text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">
              Personal access token{" "}
              {savedToken
                ? "(using GITHUB_TOKEN from Secrets)"
                : "(or save one as GITHUB_TOKEN in Secrets)"}
            </label>
            <Input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={savedToken ? "••••••••" : "ghp_… (repo scope)"}
              className="h-8 font-mono text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">
              Commit message
            </label>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Update from Zola: ${project.name}`}
              className="h-8 text-xs"
            />
          </div>
          <Button
            size="sm"
            className="w-full"
            onClick={() => void push()}
            disabled={pushing || !repo.trim()}
          >
            {pushing ? (
              <>
                <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Pushing…
              </>
            ) : (
              <>
                <Upload className="mr-1.5 h-3.5 w-3.5" /> Push to GitHub
              </>
            )}
          </Button>
        </div>

        {result && (
          <div className="mt-3 rounded-md border border-green-600/40 bg-green-500/5 p-2.5 text-xs">
            <div className="flex items-center gap-1.5 font-medium text-green-600">
              <Check className="h-3.5 w-3.5" /> Pushed to {result.repo}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-muted-foreground">
              <GitBranch className="h-3 w-3" /> {result.branch} ·{" "}
              <code className="font-mono">{result.commit.slice(0, 7)}</code>
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-foreground underline underline-offset-2"
              >
                View <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}

        {project.github_repo && !result && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Last pushed to{" "}
            <a
              href={`https://github.com/${project.github_repo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              {project.github_repo}
            </a>
            .
          </p>
        )}
      </div>
    </div>
  );
}
