// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Router } from "express";
import { createSupabaseAdminClient } from "../lib/supabase";

// Public serving of deployed sites at /sites/:slug/* — no auth, service-role
// reads (deployments are public by definition, like Replit's *.replit.app).
const router = Router();

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

  const { data: deployment } = await supabase
    .from("deployments")
    .select("id")
    .eq("slug", slug)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!deployment) {
    res.status(404).send("Site not found");
    return;
  }

  // Exact file, else SPA fallback to index.html for extensionless routes.
  const candidates = requested === "" ? ["index.html"] : [requested];
  if (requested !== "" && !requested.includes(".")) candidates.push("index.html");

  for (const path of candidates) {
    const { data: file } = await supabase
      .from("deployment_files")
      .select("content, encoding")
      .eq("deployment_id", deployment.id)
      .eq("path", path)
      .maybeSingle();
    if (!file) continue;

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
});

export default router;
