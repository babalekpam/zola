// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import router from "./routes";
import sitesRouter, { customDomainMiddleware } from "./routes/sites";
import { publicDbRouter } from "./routes/db";
import { logger } from "./lib/logger";

const app: Express = express();

// Correct client IPs for rate limiting behind the platform proxy / Cloud Run.
app.set("trust proxy", 1);

// Baseline security headers on every response (platform pages, API, sites).
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-DNS-Prefetch-Control", "off");
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
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
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

// CORS: allow the Vite frontend
const allowedOrigins = [
  process.env.VITE_APP_URL,
  process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : undefined,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true,
  }),
);

// Raw body for Stripe webhook (must come before express.json())
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));

// 30mb so deployment uploads (built site assets, base64-encoded) fit.
app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// COOP / COEP headers required by WebContainers
app.use((_req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  next();
});

app.use("/api", router);

export default app;
