---
name: WebContainer production licensing
description: Why the in-browser preview works in dev but fails on custom production domains, and how it's wired.
---

StackBlitz WebContainer (`@webcontainer/api`, used in `artifacts/zola` preview) boots
for **free only on localhost**. On any custom production domain (e.g. loopafrica.org)
`WebContainer.boot()` fails/times out unless you call `configureAPIKey(key)` BEFORE
boot with a licensed key AND the origin is registered in the StackBlitz dashboard.

**Why:** The generic "Something went wrong. Check logs." preview error on the deployed
site was NOT a COOP/COEP header problem — prod headers were already correct
(`cross-origin-embedder-policy: credentialless` + `cross-origin-opener-policy: same-origin`,
so the page IS cross-origin isolated). The real cause is WebContainer's origin licensing.

**How to apply:** The preview reads optional `VITE_WEBCONTAINER_API_KEY` and calls
`configureAPIKey()` before boot when present; on non-localhost origins with no key it
throws a clear, user-visible error instead of the vague one. The key is a `VITE_`
(client-embedded) value — that's fine because WebContainer keys are domain-locked.
Turning it on requires: get key at webcontainer.io, register the prod domain, set the
secret, then **republish** (the key only takes effect in a fresh production build).
