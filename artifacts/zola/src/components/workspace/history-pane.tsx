// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useState } from "react";
import { Bot, History, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useSnapshots,
  useCreateSnapshot,
  useRestoreSnapshot,
  useDeleteSnapshot,
} from "@/hooks/use-snapshots";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

interface Props {
  projectId: string;
  files: Record<string, string>;
  onRestore: (files: Record<string, string>) => void;
}

/**
 * Replit-style version control: manual checkpoints plus the auto-checkpoints
 * taken before every AI edit, each restorable with one click.
 */
export function HistoryPane({ projectId, files, onRestore }: Props) {
  const { data: snapshots, isLoading } = useSnapshots(projectId);
  const create = useCreateSnapshot(projectId);
  const restore = useRestoreSnapshot(projectId);
  const remove = useDeleteSnapshot(projectId);
  const [label, setLabel] = useState("");

  function checkpoint() {
    create.mutate(
      { label: label.trim() || "Manual checkpoint", files },
      {
        onSuccess: () => {
          setLabel("");
          toast.success("Checkpoint saved");
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  function doRestore(snapshotId: string) {
    restore.mutate(snapshotId, {
      onSuccess: (restored) => {
        onRestore(restored);
        toast.success("Project restored to checkpoint");
      },
      onError: (err) => toast.error(err.message),
    });
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          History
        </span>
      </div>

      <div className="flex items-center gap-2 border-b border-border p-3">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && checkpoint()}
          placeholder="Checkpoint message…"
          className="h-8 text-xs"
        />
        <Button size="sm" onClick={checkpoint} disabled={create.isPending}>
          Save
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : !snapshots?.length ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <History className="h-5 w-5 text-muted-foreground" />
            <p className="max-w-[220px] text-xs text-muted-foreground">
              No checkpoints yet. One is saved automatically before every AI
              edit, or save one manually above.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {snapshots.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5"
              >
                {s.kind === "auto" ? (
                  <Bot className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <History className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">
                    {s.label || (s.kind === "auto" ? "Auto checkpoint" : "Checkpoint")}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {timeAgo(s.created_at)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => doRestore(s.id)}
                  disabled={restore.isPending}
                  className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
                  title="Restore this checkpoint"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    remove.mutate(s.id, {
                      onError: (err) => toast.error(err.message),
                    })
                  }
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                  title="Delete checkpoint"
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
