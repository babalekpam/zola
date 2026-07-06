---
name: Applying SQL schema to Supabase from Replit
description: How to run DDL against the project's Supabase DB from the Replit environment, and the new API-key format.
---

# Applying schema / running DDL against Supabase

App data lives in Supabase (project ref in `VITE_SUPABASE_URL`), NOT Replit Postgres. `executeSql` / `DATABASE_URL` (Helium) cannot reach it. To run DDL (apply `artifacts/api-server/supabase-schema.sql`) you connect with the `pg` client using a Supabase DB connection string.

## Connection: use the POOLER, not the direct host
- The **direct** connection host `db.<ref>.supabase.co` is **IPv6-only** (has AAAA, no A record). The Replit container has **no IPv6 egress** — connecting fails with `getaddrinfo ENOTFOUND` (pg tries IPv4) and even forcing the resolved IPv6 literal fails with `connect EAFNOSUPPORT`.
- **Must use the pooler**: host `aws-<n>-<region>.pooler.supabase.com` (prefix is `aws-0` or `aws-1`), port `5432` (session) / `6543` (transaction), username `postgres.<ref>`, same DB password.
- **Why:** users often paste the "Direct connection" URI by mistake; it will never work here.
- **How to apply:** if you only have the direct URL (or the user keeps giving it), you already have the password + ref — probe pooler regions by attempting a real `pg` connect to `aws-{0,1}-<region>.pooler.supabase.com` with username `postgres.<ref>`; the correct region authenticates, wrong ones give "Tenant or user not found". `pg` isn't hoisted to root — require it by explicit store path `node_modules/.pnpm/pg@<ver>/node_modules/pg` and use `ssl:{rejectUnauthorized:false}`. (This project resolved to `aws-1-us-east-1`.)
- The `SUPABASE_DB_URL` secret is only needed by the agent to apply schema; the running app does NOT use it.

## New Supabase API key format
- Supabase migrated keys: `sb_publishable_...` (browser, = anon) and `sb_secret_...` (server, = service_role). The new **secret key** works as the server `SUPABASE_SERVICE_ROLE_KEY` with supabase-js (bypasses RLS). Legacy `eyJ...` anon/service_role still exist under a "Legacy" tab.
- api-server admin ops (collab invite-accept, member mgmt, referral reward via `adminClient()`) require `SUPABASE_SERVICE_ROLE_KEY`; without it collab returns 500 "Collaboration is not configured".
