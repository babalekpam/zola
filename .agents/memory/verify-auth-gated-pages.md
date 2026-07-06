---
name: Verifying auth-gated pages
description: How to visually verify Zola pages that require login (e.g. /projects) when you can't screenshot them directly.
---

Zola's `/projects` (and other post-login pages) redirect to `/login` without a Supabase session, so the `screenshot` tool on the main app only ever shows the public marketing landing.

**Rule:** to verify an auth-gated page visually, build the page as a presentational component (pure props, no hooks), then drop a self-contained copy (mock data, plain buttons/anchors instead of wouter `Link`) into the mockup-sandbox at `artifacts/mockup-sandbox/src/components/mockups/<folder>/<Name>.tsx`. Restart the "artifacts/mockup-sandbox: Component Preview Server" workflow and screenshot `app_preview` with `artifact_dir_name=mockup-sandbox`, `path=/preview/<folder>/<Name>`. Delete the sandbox copy when done.

**Why:** avoids shipping unverified layout changes to pages you literally cannot see, without needing real login credentials.

**How to apply:** any time a requested change targets a page behind `if (!user) redirect(...)`.
