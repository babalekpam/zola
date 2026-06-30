// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
"use client";

import { useMemo } from "react";
import { File, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  files: Record<string, string>;
  activePath: string | null;
  onSelect: (path: string) => void;
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

export function FileTree({ files, activePath, onSelect }: Props) {
  const tree = useMemo(() => buildTree(Object.keys(files)), [files]);
  return (
    <div className="h-full overflow-y-auto p-2 text-sm">
      {tree.children.map((n) => (
        <TreeNode
          key={n.path}
          node={n}
          depth={0}
          activePath={activePath}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function TreeNode({
  node,
  depth,
  activePath,
  onSelect,
}: {
  node: Node;
  depth: number;
  activePath: string | null;
  onSelect: (p: string) => void;
}) {
  if (node.isFile) {
    return (
      <button
        type="button"
        onClick={() => onSelect(node.path)}
        className={cn(
          "flex w-full items-center gap-1.5 rounded px-2 py-1 text-left hover:bg-accent",
          activePath === node.path && "bg-accent text-foreground",
        )}
        style={{ paddingLeft: depth * 12 + 8 }}
      >
        <File className="h-3.5 w-3.5 opacity-60" />
        <span className="truncate">{node.name}</span>
      </button>
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
        />
      ))}
    </div>
  );
}