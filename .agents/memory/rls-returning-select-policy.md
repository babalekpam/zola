---
name: RLS INSERT...RETURNING + re-querying SELECT policy
description: Why Supabase .insert().select() can fail RLS even when the WITH CHECK passes, and how to write a RETURNING-safe SELECT policy.
---

Postgres applies the table's **SELECT** policy (USING) to the rows produced by
`INSERT ... RETURNING`. Supabase's `.insert().select()` / `.insert().select().single()`
always emits RETURNING, so the SELECT policy runs on the brand-new row.

**The trap:** if the SELECT policy calls a `STABLE`/`SECURITY DEFINER` function that
*re-queries the same table by id* (e.g. `has_project_access(id)` doing
`select 1 from projects where id = pid ...`), the just-inserted row is **not visible**
to that function's snapshot mid-INSERT, so it returns false and the whole statement
fails with `42501 new row violates row-level security policy` — even though the
INSERT `WITH CHECK` passed. Symptom in this repo: creating a project returned HTTP 500
and *zero* projects could ever be created.

**Diagnosis technique:** at the DB level, `insert ... WITHOUT returning` succeeds but
`insert ... RETURNING id` fails → the fault is the SELECT policy on RETURNING, not the
WITH CHECK.

**Fix (RETURNING-safe SELECT policy):** short-circuit on the row's **own columns**
before the re-querying function:
`using (owner_id = auth.uid() or has_project_access(id))`.
The `owner_id = auth.uid()` term reads the new row's column directly (no re-query, no
snapshot problem) and is always true for the creator, so RETURNING passes.

**Why not inline the full membership check** (`exists(project_members ...)`):
that re-enters RLS on `project_members`, whose own policy references `projects`,
causing `42P17 infinite recursion`. `has_project_access` avoids recursion precisely
because it is `SECURITY DEFINER`. Keep it for the non-owner branch.

**Same bug class elsewhere:** `handle_new_user` trigger does
`insert into organizations ... returning id into v_org`; the organizations SELECT
policy `is_org_member(id)` re-queries membership that doesn't exist yet → RETURNING
fails → "Database error creating new user" → **signups broken**. Not the reported
project-creation bug, but the identical pattern; fix org SELECT policy the same way
(short-circuit on `owner_id = auth.uid()`).

**How to apply:** any RLS'd table read via `.insert().select()` needs a SELECT policy
whose first branch is satisfiable from the new row's own columns. Fix both the live DB
(DDL via pooler) and `artifacts/api-server/supabase-schema.sql` in lockstep.
