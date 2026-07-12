// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Router, type Request, type Response, type NextFunction } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "../lib/supabase";

// Public serving of deployed sites — no auth, service-role reads (deployments
// are public by definition, like Replit's *.replit.app). Two entry points:
//   1. /sites/:slug/*                      — the default platform URL
//   2. any request whose Host header is a verified custom domain

const CONTENT_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  txt: "text/plain; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  map: "application/json; charset=utf-8",
  webmanifest: "application/manifest+json",
  wasm: "application/wasm",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  pdf: "application/pdf",
};

function contentTypeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/**
 * Count a page view (HTML navigations only, not assets) for the Monitoring
 * tool. Fire-and-forget: analytics must never slow down or break serving.
 */
function recordPageView(supabase: SupabaseClient, projectId: string): void {
  void supabase
    .rpc("bump_site_hit", { p_project: projectId })
    .then(({ error }) => {
      if (error) console.warn("site hit not recorded:", error.message);
    });
}

/** Serve one path from a deployment: exact file, else SPA index fallback. */
async function serveDeploymentPath(
  supabase: SupabaseClient,
  deploymentId: string,
  projectId: string | null,
  requested: string,
  method: string,
  res: Response,
): Promise<void> {
  const candidates = requested === "" ? ["index.html"] : [requested];
  if (requested !== "" && !requested.includes(".")) candidates.push("index.html");

  for (const path of candidates) {
    const { data: file } = await supabase
      .from("deployment_files")
      .select("content, encoding")
      .eq("deployment_id", deploymentId)
      .eq("path", path)
      .maybeSingle();
    if (!file) continue;

    // Count real navigations only: GET for an HTML document. HEAD probes
    // (uptime monitors, link checkers) and asset requests are excluded.
    if (projectId && method === "GET" && path.endsWith(".html")) {
      recordPageView(supabase, projectId);
    }
    res.setHeader("Content-Type", contentTypeFor(path));
    res.setHeader(
      "Cache-Control",
      path.startsWith("assets/") ? "public, max-age=31536000, immutable" : "no-cache",
    );
    if (file.encoding === "base64") {
      res.send(Buffer.from(file.content, "base64"));
    } else {
      res.send(file.content);
    }
    return;
  }
  res.status(404).send("Not found");
}

async function latestDeployment(
  supabase: SupabaseClient,
  column: "slug" | "project_id",
  value: string,
): Promise<{ id: string; project_id: string } | null> {
  const { data } = await supabase
    .from("deployments")
    .select("id, project_id")
    .eq(column, value)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

const router = Router();

// One route matches /sites/:slug, /sites/:slug/ and /sites/:slug/any/path —
// Express 5's *splat needs at least one segment, so the zero-segment case is
// covered with the optional {/*splat} group.
router.get("/sites/:slug{/*splat}", async (req, res) => {
  const { slug } = req.params;
  const splat = (req.params as Record<string, unknown>).splat;
  const rest = Array.isArray(splat) ? splat.join("/") : "";
  const requested = rest.replace(/^\/+/, "");

  // Canonicalize /sites/:slug → /sites/:slug/ so relative asset URLs resolve.
  if (!requested && !req.path.endsWith("/")) {
    res.redirect(301, `/sites/${encodeURIComponent(slug)}/`);
    return;
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    res
      .status(503)
      .send("Deployments are not configured (missing SUPABASE_SERVICE_ROLE_KEY).");
    return;
  }

  const deployment = await latestDeployment(supabase, "slug", slug);
  if (!deployment) {
    res.status(404).send("Site not found");
    return;
  }
  await serveDeploymentPath(supabase, deployment.id, deployment.project_id, requested, req.method, res);
});

export default router;

// --- Custom-domain serving ---------------------------------------------------

// hostname → project_id (or null for "not a custom domain"), cached briefly
// so platform traffic doesn't pay a DB lookup per request.
const hostCache = new Map<string, { projectId: string | null; expires: number }>();
const HOST_CACHE_TTL_MS = 60_000;

/**
 * App-level middleware, mounted before everything else: when the request's
 * Host is a verified custom domain, serve the linked project's live
 * deployment at the domain root; otherwise fall through to the platform.
 */
export async function customDomainMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.method !== "GET" && req.method !== "HEAD") { next(); return; }
  const host = (req.hostname ?? "").toLowerCase();
  if (!host || host === "localhost" || /^[\d.]+$/.test(host)) { next(); return; }

  const now = Date.now();
  let entry = hostCache.get(host);
  if (!entry || entry.expires < now) {
    const supabase = createSupabaseAdminClient();
    if (!supabase) { next(); return; }
    const { data } = await supabase
      .from("custom_domains")
      .select("project_id")
      .eq("domain", host)
      .eq("verified", true)
      .maybeSingle();
    entry = { projectId: data?.project_id ?? null, expires: now + HOST_CACHE_TTL_MS };
    hostCache.set(host, entry);
  }
  if (!entry.projectId) { next(); return; }

  const supabase = createSupabaseAdminClient();
  if (!supabase) { next(); return; }
  const deployment = await latestDeployment(supabase, "project_id", entry.projectId);
  if (!deployment) {
    res.status(404).send("No deployment yet for this domain");
    return;
  }
  const requested = decodeURIComponent(req.path).replace(/^\/+/, "");
  if (requested.includes("..")) { res.status(400).send("Bad path"); return; }
  await serveDeploymentPath(supabase, deployment.id, deployment.project_id, requested, req.method, res);
}
