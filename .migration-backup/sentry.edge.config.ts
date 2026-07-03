// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    enabled: process.env.NODE_ENV === "production",
  });
}
