# Zola

A Replit/Kimi-style vibe coding platform with multi-LLM routing.

- Chat with **Claude (Opus/Sonnet/Haiku), GPT-5, Gemini 2.5**, plus **Kimi K2, DeepSeek, Llama** via OpenRouter
- Monaco editor + file tree in the browser
- Live preview via **WebContainers** (Node.js in the browser, `npm install` + `vite dev`)
- Supabase auth + persisted projects/files

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind v4 · Vercel AI SDK · Supabase · WebContainers · Monaco

## Local setup

```bash
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# and at least one LLM provider key (ANTHROPIC_API_KEY, OPENAI_API_KEY,
# GOOGLE_GENERATIVE_AI_API_KEY, OPENROUTER_API_KEY).

npm install
npm run dev
```

Apply the database schema in Supabase by running `supabase/schema.sql` in the SQL editor (it sets up `projects`, `project_files`, `messages` plus row-level security).

> WebContainers requires the COOP/COEP headers — they're already set in `next.config.ts`.

## Project layout

```
app/
  api/chat/route.ts            # streaming multi-LLM chat
  api/projects/...             # CRUD + file persistence
  projects/[id]/page.tsx       # workspace
  (auth)/login | signup
components/
  chat/                        # chat panel + model picker
  editor/                      # Monaco + file tree
  preview/                     # WebContainers preview
  workspace/                   # three-pane layout
lib/
  ai/                          # provider registry + system prompt + file-block parser
  supabase/                    # client / server / middleware helpers
supabase/schema.sql            # tables + RLS policies
```
