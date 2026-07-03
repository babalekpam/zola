---
name: AI SDK (Vercel) package version alignment
description: Why the Loop chat crashed — @ai-sdk/* package majors are independent of the `ai` core major, and mixing them breaks useChat at runtime
---

# AI SDK package generations must all match

The Vercel AI SDK ships many packages whose **major version numbers do NOT
track the `ai` core major**. Same generation examples:

- `ai@4` ↔ `@ai-sdk/react@1` ↔ `@ai-sdk/openai@1` (old hook API)
- `ai@5` ↔ `@ai-sdk/react@2` ↔ `@ai-sdk/openai@2`
- `ai@6` ↔ `@ai-sdk/react@3` ↔ `@ai-sdk/openai@3`
- `ai@7` ↔ `@ai-sdk/react@4` ↔ `@ai-sdk/openai@4` (newest as of 2026-07)

Check the npm dist-tags (`ai-v5`, `ai-v6`, …) to map them, don't assume the
numbers line up.

**API differs by generation:** v4 (`ai@4`/`@ai-sdk/react@1`) `useChat` returns
`input` / `handleInputChange` / `handleSubmit` and messages have `.content`.
v5+ removed those (use `useState` + `sendMessage`, messages have `.parts`), and
the server streams via `pipeUIMessageStreamToResponse`; v4 server uses
`pipeDataStreamToResponse` / `toDataStreamResponse`.

**Why it bit us:** the project mixed `@ai-sdk/react@4` + `@ai-sdk/openai@4`
(newest) with `ai@7` and an OpenRouter provider pinned to `ai@6`, while the
client CODE used the v4 hook API and the server used the v5+ streaming call.
`useChat` therefore returned no `input`, so `!input.trim()` threw
"Cannot read properties of undefined (reading 'trim')" and crashed the whole
workspace page — only in the built app, after login, deep in the flow.

**How to apply:** pick ONE generation and pin every AI SDK package to it
(`ai`, `@ai-sdk/react`, every `@ai-sdk/<provider>`, and third-party providers
like `@openrouter/ai-sdk-provider` — its `ai-sdk-v4` dist-tag = `0.7.5`), and
make sure the client + server code uses that generation's API. `ai@4` also
needs `@opentelemetry/api` installed as a real dep (peer) or the esbuild
bundle throws `ERR_MODULE_NOT_FOUND` at runtime even though it builds fine.
