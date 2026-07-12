---
name: E2E test users via Supabase admin API
description: How to run Playwright e2e tests against auth-gated Loop pages now that signup requires email confirmation
---

Signup in the app requires email confirmation, so e2e tests cannot register a fresh account through the UI.

**How to apply:** Before `runTest`, create a pre-confirmed user with the service-role client: `admin.auth.admin.createUser({ email, password, email_confirm: true })`, have the test LOG IN (not sign up), and afterwards clean up with `admin.auth.admin.deleteUser(id)` (cascades to owned projects).

**Why:** Playwright test agent reported "unable" when it hit the confirm-your-email wall; login with a pre-confirmed user works reliably.

Note: shell env has `NEXT_PUBLIC_SUPABASE_URL`, not `VITE_SUPABASE_URL` — read both (`process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL`) in ad-hoc node scripts.
