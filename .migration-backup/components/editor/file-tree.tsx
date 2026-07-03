// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
"use client";

import { useMemo, useState } from "react";
import { File, FolderOpen, FilePlus, Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  files: Record<string, string>;
  activePath: string | null;
  onSelect: (path: string) => void;
  onCreate: (path: string) => void;
  onDelete: (path: string) => void;
  onRename: (from: string, to: string) => void;
}

interface Node {
  name: string;
  path: string;
  isFile: boolean;
  children: Node[];
}

function buildTree(paths: string[]): Node {
  const root: Node = { name: "", path: "", isFile: false, children: [] };
  for (const p of paths.slice().sort()) {
    const segs = p.split("/");
    let cur = root;
    segs.forEach((seg, i) => {
      const isFile = i === segs.length - 1;
      let child = cur.children.find((c) => c.name === seg);
      if (!child) {
        child = {
          name: seg,
          path: segs.slice(0, i + 1).join("/"),
          isFile,
          children: [],
        };
        cur.children.push(child);
      }
      cur = child;
    });
  }
  const sortNode = (n: Node) => {
    n.children.sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    n.children.forEach(sortNode);
  };
  sortNode(root);
  return root;
}

export function FileTree({
  files,
  activePath,
  onSelect,
  onCreate,
  onDelete,
  onRename,
}: Props) {
  const tree = useMemo(() => buildTree(Object.keys(files)), [files]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Files
        </span>
        <button
          type="button"
          onClick={() => {
            const path = window.prompt(
              "New file path (e.g. src/components/Button.tsx)",
            );
            if (path) onCreate(path.replace(/^\/+/, ""));
          }}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="New file"
          title="New file"
        >
          <FilePlus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-1 text-sm">
        {tree.children.map((n) => (
          <TreeNode
            key={n.path}
            node={n}
            depth={0}
            activePath={activePath}
            onSelect={onSelect}
            onDelete={onDelete}
            onRename={onRename}
          />
        ))}
      </div>
    </div>
  );
}

function TreeNode({
  node,
  depth,
  activePath,
  onSelect,
  onDelete,
  onRename,
}: {
  node: Node;
  depth: number;
  activePath: string | null;
  onSelect: (p: string) => void;
  onDelete: (p: string) => void;
  onRename: (from: string, to: string) => void;
}) {
  const [hover, setHover] = useState(false);

  if (node.isFile) {
    return (
      <div
        className={cn(
          "group flex w-full items-center rounded px-2 py-1 hover:bg-accent",
          activePath === node.path && "bg-accent text-foreground",
        )}
        style={{ paddingLeft: depth * 12 + 8 }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <button
          type="button"
          onClick={() => onSelect(node.path)}
          className="flex flex-1 items-center gap-1.5 text-left"
        >
          <File className="h-3.5 w-3.5 opacity-60" />
          <span className="truncate">{node.name}</span>
        </button>
        {hover ? (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const next = window.prompt("Rename to:", node.path);
                if (next && next !== node.path) onRename(node.path, next);
              }}
              className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
              aria-label="Rename"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Delete ${node.path}?`)) onDelete(node.path);
              }}
              className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-destructive"
              aria-label="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div>
      <div
        className="flex items-center gap-1.5 px-2 py-1 text-muted-foreground"
        style={{ paddingLeft: depth * 12 + 8 }}
      >
        <FolderOpen className="h-3.5 w-3.5 opacity-60" />
        <span className="truncate">{node.name}</span>
      </div>
      {node.children.map((c) => (
        <TreeNode
          key={c.path}
          node={c}
          depth={depth + 1}
          activePath={activePath}
          onSelect={onSelect}
          onDelete={onDelete}
          onRename={onRename}
        />
      ))}
    </div>
  );
}
