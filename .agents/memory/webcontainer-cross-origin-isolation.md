---
name: WebContainer cross-origin isolation
description: Why the Zola web preview needs COOP/COEP headers and which COEP value to use behind the Replit proxy
---

The Zola web app boots an in-browser Node preview via `@webcontainer/api`. WebContainer uses `SharedArrayBuffer`, which the browser only exposes when `self.crossOriginIsolated` is true. Without it the preview fails with: `Failed to execute 'postMessage' on 'Worker': SharedArrayBuffer transfer requires self.crossOriginIsolated`.

Fix: the Vite dev/preview server must send both `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: ...` (set in `artifacts/zola/vite.config.ts` under `server.headers` and `preview.headers`).

**Why credentialless, not require-corp:** the app loads cross-origin subresources (Supabase, fonts, the Replit dev banner/cartographer). `require-corp` blocks any cross-origin resource lacking a CORP header; `credentialless` loads them without credentials instead, avoiding breakage. Verified the Replit proxy forwards these headers unchanged (curl `$REPLIT_DEV_DOMAIN` shows them on the HTML response).

**How to apply:** if the WebContainer preview ever errors on SharedArrayBuffer / crossOriginIsolated again, confirm both headers are present on the served HTML. Do not switch to `require-corp` unless every cross-origin subresource is known to send CORP.
