---
name: Workspaces / org multi-tenancy RLS
description: Security model for organizations/workspaces — where authorization is enforced and why RLS write policies are deliberately absent.
---

# Workspaces (organizations) authorization model

Multi-tenant boundary = `organizations`. Membership in `organization_members`
(owner/admin/member). Projects carry `org_id`.

## Rule: org membership/invite writes go through the API service-role client only
`organization_members` has a **read-only** RLS policy (`org_members: read`) and
`organization_invites` has **no** JWT policy at all (RLS on + no policy = deny).
All mutations (create org, change role, remove member, invites, accept) run in
`artifacts/api-server/src/routes/orgs.ts` via the service-role `adminClient`,
which bypasses RLS and enforces role checks + the last-owner guard in code.

**Why:** the Supabase anon key is shipped to the browser, so any authenticated
user can call Supabase REST directly with their JWT. A `for all using
is_org_admin` write policy would let an admin self-promote to owner or delete
the final owner directly, bypassing the Express guards. Keep the guards as the
single enforcement point and give JWTs no direct write path.

**How to apply:** never add an RLS write/`for all` policy to these tables to
"make the client simpler." Add a new API route using `adminClient` instead.

## Rule: project tenancy columns are immutable (trigger `projects_lock_tenancy`)
`projects.owner_id` and `projects.org_id` cannot change on UPDATE (backfill
null→org is still allowed). The `projects: member update` policy uses
`has_project_access`, so a plain member could otherwise re-parent a project into
their personal org and exfiltrate it. The trigger runs for the service role too,
which never re-parents.

**How to apply:** if a legitimate "move project to another workspace" feature is
ever needed, relax the trigger rather than widening the RLS policy.

## GET /orgs must filter user_id
`org_members: read` lets a member read ALL member rows of their orgs, so the
`/orgs` list query must `.eq("user_id", <caller>)` or it returns one duplicate
org per co-member and can surface another member's role to the caller.
