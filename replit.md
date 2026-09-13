# Zola

Zola is a Replit-style, AI-first coding platform: users describe an app in chat, an AI agent writes the code, and the project runs live in an in-browser Node.js sandbox (WebContainers) with a full workspace — editor, shell, console, secrets, key-value database, checkpoints, and one-click deployments.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string; Supabase: `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_*`), `SUPABASE_SERVICE_ROLE_KEY` (deployments/DB serving, org writes)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: Supabase (Postgres + RLS + Realtime); schema source of truth: `artifacts/api-server/supabase-schema.sql` (idempotent, re-runnable)
- Frontend: Vite + React, Tailwind, shadcn/ui, TanStack Query, wouter, Monaco, xterm.js
- In-browser runtime: StackBlitz WebContainers (`@webcontainer/api`)
- AI: Vercel AI SDK v4 generation (`ai@4` + `@ai-sdk/react@1` + providers pinned to the same generation — see .agents/memory)

## Where things live

- `artifacts/zola` — the main web app.
  - `src/lib/webcontainer/runtime.ts` — singleton WebContainer lifecycle owner (Run/Stop/Restart, console stream, shell spawning, deploy builds, env injection)
  - `src/components/workspace/` — workspace UI: `workspace.tsx` (layout + state), `tool-pane.tsx` (Webview/Console/Shell/Secrets/Integrations/MCP/DB/History/Deploy tabs), one file per pane
  - `src/components/dashboard/dashboard-shell.tsx` — the sidebar + nav shared by every signed-in dashboard page (`NAV_ITEMS` is the single source of truth for the sidebar)
  - `src/components/chat/` — AI chat (Loop agent); `src/components/editor/` — file tree, Monaco, tabs
  - `src/hooks/` — TanStack Query hooks per API resource (`use-secrets`, `use-snapshots`, `use-deployments`, `use-kv`, `use-presence`, …)
- `artifacts/api-server` — Express API.
  - `src/routes/` — one router per resource; registered in `routes/index.ts` under `/api`
  - Public unauthenticated routes mounted at app level in `app.ts`: `/sites/:slug/*` (deployed sites) and `/db/:token/*` (key-value store for running apps, open CORS)
  - `src/lib/mcp/` — MCP runtime: `registry.ts` (catalog of remote servers), `client.ts` (connect/probe/tool aggregation)
  - `src/lib/integrations/catalog.ts` — the Integrations catalog (services → credential fields → env vars → MCP server)
  - `src/lib/net/outbound-url.ts` — SSRF guard for user-supplied URLs the server fetches
  - `supabase-schema.sql` — append-only, idempotent schema + RLS; apply to Supabase via the pooler (see .agents/memory)
- `artifacts/zola-mobile`, `artifacts/mockup-sandbox` — secondary artifacts
- `lib/` — shared API spec/codegen packages

## Architecture decisions

- All project data access goes through Supabase RLS with the `has_project_access(project_id)` helper; the API server uses the user's JWT (cookies) except where a service role is required (public site serving, token-routed KV, org writes).
- The WebContainer is a per-page singleton (`runtime` in `lib/webcontainer/runtime.ts`); panes subscribe to it rather than owning container state, so tab switches never restart anything. Panes stay mounted (CSS-hidden) once opened.
- Deployments store built static output in Postgres (`deployment_files`, base64 for binaries) and serve at `/sites/:slug/` with SPA fallback; builds run client-side in the WebContainer with `--base=./`.
- The app key-value DB mirrors Replit DB: a capability token (`projects.db_token`) in `ZOLA_DB_URL` is the only auth; CORS is open on `/db` because calls come from WebContainer origins.
- A snapshot of all files is auto-saved before every AI edit (`project_snapshots`, capped at 50/project) so any agent change can be rolled back from the History tab.

## Product

