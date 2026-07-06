---
name: Applying supabase-schema.sql
description: How to apply artifacts/api-server/supabase-schema.sql to the Supabase DB from this environment.
---

# Applying the Supabase schema

`SUPABASE_DB_URL` points at the **direct** host `db.<ref>.supabase.co:5432`,
which is IPv6-only and unreachable from this container (psql just errors with an
empty message).

Apply through the **session pooler** instead: same URL but
- host `aws-1-us-east-1.pooler.supabase.com`
- port `5432`
- username `postgres.<ref>` (ref = the middle label of the direct hostname)

Build the pooler URL in Node from `SUPABASE_DB_URL` (never print the password),
then `psql "$PGURL" -v ON_ERROR_STOP=1 -f supabase-schema.sql`.

The schema is written to be idempotent (drop-if-exists + create, add-column
if-not-exists) so it is safe to re-run. One gotcha: pre-existing tables created
with `create table if not exists` are skipped, so new columns on them need an
explicit `alter table ... add column if not exists`.
