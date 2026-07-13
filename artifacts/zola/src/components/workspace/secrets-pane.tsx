// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useMemo, useState } from "react";
import {
  Check,
  ClipboardPaste,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  useSecrets,
  useUpsertSecret,
  useDeleteSecret,
} from "@/hooks/use-secrets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Parse `KEY=value` lines (dotenv style: comments, blanks, quotes). */
function parseDotenv(text: string): { key: string; value: string }[] {
  const out: { key: string; value: string }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out.push({ key: m[1], value });
  }
  return out;
}

/**
 * Per-project environment variables, Replit Secrets style. Values are injected
 * into every WebContainer process (dev server, shell) as env vars; changes
 * take effect the next time the app or shell is (re)started.
 */
export function SecretsPane({ projectId }: { projectId: string }) {
  const { data: secrets, isLoading } = useSecrets(projectId);
  const upsert = useUpsertSecret(projectId);
  const remove = useDeleteSecret(projectId);

  const [draftKey, setDraftKey] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const [draftVisible, setDraftVisible] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState("");

  const filtered = useMemo(() => {
    if (!secrets) return [];
    const q = query.trim().toLowerCase();
    if (!q) return secrets;
    return secrets.filter((s) => s.key.toLowerCase().includes(q));
  }, [secrets, query]);

  function resetDraft() {
    setDraftKey("");
    setDraftValue("");
    setDraftVisible(false);
    setEditingKey(null);
  }

  function submit() {
    const key = draftKey.trim();
    if (!KEY_RE.test(key)) {
      toast.error("Keys must look like ENV_VAR_NAMES (letters, digits, _)");
      return;
    }
    if (!editingKey && secrets?.some((s) => s.key === key)) {
      toast.error(`${key} already exists — edit it instead`);
      return;
    }
    upsert.mutate(
      { key, value: draftValue },
      {
        onSuccess: () => {
          resetDraft();
          toast.success(`Saved ${key}. Restart the app to apply.`);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  async function runImport() {
    const entries = parseDotenv(importText);
    if (!entries.length) {
      toast.error("No KEY=value lines found");
      return;
    }
    let saved = 0;
    for (const entry of entries) {
      try {
        await upsert.mutateAsync(entry);
        saved++;
      } catch (err) {
        toast.error(
          `${entry.key}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    if (saved) {
      toast.success(
        `Imported ${saved} secret${saved === 1 ? "" : "s"}. Restart the app to apply.`,
      );
      setImportText("");
      setImporting(false);
    }
  }

  function toggleReveal(key: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function copyValue(key: string, value: string) {
    void navigator.clipboard.writeText(value);
    toast.success(`Copied ${key}`);
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Secrets
          {!!secrets?.length && (
            <span className="rounded-full bg-muted px-1.5 py-px text-[9px] font-semibold tabular-nums text-foreground/70">
              {secrets.length}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Lock className="h-3 w-3 text-green-500" />
          Encrypted at rest
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          Secrets are available to your app and shell as environment variables.
          Use a <code className="rounded bg-muted px-1">VITE_</code> prefix to
          expose one to browser code. Changes apply on the next Run.
        </p>

        {/* Add / edit form */}
        <div className="mb-3 space-y-2 rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {editingKey ? `Edit ${editingKey}` : importing ? "Import .env" : "New secret"}
            </span>
            {!editingKey && (
              <button
                type="button"
                onClick={() => setImporting((v) => !v)}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {importing ? (
                  <>
                    <X className="h-3 w-3" /> Cancel
                  </>
                ) : (
                  <>
                    <ClipboardPaste className="h-3 w-3" /> Paste .env
                  </>
                )}
              </button>
            )}
          </div>

          {importing ? (
            <>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={"DATABASE_URL=postgres://…\nSTRIPE_KEY=sk_test_…"}
                rows={4}
                className="w-full resize-y rounded-md border border-border bg-input px-2.5 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                size="sm"
                onClick={() => void runImport()}
                disabled={upsert.isPending || !importText.trim()}
              >
                <ClipboardPaste className="mr-1 h-3.5 w-3.5" />
                Import secrets
              </Button>
            </>
          ) : (
            <>
              <Input
                value={draftKey}
                onChange={(e) => setDraftKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="KEY (e.g. VITE_API_URL)"
                disabled={!!editingKey}
                className="h-8 font-mono text-xs"
              />
              <div className="relative">
                <Input
                  type={draftVisible ? "text" : "password"}
                  value={draftValue}
                  onChange={(e) => setDraftValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="Value"
                  className="h-8 pr-8 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setDraftVisible((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  title={draftVisible ? "Hide value" : "Show value"}
                  tabIndex={-1}
                >
                  {draftVisible ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={submit}
                  disabled={upsert.isPending || !draftKey.trim()}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {editingKey ? "Update secret" : "Add secret"}
                </Button>
                {editingKey && (
                  <Button size="sm" variant="ghost" onClick={resetDraft}>
                    Cancel
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Search (only useful once the list has some length) */}
        {(secrets?.length ?? 0) > 5 && (
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search secrets…"
              className="h-8 pl-8 text-xs"
            />
          </div>
        )}

        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : !secrets?.length ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border py-8 text-center">
            <KeyRound className="h-5 w-5 text-muted-foreground" />
            <p className="text-xs font-medium">No secrets yet</p>
            <p className="max-w-[240px] text-[11px] leading-relaxed text-muted-foreground">
              API keys and other config live here — encrypted, out of your
              code, and never shared when a project is public or remixed.
            </p>
          </div>
        ) : !filtered.length ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No secrets match “{query.trim()}”.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {filtered.map((s) => {
              const isRevealed = revealed.has(s.key);
              const isConfirming = confirmDelete === s.key;
              return (
                <li
                  key={s.key}
                  className={cn(
                    "group flex items-center gap-2 rounded-md border px-2.5 py-1.5 transition-colors",
                    isConfirming
                      ? "border-destructive/50 bg-destructive/5"
                      : "border-border hover:bg-accent/40",
                  )}
                >
                  <KeyRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-xs font-medium">
                      {s.key}
                    </div>
                    <div className="truncate font-mono text-[11px] text-muted-foreground">
                      {isRevealed ? s.value : "••••••••••••"}
                    </div>
                  </div>

                  {isConfirming ? (
                    <>
                      <span className="shrink-0 text-[11px] text-destructive">
                        Delete?
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDelete(null);
                          remove.mutate(s.key, {
                            onSuccess: () => toast.success(`Deleted ${s.key}`),
                            onError: (err) => toast.error(err.message),
                          });
                        }}
                        className="rounded p-1 text-destructive hover:bg-destructive/10"
                        title="Confirm delete"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(null)}
                        className="rounded p-1 text-muted-foreground hover:text-foreground"
                        title="Cancel"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleReveal(s.key)}
                        className="rounded p-1 text-muted-foreground hover:text-foreground"
                        title={isRevealed ? "Hide value" : "Show value"}
                      >
                        {isRevealed ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => copyValue(s.key, s.value)}
                        className="rounded p-1 text-muted-foreground hover:text-foreground"
                        title="Copy value"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingKey(s.key);
                          setDraftKey(s.key);
                          setDraftValue(s.value);
                          setImporting(false);
                          setDraftVisible(false);
                        }}
                        className="rounded p-1 text-muted-foreground hover:text-foreground"
                        title="Edit secret"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(s.key)}
                        className="rounded p-1 text-muted-foreground hover:text-destructive"
                        title="Delete secret"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
