# Loop

> Built and maintained by **Argilette Lab** · © 2026 · MIT License

A Replit/Kimi-style vibe coding platform with multi-LLM routing.

- Chat with **NVIDIA NIM (Qwen Coder, Llama, DeepSeek R1, Nemotron)**, **Claude (Opus/Sonnet/Haiku)**, **GPT-5**, **Gemini 2.5**, plus Kimi K2, DeepSeek, Llama via OpenRouter
- Monaco editor + file tree in the browser
- Live preview via **WebContainers** (Node.js in the browser, `npm install` + `vite dev`)
- Supabase auth + persisted projects, files, and chat history
- Production-hardened: rate limiting · Cloudflare Turnstile · Sentry · password reset · Terms + Privacy

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Vercel AI SDK · Supabase · WebContainers · Monaco · Sentry · Cloudflare Turnstile

## Local setup

```bash
cp .env.example .env.local
# Fill in at minimum:
#   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
#   one LLM provider key (NVIDIA_API_KEY, ANTHROPIC_API_KEY, etc.)

npm install
npm run dev
```

## Database setup

Run the SQL files in `supabase/` in order via the Supabase SQL editor:

1. `supabase/schema.sql` — projects, project_files, messages, RLS policies
2. `supabase/migrations/002_production_hardening.sql` — usage_log + rate-limit RPC

## Production checklist

| Concern | How it's handled |
|---|---|
| **Rate limiting** | `check_chat_rate_limit` RPC caps each user to 30 `/api/chat` requests per minute |
| **CAPTCHA on auth** | Cloudflare Turnstile, enabled when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set (also enable in Supabase Auth → Settings → Bot & Abuse) |
| **Email verification** | Enforced by Supabase; configure in Auth → Providers → Email |
| **Error monitoring** | Sentry, enabled when `NEXT_PUBLIC_SENTRY_DSN` is set |
| **Password reset** | `/forgot-password` → email → `/reset-password` |
| **Chat history** | Persisted to `messages` table, restored on workspace open |
| **Legal** | `/terms`, `/privacy` |

> WebContainers requires the COOP/COEP headers — they're already set in `next.config.ts`.

## Deploy

- **Vercel:** `vercel.json` pins `framework: nextjs`. Set env vars in Project Settings → Environment Variables (Production scope).
- **Replit:** `.replit` + `replit.nix` configured. Import from GitHub, add secrets, press Run, then Deploy → Autoscale.

## Project layout

```
app/
  (auth)/                      # login, signup, forgot-password, reset-password
  (legal)/                     # terms, privacy
  api/chat/route.ts            # streaming multi-LLM chat (with rate limit + msg persist)
  api/projects/...             # project + file CRUD
  auth/callback/route.ts       # OAuth/magic-link callback
  projects/[id]/page.tsx       # workspace
components/
  auth/turnstile.tsx           # CAPTCHA widget
  chat/                        # chat panel + model picker
  editor/                      # Monaco + file tree
  preview/                     # WebContainers preview
  workspace/                   # three-pane layout
lib/
  ai/                          # provider registry + system prompt + file-block parser
  supabase/                    # client / server / middleware helpers
supabase/
  schema.sql
  migrations/002_production_hardening.sql
sentry.{client,server,edge}.config.ts
instrumentation.ts
```
