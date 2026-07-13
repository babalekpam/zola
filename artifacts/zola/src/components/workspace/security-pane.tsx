// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  FileWarning,
  Globe,
  Info,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useSecrets } from "@/hooks/use-secrets";
import { useUpdateProject } from "@/hooks/use-projects";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/types";

type Severity = "critical" | "warning" | "info";

interface Finding {
  ruleId: string;
  severity: Severity;
  title: string;
  advice: string;
  path: string;
  line: number;
  /** Trimmed source line with any matched secret material masked. */
  snippet: string;
}

interface Rule {
  id: string;
  severity: Severity;
  title: string;
  advice: string;
  re: RegExp;
  /** Mask the matched text in the reported snippet (for secret material). */
  mask?: boolean;
}

const RULES: Rule[] = [
  {
    id: "aws-key",
    severity: "critical",
    title: "AWS access key in code",
    advice: "Revoke this key in the AWS console and move it to Secrets.",
    re: /\bAKIA[0-9A-Z]{16}\b/,
    mask: true,
  },
  {
    id: "google-key",
    severity: "critical",
    title: "Google API key in code",
    advice: "Restrict or rotate this key, then move it to Secrets.",
    re: /\bAIza[0-9A-Za-z_-]{35}\b/,
    mask: true,
  },
  {
    id: "stripe-key",
    severity: "critical",
    title: "Stripe secret key in code",
    advice: "Roll this key in the Stripe dashboard and move it to Secrets.",
    re: /\b(?:sk|rk)_(?:live|test)_[0-9a-zA-Z]{16,}\b/,
    mask: true,
  },
  {
    id: "github-token",
    severity: "critical",
    title: "GitHub token in code",
    advice: "Revoke this token on GitHub and move it to Secrets.",
    re: /\b(?:gh[pousr]_[0-9A-Za-z]{36,}|github_pat_[0-9A-Za-z_]{22,})\b/,
    mask: true,
  },
  {
    id: "slack-token",
    severity: "critical",
    title: "Slack token in code",
    advice: "Revoke this token in Slack and move it to Secrets.",
    re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/,
    mask: true,
  },
  {
    id: "openai-key",
    severity: "critical",
    title: "OpenAI API key in code",
    advice: "Rotate this key on platform.openai.com and move it to Secrets.",
    re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}T3BlbkFJ[A-Za-z0-9_-]{20,}\b/,
    mask: true,
  },
  {
    id: "private-key",
    severity: "critical",
    title: "Private key committed",
    advice: "Remove the key file from the project and store it outside code.",
    re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY(?: BLOCK)?-----/,
  },
  {
    id: "hardcoded-credential",
    severity: "warning",
    title: "Hardcoded credential",
    advice: "Move the value to Secrets and read it from the environment.",
    re: /(?:api[_-]?key|secret|password|passwd|auth[_-]?token)\s*[:=]\s*["'][^"']{8,}["']/i,
    mask: true,
  },
  {
    id: "eval",
    severity: "info",
    title: "Dynamic code execution",
    advice: "eval / new Function can run injected code — avoid them on untrusted input.",
    re: /\beval\s*\(|\bnew\s+Function\s*\(/,
  },
  {
    id: "raw-html",
    severity: "info",
    title: "Raw HTML injection",
    advice: "Rendering unsanitized HTML enables XSS — sanitize or use text APIs.",
    re: /dangerouslySetInnerHTML|\.innerHTML\s*=|document\.write\s*\(/,
  },
  {
    id: "insecure-http",
    severity: "info",
    title: "Insecure http:// URL",
    advice: "Use https:// so requests can't be read or tampered with in transit.",
    re: /["'`]http:\/\/(?!localhost|127\.|0\.0\.0\.0|www\.w3\.org|schemas?\.)[^"'`\s]+/,
  },
];

/** Values that make a "hardcoded credential" hit an obvious placeholder. */
const PLACEHOLDER_RE =
  /your[_-]?|xxx|example|changeme|placeholder|<[^>]*>|\.\.\.|dummy|sample/i;

const SKIP_PATH_RE =
  /(^|\/)(node_modules|dist|build|\.git)(\/|$)|\.(png|jpe?g|gif|webp|ico|svg|woff2?|ttf|eot|map|lock)$|(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$|\.min\.(js|css)$/;

const CODE_EXT_RE =
  /\.(jsx?|tsx?|mjs|cjs|json|html?|css|vue|svelte|astro|py|rb|go|rs|java|php|sh|ya?ml|toml|env.*|txt|md)$/i;

function maskSecret(text: string): string {
  if (text.length <= 8) return "••••";
  return `${text.slice(0, 4)}…${"•".repeat(6)}`;
}

function scanFiles(files: Record<string, string>): Finding[] {
  const findings: Finding[] = [];

  for (const [path, content] of Object.entries(files)) {
    if (SKIP_PATH_RE.test(path)) continue;
    const base = path.split("/").pop() ?? path;
    const isEnvFile = /^\.env(\..+)?$/.test(base) && !/example|sample|template/.test(base);
    if (!isEnvFile && !CODE_EXT_RE.test(base)) continue;
    if (typeof content !== "string" || content.length > 400_000) continue;

    // A committed .env file is itself a finding — its whole point is to hold
    // values that shouldn't live in the project.
    if (isEnvFile) {
      const hasValues = content
        .split("\n")
        .some((l) => /^[A-Za-z_][A-Za-z0-9_]*\s*=\s*\S/.test(l.trim()));
      if (hasValues) {
        findings.push({
          ruleId: "env-file",
          severity: "warning",
          title: ".env file in project",
          advice: "Move these values to the Secrets tab — they're injected as env vars automatically.",
          path,
          line: 1,
          snippet: base,
        });
      }
      continue;
    }

    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 1000) continue; // minified / data blobs
      const usesEnv = /process\.env|import\.meta\.env/.test(line);

      for (const rule of RULES) {
        if (usesEnv && (rule.severity === "critical" || rule.id === "hardcoded-credential"))
          continue;
        const m = line.match(rule.re);
        if (!m) continue;
        if (rule.id === "hardcoded-credential" && PLACEHOLDER_RE.test(m[0])) continue;

        let snippet = line.trim();
        if (rule.mask) snippet = snippet.replace(rule.re, (s) => maskSecret(s));
        if (snippet.length > 90) snippet = `${snippet.slice(0, 90)}…`;

        findings.push({
          ruleId: rule.id,
          severity: rule.severity,
          title: rule.title,
          advice: rule.advice,
          path,
          line: i + 1,
          snippet,
        });
        break; // one finding per line is enough
      }
    }
  }

  const order: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
  return findings
    .sort((a, b) => order[a.severity] - order[b.severity] || a.path.localeCompare(b.path))
    .slice(0, 100);
}

const SEVERITY_META: Record<
  Severity,
  { label: string; dot: string; badge: string; border: string }
> = {
  critical: {
    label: "Critical",
    dot: "bg-red-500",
    badge: "bg-red-500/10 text-red-500",
    border: "border-l-red-500",
  },
  warning: {
    label: "Warning",
    dot: "bg-yellow-500",
    badge: "bg-yellow-500/10 text-yellow-600",
    border: "border-l-yellow-500",
  },
  info: {
    label: "Info",
    dot: "bg-sky-500",
    badge: "bg-sky-500/10 text-sky-500",
    border: "border-l-sky-500",
  },
};

interface Props {
  project: Project;
  files: Record<string, string>;
  onOpenFile: (path: string) => void;
}

/**
 * Workspace Security center: a posture score, project access controls, and a
 * client-side scan of project files for leaked keys and risky patterns.
 * Everything runs locally over the already-loaded file map — nothing is sent
 * anywhere.
 */
export function SecurityPane({ project, files, onOpenFile }: Props) {
  const { data: secrets } = useSecrets(project.id);
  const update = useUpdateProject();
  const [scanNonce, setScanNonce] = useState(0);
  const [showInfo, setShowInfo] = useState(true);

  const findings = useMemo(
    () => scanFiles(files),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [files, scanNonce],
  );

  const counts = {
    critical: findings.filter((f) => f.severity === "critical").length,
    warning: findings.filter((f) => f.severity === "warning").length,
    info: findings.filter((f) => f.severity === "info").length,
  };

  const isPublic = (project.visibility ?? "private") === "public";
  // Leaked key material in a public project is the worst case: weight it up.
  const score = Math.max(
    0,
    100 -
      counts.critical * (isPublic ? 35 : 25) -
      counts.warning * 10 -
      counts.info * 3,
  );
  const grade =
    score >= 90
      ? { label: "Protected", tone: "text-green-500", ring: "bg-green-500/10", bar: "bg-green-500" }
      : score >= 65
        ? { label: "Needs attention", tone: "text-yellow-600", ring: "bg-yellow-500/10", bar: "bg-yellow-500" }
        : { label: "At risk", tone: "text-red-500", ring: "bg-red-500/10", bar: "bg-red-500" };
  const GradeIcon = score >= 90 ? ShieldCheck : ShieldAlert;

  const fileCount = Object.keys(files).filter((p) => !SKIP_PATH_RE.test(p)).length;
  const visible = showInfo ? findings : findings.filter((f) => f.severity !== "info");

  function setVisibility(visibility: "private" | "public") {
    update.mutate(
      { id: project.id, visibility },
      {
        onSuccess: () =>
          toast.success(
            visibility === "public"
              ? "Project is now public — anyone can view and remix it"
              : "Project is now private",
          ),
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Security
        </span>
        <button
          type="button"
          onClick={() => setScanNonce((n) => n + 1)}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Rescan project files"
        >
          <RefreshCw className="h-3 w-3" />
          Rescan
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {/* Posture score */}
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-3">
            <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", grade.ring)}>
              <GradeIcon className={cn("h-6 w-6", grade.tone)} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-semibold tabular-nums">{score}</span>
                <span className={cn("text-xs font-medium", grade.tone)}>{grade.label}</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", grade.bar)}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className={cn("h-1.5 w-1.5 rounded-full", counts.critical ? "bg-red-500" : "bg-muted-foreground/30")} />
              {counts.critical} critical
            </span>
            <span className="flex items-center gap-1">
              <span className={cn("h-1.5 w-1.5 rounded-full", counts.warning ? "bg-yellow-500" : "bg-muted-foreground/30")} />
              {counts.warning} warnings
            </span>
            <span className="flex items-center gap-1">
              <span className={cn("h-1.5 w-1.5 rounded-full", counts.info ? "bg-sky-500" : "bg-muted-foreground/30")} />
              {counts.info} info
            </span>
            <span className="ml-auto">{fileCount} files scanned</span>
          </div>
        </div>

        {/* Access */}
        <div className="mb-1.5 mt-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Access
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 rounded-md border border-border px-2.5 py-2">
            {isPublic ? (
              <Globe className="h-4 w-4 shrink-0 text-yellow-600" />
            ) : (
              <Lock className="h-4 w-4 shrink-0 text-green-500" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium">
                {isPublic ? "Public project" : "Private project"}
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">
                {isPublic
                  ? "All code is world-readable on Explore and can be remixed — never keep credentials in it."
                  : "Only you and invited collaborators can see this project."}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 shrink-0 text-xs"
              disabled={update.isPending}
              onClick={() => setVisibility(isPublic ? "private" : "public")}
            >
              {isPublic ? "Make private" : "Make public"}
            </Button>
          </div>

          <div className="flex items-center gap-2.5 rounded-md border border-border px-2.5 py-2">
            <KeyRound
              className={cn(
                "h-4 w-4 shrink-0",
                secrets?.length ? "text-green-500" : "text-muted-foreground",
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium">
                {secrets?.length
                  ? `${secrets.length} secret${secrets.length === 1 ? "" : "s"} stored securely`
                  : "No secrets stored"}
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">
                Secrets are encrypted at rest, injected as env vars, and never
                shared when a project is public or remixed.
              </p>
            </div>
          </div>
        </div>

        {/* Scan results */}
        <div className="mb-1.5 mt-4 flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Code scan
          </span>
          {counts.info > 0 && (
            <button
              type="button"
              onClick={() => setShowInfo((v) => !v)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
            >
              {showInfo ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {showInfo ? "Hide info" : `Show info (${counts.info})`}
            </button>
          )}
        </div>

        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border py-8 text-center">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <p className="text-xs font-medium">No issues found</p>
            <p className="max-w-[240px] text-[11px] leading-relaxed text-muted-foreground">
              We scanned your files for leaked API keys, hardcoded credentials
              and risky patterns. All clear.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {visible.map((f, idx) => {
              const meta = SEVERITY_META[f.severity];
              const Icon =
                f.severity === "critical"
                  ? XCircle
                  : f.severity === "warning"
                    ? f.ruleId === "env-file"
                      ? FileWarning
                      : AlertTriangle
                    : Info;
              return (
                <li
                  key={`${f.ruleId}-${f.path}-${f.line}-${idx}`}
                  className={cn(
                    "rounded-md border border-border border-l-2 px-2.5 py-2",
                    meta.border,
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        f.severity === "critical"
                          ? "text-red-500"
                          : f.severity === "warning"
                            ? "text-yellow-600"
                            : "text-sky-500",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                      {f.title}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                        meta.badge,
                      )}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenFile(f.path)}
                    className="group mt-1.5 flex w-full items-center gap-1 truncate rounded bg-muted/40 px-1.5 py-1 text-left font-mono text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                    title={`Open ${f.path}`}
                  >
                    <span className="shrink-0 font-medium text-foreground/80">
                      {f.path}:{f.line}
                    </span>
                    <span className="min-w-0 truncate">{f.snippet}</span>
                    <ChevronRight className="ml-auto h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100" />
                  </button>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                    {f.advice}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        {/* Platform protections */}
        <div className="mb-1.5 mt-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Always on
        </div>
        <ul className="space-y-1 rounded-md border border-border p-2.5">
          {[
            "Row-level security on every project table — access is enforced in the database",
            "Per-IP and per-user rate limits on the API and AI chat",
            "Secrets and database tokens are never exposed on public projects",
            "A snapshot is saved before every AI edit, so changes can always be rolled back",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2 text-[11px] leading-snug text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-green-500" />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
