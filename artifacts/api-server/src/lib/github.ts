// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Buffer } from "node:buffer";

// Retrieve a GitHub access token from the Replit connector at runtime.
// Returns null when no connection is configured (public repos still work,
// just with the lower unauthenticated rate limit).
export async function getGitHubToken(): Promise<string | null> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;
  if (!hostname || !xReplitToken) return null;
  try {
    const r = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=github`,
      { headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken } },
    );
    if (!r.ok) return null;
    const data = (await r.json()) as {
      items?: {
        settings?: {
          access_token?: string;
          oauth?: { credentials?: { access_token?: string } };
        };
      }[];
    };
    const s = data.items?.[0]?.settings;
    return s?.access_token ?? s?.oauth?.credentials?.access_token ?? null;
  } catch {
    return null;
  }
}

const SKIP_SEGMENTS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".cache",
  "coverage",
  ".vercel",
];
const MAX_FILES = 300;
const MAX_FILE_BYTES = 256 * 1024;
const MAX_TOTAL_BYTES = 6 * 1024 * 1024;

export function parseRepoUrl(
  input: string,
): { owner: string; repo: string; ref?: string } | null {
  const s = input.trim();
  const shorthand = /^([\w.-]+)\/([\w.-]+)$/.exec(s);
  if (shorthand) {
    return { owner: shorthand[1], repo: shorthand[2].replace(/\.git$/, "") };
  }
  try {
    const u = new URL(s);
    if (!/(^|\.)github\.com$/.test(u.hostname)) return null;
    const parts = u.pathname.replace(/^\/+/, "").split("/");
    if (parts.length < 2 || !parts[0] || !parts[1]) return null;
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/, "");
    let ref: string | undefined;
    if (parts[2] === "tree" && parts[3]) ref = parts[3];
    return { owner, repo, ref };
  } catch {
    return null;
  }
}

interface TreeNode {
  type?: string;
  path?: string;
  sha?: string;
  size?: number;
}

// Fetch the text files of a GitHub repository so they can be seeded into a
// new project. Skips vendored/build dirs, large files, and binary blobs.
export async function fetchRepoFiles(
  repoUrl: string,
): Promise<{ name: string; files: { path: string; content: string }[] }> {
  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) throw new Error("Enter a valid GitHub repository URL");

  const token = await getGitHubToken();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "loop-import",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const api = "https://api.github.com";
  const base = `${api}/repos/${parsed.owner}/${parsed.repo}`;

  const repoRes = await fetch(base, { headers });
  if (repoRes.status === 404) {
    throw new Error("Repository not found or is private");
  }
  if (repoRes.status === 403) {
    throw new Error("GitHub rate limit reached. Connect GitHub and try again.");
  }
  if (!repoRes.ok) throw new Error(`GitHub error (${repoRes.status})`);
  const repoJson = (await repoRes.json()) as { default_branch?: string };
  const ref = parsed.ref ?? repoJson.default_branch ?? "main";

  const treeRes = await fetch(
    `${base}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    { headers },
  );
  if (!treeRes.ok) {
    throw new Error(`Could not read repository tree (${treeRes.status})`);
  }
  const treeJson = (await treeRes.json()) as { tree?: TreeNode[] };
  const blobs = (treeJson.tree ?? []).filter(
    (n): n is Required<Pick<TreeNode, "path" | "sha">> & TreeNode =>
      n.type === "blob" && typeof n.path === "string" && typeof n.sha === "string",
  );

  const wanted = blobs
    .filter((b) => {
      const segs = b.path.split("/");
      if (segs.some((seg) => SKIP_SEGMENTS.includes(seg))) return false;
      if (typeof b.size === "number" && b.size > MAX_FILE_BYTES) return false;
      return true;
    })
    .slice(0, MAX_FILES);

  const files: { path: string; content: string }[] = [];
  let total = 0;
  let idx = 0;

  async function worker() {
    while (idx < wanted.length) {
      const b = wanted[idx++];
      const br = await fetch(`${base}/git/blobs/${b.sha}`, { headers });
      if (!br.ok) continue;
      const bj = (await br.json()) as { encoding?: string; content?: string };
      if (bj.encoding !== "base64" || typeof bj.content !== "string") continue;
      const buf = Buffer.from(bj.content, "base64");
      if (buf.includes(0)) continue; // binary
      if (total + buf.length > MAX_TOTAL_BYTES) continue;
      total += buf.length;
      files.push({ path: b.path, content: buf.toString("utf8") });
    }
  }

  await Promise.all(Array.from({ length: 8 }, () => worker()));
  if (files.length === 0) {
    throw new Error("No importable text files found in that repository");
  }
  return { name: parsed.repo, files };
}
