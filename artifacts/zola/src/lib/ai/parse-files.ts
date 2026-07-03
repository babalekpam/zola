// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
export interface ParsedFileBlock {
  path: string;
  content: string;
}

const BLOCK_RE = /```zola:file\s+path="([^"]+)"\s*\n([\s\S]*?)```/g;

export function parseFileBlocks(text: string): ParsedFileBlock[] {
  const out: ParsedFileBlock[] = [];
  let m: RegExpExecArray | null;
  while ((m = BLOCK_RE.exec(text)) !== null) {
    out.push({ path: m[1].trim(), content: m[2].replace(/\n$/, "") });
  }
  return out;
}

export function stripFileBlocks(text: string): string {
  return text.replace(BLOCK_RE, "").trim();
}
