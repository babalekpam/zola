// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT

/**
 * Guard for URLs the user supplies and the API server then fetches (MCP server
 * endpoints today). Without it, "add an MCP server" is an SSRF primitive: any
 * signed-in user could point the server at the cloud metadata endpoint or at a
 * service reachable only from inside the VPC and read the response back out of
 * the tool result.
 *
 * This blocks by hostname, which stops the obvious cases (localhost, RFC1918,
 * link-local, .internal) but not a public name that resolves to a private
 * address. Defence in depth belongs at the network layer — egress rules on the
 * container — and this is the cheap half of it.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "metadata.google.internal",
  "metadata.goog",
  "169.254.169.254",
]);

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".cluster.local"];

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateIPv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (!h.includes(":")) return false;
  // Unique-local (fc00::/7) and link-local (fe80::/10).
  return h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe8") ||
    h.startsWith("fe9") || h.startsWith("fea") || h.startsWith("feb") || h === "::1";
}

export type SafeUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export function assertSafeOutboundUrl(raw: string): SafeUrlResult {
  const value = (raw ?? "").trim();
  if (!value) return { ok: false, error: "url is required" };
  if (value.length > 2_000) return { ok: false, error: "url is too long" };

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, error: "url must be a valid absolute URL" };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "url must use https" };
  }

  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) {
    return { ok: false, error: "url points at a local address" };
  }
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return { ok: false, error: "url points at a private network address" };
  }
  if (isPrivateIPv4(host) || isPrivateIPv6(host)) {
    return { ok: false, error: "url points at a private network address" };
  }

  return { ok: true, url: parsed.toString() };
}
