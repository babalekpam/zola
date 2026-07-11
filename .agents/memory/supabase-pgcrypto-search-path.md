---
name: Supabase pgcrypto / extensions search_path
description: Why signups (handle_new_user) broke with "gen_random_bytes does not exist" and the durable rule for calling extension functions.
---

# pgcrypto lives in the `extensions` schema on Supabase

On this Supabase project, `pgcrypto` (and other extensions) are installed in the
`extensions` schema, NOT `public` or `pg_catalog`. So `gen_random_bytes`,
`digest`, `crypt`, etc. are `extensions.<fn>`.

**Symptom seen:** every new-user signup failed with GoTrue 500
`"Database error creating new user"`. Reproducing the `auth.users` insert on the
live DB (rolled back) surfaced the real error:
`function gen_random_bytes(integer) does not exist` inside
`public.gen_referral_code()`, called from the `handle_new_user` trigger.

**Root cause:** `handle_new_user` is declared `set search_path = public`. Nested
calls (like `gen_referral_code`) inherit that search_path, so `extensions` is not
on the path and the unqualified `gen_random_bytes` cannot be resolved. It was NOT
the RLS-on-RETURNING class of bug (that one is real elsewhere, but not this).

**Why:** a function's `SET search_path` clause applies for its whole execution,
including nested function calls that don't set their own — so a restrictive
`search_path = public` on a trigger silently hides extension functions.

**How to apply / the rule:** any function that uses an extension function must
either (a) schema-qualify it (`extensions.gen_random_bytes(...)`), or (b) declare
`set search_path = public, extensions` on that function itself. The fix applied
here was (b) on `gen_referral_code`. Keep the live DB and
`artifacts/api-server/supabase-schema.sql` in lockstep whenever you touch DB
functions.

**Regression warning (happened once):** re-applying the repo's schema file to the
live DB silently REVERTED this fix and broke all signups again, because the fix
was not in the copy of `supabase-schema.sql` on GitHub main. After any schema
re-apply or tree swap, verify the fix is present both in the file AND live
(`select pg_get_functiondef('public.gen_referral_code()'::regprocedure)`), and
push the fixed schema file upstream so fresh applies don't regress.

**Debugging note:** the direct DB host `db.<ref>.supabase.co` is NOT reachable
from Replit. Use the Supavisor pooler `aws-1-us-east-1.pooler.supabase.com:5432`,
user `postgres.<ref>`, password from `SUPABASE_DB_URL`, `sslmode=require`.
