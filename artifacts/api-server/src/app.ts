// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import sitesRouter from "./routes/sites";
import { publicDbRouter } from "./routes/db";
import { logger } from "./lib/logger";

const app: Express = express();

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
