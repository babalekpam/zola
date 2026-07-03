// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.0,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    enabled: process.env.NODE_ENV === "production",
  });
}