- Home dashboard: create from templates (todo, landing, dashboard, snake, portfolio, blog, Express API), import from GitHub, attach reference docs (PDF/Word), organizations/workspaces, referrals, billing (Stripe).
- Workspace: AI chat (multi-model, plan mode, voice input), file tree + Monaco editor, Run/Stop/Restart, Webview with address bar, Console, interactive Shell, Secrets, key-value Database, History (checkpoints + restore), Deploy (public static hosting), Git (push/export to GitHub), live presence avatars + live file sync between collaborators (last-write-wins per file).
- Integrations (`/integrations`): account-level connections to ~24 services (Rube/Composio, Supabase, Neon, Upstash, Stripe, Paystack, Clerk, Resend, Twilio, Slack, GitHub, Vercel, Sentry, Linear, Notion, OpenAI, Anthropic, Hugging Face, ElevenLabs, PostHog, Algolia, Cloudinary, Mapbox, Context7). Credentials live in `user_integrations` (self-only RLS) and never return to the browser. Attaching one to a project (workspace Integrations tab) upserts its credentials into `project_secrets` under the catalog's env var names and, when the service has an MCP server, registers it — detaching removes the MCP server but keeps the secrets.
- MCP (Model Context Protocol): per-project remote tool servers in `project_mcp_servers`, managed from the workspace MCP tab (catalog add, custom URL + auth header, enable/disable, "Test connection" listing the server's tools). The chat route dials every enabled server per turn via `experimental_createMCPClient` (SSE inline; Streamable HTTP through `@modelcontextprotocol/sdk`), merges their tools into `streamText` with `maxSteps: 8`, and closes the connections in `onFinish`/`onError`. Bounded everywhere: 10 servers/project, 40 tools/server, 80 tools/turn, 8s connect timeout, and a failed server is skipped rather than fatal. URLs must be https and non-private (`assertSafeOutboundUrl`).
- AI Console (`/ai-console`): provider key availability, the full model catalog, the Auto routing table (candidates in order with the winner marked), monthly quota, and usage charts by day/model/project from `ai_usage`.
- Dashboard pages behind the sidebar: `/published` (deployed sites with domains + traffic), `/security` (cross-project exposure: public projects, secret counts, enabled MCP servers, collaborators), `/promotions` (referrals + plans), `/settings`, `/learn`, `/docs`.
- Community: projects can be made public in settings; `/explore` lists them (works logged out) with like counts, and anyone can Remix (fork) one into their active workspace. Dashboard shows a categorized template gallery (11 templates) and per-card Duplicate.
- Custom domains: orgs link their own domain to a project's deployment in the Deploy tab (DNS TXT challenge `_zola-challenge.<domain>` + CNAME); verified domains are served by Host header via `customDomainMiddleware`. TLS for custom domains terminates at the fronting infra (Cloudflare/Cloud Run domain mapping/Caddy) — the app only routes by Host.
- AI engine: 9 providers (Anthropic, OpenAI, Google, Groq, DeepSeek direct, Qwen/DashScope, Moonshot/Kimi, NVIDIA, OpenRouter) on PLATFORM keys only — no BYOK, AI is resold. "Auto" model routes each request by task (design/code/plan/quick heuristic in `lib/ai/models.ts` `TASK_ROUTES`, availability-aware). Swarm mode (chat 🐝 toggle): architect model decomposes into ≤4 parallel specialist tasks with disjoint file ownership, each on its task's best model, merged into one streamed response (`lib/ai/swarm.ts`). Every model call is metered in `ai_usage`; monthly quotas per plan (`aiMonthly` in plans.ts: 300/5k/20k) enforced in the chat route (402 when exhausted, fails open without service role).
- Security: per-IP rate limits (600/min global, 120/min on /db), per-user per-minute chat RPC + monthly quota, nosniff/referrer headers, input caps in chat (40 msgs, 32k chars/msg, 240k context), trust proxy set for Cloud Run/Replit.
- Workspace Security tab (`security-pane.tsx`): posture score + client-side scan of project files for leaked API keys (AWS/Google/Stripe/GitHub/Slack/OpenAI/private keys), hardcoded credentials, committed .env files, and risky patterns (eval, innerHTML, http://) — findings link to the file in the editor; inline public/private visibility control. Secrets pane has search, copy, masked value input, paste-a-.env bulk import, and inline delete confirmation.
- Platform admin: `/admin` — cross-tenant stats (users/orgs/projects/deployments/messages), user + workspace + project tables, moderation (force-private, delete). Access = authenticated email ∈ `PLATFORM_ADMIN_EMAILS` (comma-separated env var), enforced server-side via the service role; the page itself is just a 403 renderer for everyone else.

## User preferences

- The product goal is feature parity with Replit ("a perfect clone of Replit") — when in doubt, match Replit's workspace behavior and naming.

## Gotchas

- `supabase-schema.sql` changes must be applied to the live Supabase project manually (pooler connection; direct host is IPv6-only). New since last apply: tables `project_secrets`, `project_snapshots`, `deployments`, `deployment_files`, `project_kv`, `project_db_tokens`, `project_mcp_servers`, `user_integrations`, `project_integrations`; `projects.visibility` + `projects.github_repo` columns and public-read policies.
- The KV capability token must NEVER be a readable column on `projects` — public projects are world-readable and the token grants writes. It lives in `project_db_tokens` (RLS on, no policies, service-role only) and is only returned by GET /api/projects/:id to users passing `has_project_access`.
- WebContainer needs cross-origin isolation (COOP/COEP headers in `vite.config.ts`) and an API key (`VITE_WEBCONTAINER_API_KEY`) on non-localhost origins.
- Express 5 route syntax: wildcards are named (`/sites/:slug{/*splat}`); `*splat` alone requires ≥1 segment.
- `express.json` limits are per route: 30 MB on deployment uploads, 10 MB on file/snapshot saves, 1 MB everywhere else; `/db` uses `express.text` and is mounted before the credentialed CORS policy. Deployments (`REPLIT_DEPLOYMENT` or `NODE_ENV=production`) add HSTS, secure session cookies, fail-closed CORS when `VITE_APP_URL` is unset, and a fail-closed AI quota when the service role key is missing.
- MCP servers are dialled on every chat turn; there is no connection pool. Keep the per-server timeouts in `lib/mcp/client.ts` low — they sit on the critical path of the user's first token.
- `project_mcp_servers.headers` holds live credentials. Never widen the redaction in `routes/mcp.ts` — the API returns header *names* only.
- Keep every AI SDK package on the same generation (see `.agents/memory/ai-sdk-version-alignment.md`).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- `.agents/memory/MEMORY.md` — hard-won operational notes (RLS traps, WebContainer licensing, schema apply procedure)
