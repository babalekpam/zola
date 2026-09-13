// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import { rateLimit } from "express-rate-limit";
import router from "./routes";
import sitesRouter, { customDomainMiddleware } from "./routes/sites";
import { publicDbRouter } from "./routes/db";
import { logger } from "./lib/logger";
import { isDeployed } from "./lib/env";

const app: Express = express();

// Correct client IPs for rate limiting behind the platform proxy / Cloud Run.
app.set("trust proxy", 1);

// Baseline security headers on every response (platform pages, API, sites).
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  // HSTS only on real deployments (always HTTPS there); never in dev, where
  // it would poison localhost. No includeSubDomains: customers' own domains
  // are served through customDomainMiddleware and we must not pin theirs.
  if (isDeployed()) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
  }
  next();
});

// API responses carry session-scoped JSON: never cache them in shared
// caches and never let them be framed. Deployed sites (/sites) are excluded
// because the workspace Webview embeds them on purpose.
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

// Per-IP flood control. Generous global ceiling; tighter on the public
// key-value API (token-authed, reachable from any origin by design).
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 600,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use(
  "/db",
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: { id?: unknown; method?: string; url?: string }) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res: { statusCode?: number }) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// Verified custom domains serve their project's live deployment directly —
// checked first so an org's own domain never falls through to platform routes.
app.use((req, res, next) => {
  void customDomainMiddleware(req, res, next);
});

// Public routes mounted before the credentialed CORS policy below:
// - /db/:token — called by user apps running inside WebContainers (foreign
//   origins), so CORS must be wide open; access control is the capability token.
// - /sites/:slug — public deployed sites, plain GETs from anywhere.
app.use("/db", cors({ origin: true }), express.text({ type: "*/*", limit: "200kb" }));
app.use(publicDbRouter);
app.use(sitesRouter);

// CORS: allow the Vite frontend. Credentialed CORS must never reflect an
// arbitrary origin on a deployment — that would let any site call the API
// with the user's cookies — so with nothing configured, prod sends no CORS
// headers at all (same-origin still works) and dev stays permissive.
const allowedOrigins = [
  process.env.VITE_APP_URL,
  process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : undefined,
].filter(Boolean) as string[];
if (allowedOrigins.length === 0 && isDeployed()) {
  logger.warn(
    "VITE_APP_URL is not set: cross-origin API access is disabled on this deployment",
  );
}

app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : !isDeployed(),
    credentials: true,
  }),
);

// Per-IP ceilings on the routes that cost real money or hit third parties.
// The DB-side per-user limiter and plan quota still apply on top of these.
function routeLimit(limit: number) {
  return rateLimit({ windowMs: 60_000, limit, standardHeaders: true, legacyHeaders: false });
}
app.use(["/api/chat", "/api/ai"], routeLimit(120));
app.use(["/api/stripe/checkout", "/api/stripe/portal"], routeLimit(20));
app.use(
  [
    "/api/projects/import",
    "/api/projects/:id/github/push",
    "/api/projects/:id/domains",
    "/api/projects/:id/deployments",
  ],
  routeLimit(30),
);

// Raw body for Stripe webhook (must come before express.json())
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));

// Body limits are per route: only deployment uploads (built site assets,
// base64-encoded) need 30mb, and file/snapshot saves need a few MB. Every
// other endpoint gets 1mb so a large body can't be used to tie up workers.
app.use("/api/projects/:id/deployments", express.json({ limit: "30mb" }));
app.use(
  ["/api/projects/:id/files", "/api/projects/:id/snapshots"],
  express.json({ limit: "10mb" }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(cookieParser());

// COOP / COEP headers required by WebContainers
app.use((_req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  next();
});

app.use("/api", router);

export default app;
