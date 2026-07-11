// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useState } from "react";
import { Eye, EyeOff, KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useSecrets,
  useUpsertSecret,
  useDeleteSecret,
} from "@/hooks/use-secrets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

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
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

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
          setDraftKey("");
          setDraftValue("");
          setEditingKey(null);
          toast.success(`Saved ${key}. Restart the app to apply.`);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  function toggleReveal(key: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Secrets
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          Secrets are available to your app and shell as environment variables.
          Use a <code className="rounded bg-muted px-1">VITE_</code> prefix to
          expose one to browser code. Changes apply on the next Run.
        </p>

        <div className="mb-4 space-y-2 rounded-md border border-border p-3">
          <Input
            value={draftKey}
            onChange={(e) => setDraftKey(e.target.value)}
            placeholder="KEY (e.g. VITE_API_URL)"
            disabled={!!editingKey}
            className="h-8 font-mono text-xs"
          />
          <Input
            value={draftValue}
            onChange={(e) => setDraftValue(e.target.value)}
            placeholder="Value"
            className="h-8 font-mono text-xs"
          />
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
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingKey(null);
                  setDraftKey("");
                  setDraftValue("");
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : !secrets?.length ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <KeyRound className="h-5 w-5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              No secrets yet. API keys and other config live here, not in code.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {secrets.map((s) => (
              <li
                key={s.key}
                className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-xs font-medium">
                    {s.key}
                  </div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground">
                    {revealed.has(s.key) ? s.value : "••••••••"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleReveal(s.key)}
                  className="rounded p-1 text-muted-foreground hover:text-foreground"
                  title={revealed.has(s.key) ? "Hide value" : "Show value"}
                >
                  {revealed.has(s.key) ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingKey(s.key);
                    setDraftKey(s.key);
                    setDraftValue(s.value);
                  }}
                  className="rounded p-1 text-muted-foreground hover:text-foreground"
                  title="Edit secret"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    remove.mutate(s.key, {
                      onError: (err) => toast.error(err.message),
                    })
                  }
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                  title="Delete secret"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
