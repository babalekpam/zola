// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  openPaths: string[];
  activePath: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}

export function EditorTabs({ openPaths, activePath, onSelect, onClose }: Props) {
  if (openPaths.length === 0) return null;
  return (
    <div className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-border bg-card">
      {openPaths.map((path) => {
        const name = path.split("/").pop() ?? path;
        const active = path === activePath;
        return (
          <div
            key={path}
            role="tab"
            aria-selected={active}
            title={path}
            onClick={() => onSelect(path)}
            className={cn(
              "group flex cursor-pointer items-center gap-1.5 whitespace-nowrap border-r border-border px-3 text-xs",
              active
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            <span className="max-w-[140px] truncate">{name}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose(path);
              }}
              className="rounded p-0.5 opacity-0 hover:bg-border group-hover:opacity-100"
              aria-label={`Close ${name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
