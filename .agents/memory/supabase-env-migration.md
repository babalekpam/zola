---
name: Supabase env var naming after Next.js→Vite migration
description: Why signup/auth silently failed in the Loop (zola) app after migration — env prefix mismatch
---

# Supabase env var prefix mismatch (Next.js → Vite)

The zola artifact was migrated from Next.js to Vite. The Replit **secrets** kept
their Next.js names: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
But the Vite client code was written to read `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`,
which did not exist. Result: `createSupabaseBrowserClient()` threw "not configured"
on auth actions (signup/login), in both dev and the static production build.

**Why it was easy to miss:** the error only throws when the client is *constructed*
(on form submit), not on render, and `use-auth.tsx` silently returned null when unset —
so the app looked fine until you actually tried to sign in.

**Fix applied:** code reads `VITE_*` first, falls back to `NEXT_PUBLIC_*`; and
`vite.config.ts` sets `envPrefix: ["VITE_", "NEXT_PUBLIC_"]` so Vite exposes the
NEXT_PUBLIC-prefixed vars to `import.meta.env` at build time.

**How to apply / general rule:** Vite only exposes env vars matching `envPrefix`
(default `VITE_`) to client code, and inlines them at BUILD time (static deploy bakes
them into the bundle). After any framework migration, reconcile secret *names* with the
new framework's required prefix, or widen `envPrefix`. Verify a production build actually
inlines the value (grep the built bundle) rather than trusting dev, since dev and the
static build resolve env differently.
