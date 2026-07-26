// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
// Vercel serverless entry. The build step (build.mjs) bundles src/app.ts —
// including the workspace TS packages, which Node cannot import unbundled —
// into dist/app.mjs; this file just hands the Express app to Vercel.
// src/index.ts remains the entry for long-running deployments.
export { default } from "../dist/app.mjs";
