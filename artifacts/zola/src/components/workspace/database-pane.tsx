// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useState } from "react";
import { Copy, Database, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useKvEntries, useUpsertKv, useDeleteKv } from "@/hooks/use-kv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const API = import.meta.env.VITE_API_URL ?? "";

export function dbUrlFor(token: string): string {
  const base = API || window.location.origin;
  return `${base}/db/${token}`;
}

interface Props {
  projectId: string;
  dbToken: string | null;
}

/**
 * Replit-DB-style key-value database. The running app reaches the same data
 * over HTTP via its ZOLA_DB_URL env var; this pane is the workspace browser.
 */
export function DatabasePane({ projectId, dbToken }: Props) {
  const { data: entries, isLoading } = useKvEntries(projectId);
  const upsert = useUpsertKv(projectId);
  const remove = useDeleteKv(projectId);
  const [draftKey, setDraftKey] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);

  function submit() {
    const key = draftKey.trim();
    if (!key) return;
    upsert.mutate(
      { key, value: draftValue },
      {
        onSuccess: () => {
          setDraftKey("");
          setDraftValue("");
          setEditingKey(null);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Database
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {dbToken && (
          <div className="mb-3 rounded-md border border-border bg-muted/30 p-2.5">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Your app's database URL
            </div>
            <div className="flex items-center gap-1.5">
              <code className="min-w-0 flex-1 truncate font-mono text-[11px]">
                ZOLA_DB_URL
              </code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(dbUrlFor(dbToken));
                  toast.success("Database URL copied");
                }}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
                title="Copy database URL"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Set as an env var in your app. <code className="rounded bg-muted px-1">GET
              /key</code>, <code className="rounded bg-muted px-1">POST /key</code> (body =
              value), <code className="rounded bg-muted px-1">DELETE /key</code>,{" "}
              <code className="rounded bg-muted px-1">GET ?prefix=</code> to list.
            </p>
          </div>
        )}

        <div className="mb-4 space-y-2 rounded-md border border-border p-3">
          <Input
            value={draftKey}
            onChange={(e) => setDraftKey(e.target.value)}
            placeholder="Key"
            disabled={!!editingKey}
            className="h-8 font-mono text-xs"
          />
          <Textarea
            value={draftValue}
            onChange={(e) => setDraftValue(e.target.value)}
            placeholder="Value"
            rows={2}
            className="font-mono text-xs"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={submit}
              disabled={upsert.isPending || !draftKey.trim()}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {editingKey ? "Update" : "Add entry"}
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
        ) : !entries?.length ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Database className="h-5 w-5 text-muted-foreground" />
            <p className="max-w-[220px] text-xs text-muted-foreground">
              No data yet. Your app can read and write keys at runtime through
              ZOLA_DB_URL.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {entries.map((e) => (
              <li
                key={e.key}
                className="flex items-start gap-2 rounded-md border border-border px-2.5 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-xs font-medium">{e.key}</div>
                  <div className="line-clamp-2 break-all font-mono text-[11px] text-muted-foreground">
                    {e.value}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingKey(e.key);
                    setDraftKey(e.key);
                    setDraftValue(e.value);
                  }}
                  className="rounded p-1 text-muted-foreground hover:text-foreground"
                  title="Edit entry"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    remove.mutate(e.key, {
                      onError: (err) => toast.error(err.message),
                    })
                  }
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                  title="Delete entry"
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
