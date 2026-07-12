-- Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
-- Zola: projects + files schema with row-level security

create extension if not exists "pgcrypto";

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  default_model text not null default 'claude-sonnet-4-6',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists projects_owner_id_idx on public.projects(owner_id);

create table if not exists public.project_files (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  path        text not null,
  content     text not null default '',
  updated_at  timestamptz not null default now(),
  unique (project_id, path)
);

create index if not exists project_files_project_id_idx
  on public.project_files(project_id);

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant', 'system')),
  content    text not null,
  model_id   text,
  created_at timestamptz not null default now()
);

create index if not exists messages_project_id_idx
  on public.messages(project_id, created_at);

alter table public.projects       enable row level security;
alter table public.project_files  enable row level security;
alter table public.messages       enable row level security;

drop policy if exists "projects: owner read"   on public.projects;
drop policy if exists "projects: owner insert" on public.projects;
drop policy if exists "projects: owner update" on public.projects;
drop policy if exists "projects: owner delete" on public.projects;

create policy "projects: owner read"
  on public.projects for select
  using (auth.uid() = owner_id);
create policy "projects: owner insert"
  on public.projects for insert
  with check (auth.uid() = owner_id);
create policy "projects: owner update"
  on public.projects for update
  using (auth.uid() = owner_id);
create policy "projects: owner delete"
  on public.projects for delete
  using (auth.uid() = owner_id);

drop policy if exists "files: via project" on public.project_files;
create policy "files: via project"
  on public.project_files for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "messages: via project" on public.messages;
create policy "messages: via project"
  on public.messages for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch
  before update on public.projects
  for each row execute function public.touch_updated_at();

drop trigger if exists project_files_touch on public.project_files;
create trigger project_files_touch
  before update on public.project_files
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- Referrals: profiles carry a referral code + credit balance; referrals track
-- who referred whom and reward the referrer once the referred user pays.
-- ============================================================================

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  referral_code text not null unique,
  referred_by   uuid references auth.users(id),
  credit_cents  integer not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.referrals (
  id               uuid primary key default gen_random_uuid(),
  referrer_id      uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null references auth.users(id) on delete cascade,
  status           text not null default 'pending' check (status in ('pending', 'qualified')),
  reward_cents     integer not null default 0,
  created_at       timestamptz not null default now(),
  qualified_at     timestamptz,
  unique (referred_user_id)
);

create index if not exists referrals_referrer_idx on public.referrals(referrer_id);

create or replace function public.gen_referral_code()
returns text language plpgsql
-- pgcrypto (gen_random_bytes) lives in the `extensions` schema on Supabase, and
-- callers like handle_new_user run with `search_path = public`, which would hide
-- it. Pin the search_path here so the code resolves regardless of the caller.
set search_path = public, extensions as $$
declare c text;
begin
  loop
    c := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
    exit when not exists (select 1 from public.profiles where referral_code = c);
  end loop;
  return c;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ref_code text;
  ref_user uuid;
begin
  ref_code := nullif(new.raw_user_meta_data->>'referral_code', '');
  if ref_code is not null then
    select id into ref_user from public.profiles where referral_code = ref_code;
  end if;

  insert into public.profiles (id, referral_code, referred_by)
  values (new.id, public.gen_referral_code(), ref_user)
  on conflict (id) do nothing;

  if ref_user is not null and ref_user <> new.id then
    insert into public.referrals (referrer_id, referred_user_id, status)
    values (ref_user, new.id, 'pending')
    on conflict (referred_user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users that predate this schema.
insert into public.profiles (id, referral_code)
select u.id, public.gen_referral_code()
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

alter table public.profiles  enable row level security;
alter table public.referrals enable row level security;

drop policy if exists "profiles: self read"   on public.profiles;
drop policy if exists "profiles: self insert" on public.profiles;
drop policy if exists "profiles: self update" on public.profiles;
create policy "profiles: self read"
  on public.profiles for select using (auth.uid() = id);
create policy "profiles: self insert"
  on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: self update"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "referrals: referrer read" on public.referrals;
create policy "referrals: referrer read"
  on public.referrals for select using (auth.uid() = referrer_id);

-- Atomically claim a pending referral and credit the referrer exactly once.
-- The conditional UPDATE ... RETURNING guarantees only the first caller that
-- flips 'pending' -> 'qualified' credits the referrer, so concurrent Stripe
-- webhook deliveries cannot double-pay.
create or replace function public.qualify_referral(p_referred uuid, p_reward int)
returns void language plpgsql security definer set search_path = public as $$
declare v_referrer uuid;
begin
  update public.referrals
    set status = 'qualified', reward_cents = p_reward, qualified_at = now()
    where referred_user_id = p_referred and status = 'pending'
    returning referrer_id into v_referrer;

  if v_referrer is not null then
    update public.profiles
      set credit_cents = credit_cents + p_reward
      where id = v_referrer;
  end if;
end;
$$;

-- ============================================================================
-- Collaboration: project members + shareable invites. A security-definer
-- access check avoids RLS recursion between projects and project_members.
-- ============================================================================

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'editor' check (role in ('editor')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists project_members_user_idx on public.project_members(user_id);

create table if not exists public.project_invites (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  email       text,
  token       text not null unique,
  role        text not null default 'editor' check (role in ('editor')),
  invited_by  uuid not null references auth.users(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  accepted_by uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '30 days')
);

create index if not exists project_invites_project_idx on public.project_invites(project_id);

create or replace function public.has_project_access(pid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.projects p where p.id = pid and p.owner_id = auth.uid()
  ) or exists (
    select 1 from public.project_members m where m.project_id = pid and m.user_id = auth.uid()
  );
$$;

-- Widen read access to members while keeping project writes owner-only.
drop policy if exists "projects: owner read"  on public.projects;
drop policy if exists "projects: member read" on public.projects;
-- The owner_id short-circuit is required for `insert ... returning` (Supabase's
-- .insert().select()): RETURNING re-checks the SELECT policy on the new row, but
-- has_project_access() re-queries projects by id and the just-inserted row is not
-- yet visible to that STABLE function's snapshot, so it would wrongly deny the
-- row. Reading owner_id directly off the new row avoids the re-query entirely.
create policy "projects: member read"
  on public.projects for select
  using (owner_id = auth.uid() or public.has_project_access(id));

drop policy if exists "files: via project" on public.project_files;
create policy "files: via project"
  on public.project_files for all
  using (public.has_project_access(project_id))
  with check (public.has_project_access(project_id));

drop policy if exists "messages: via project" on public.messages;
create policy "messages: via project"
  on public.messages for all
  using (public.has_project_access(project_id))
  with check (public.has_project_access(project_id));

alter table public.project_members enable row level security;
alter table public.project_invites enable row level security;

drop policy if exists "members: read via access" on public.project_members;
create policy "members: read via access"
  on public.project_members for select using (public.has_project_access(project_id));

drop policy if exists "members: owner manage" on public.project_members;
create policy "members: owner manage"
  on public.project_members for all
  using (
    exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  );

drop policy if exists "invites: owner manage" on public.project_invites;
create policy "invites: owner manage"
  on public.project_invites for all
  using (
    exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  );
-- ============================================================================
-- Organizations (Workspaces): the multi-tenant account boundary. Projects
-- belong to an organization; members hold a role (owner/admin/member).
-- Individuals get an auto-created personal workspace so nothing is per-user
-- special-cased. Subscriptions can later attach to an organization.
-- Security-definer helpers mirror has_project_access to avoid RLS recursion.
-- ============================================================================

create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  personal   boolean not null default false,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organizations_owner_idx on public.organizations(owner_id);

create table if not exists public.organization_members (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists organization_members_user_idx on public.organization_members(user_id);

create table if not exists public.organization_invites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  email       text,
  token       text not null unique,
  role        text not null default 'member' check (role in ('admin', 'member')),
  invited_by  uuid not null references auth.users(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  accepted_by uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '30 days')
);

create index if not exists organization_invites_org_idx on public.organization_invites(org_id);

-- Projects belong to a workspace (nullable during migration, then backfilled).
alter table public.projects add column if not exists org_id uuid references public.organizations(id) on delete cascade;
create index if not exists projects_org_id_idx on public.projects(org_id);

drop trigger if exists organizations_touch on public.organizations;
create trigger organizations_touch
  before update on public.organizations
  for each row execute function public.touch_updated_at();

-- Security-definer membership checks (bypass RLS on organization_members to
-- avoid recursion between the members policy and the helper it depends on).
create or replace function public.is_org_member(oid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
    where m.org_id = oid and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(oid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
    where m.org_id = oid and m.user_id = auth.uid() and m.role in ('owner', 'admin')
  );
$$;

-- Project access now also flows through workspace membership.
create or replace function public.has_project_access(pid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.projects p where p.id = pid and p.owner_id = auth.uid()
  ) or exists (
    select 1 from public.project_members m where m.project_id = pid and m.user_id = auth.uid()
  ) or exists (
    select 1 from public.projects p
    join public.organization_members om on om.org_id = p.org_id
    where p.id = pid and om.user_id = auth.uid()
  );
$$;

-- Widen project writes to workspace members; deletes stay owner/admin only.
drop policy if exists "projects: owner insert" on public.projects;
drop policy if exists "projects: owner update" on public.projects;
drop policy if exists "projects: owner delete" on public.projects;
drop policy if exists "projects: member insert" on public.projects;
drop policy if exists "projects: member update" on public.projects;
drop policy if exists "projects: admin delete" on public.projects;

create policy "projects: member insert"
  on public.projects for insert
  with check (
    owner_id = auth.uid()
    and (org_id is null or public.is_org_member(org_id))
  );
create policy "projects: member update"
  on public.projects for update
  using (public.has_project_access(id))
  with check (public.has_project_access(id));
create policy "projects: admin delete"
  on public.projects for delete
  using (
    owner_id = auth.uid()
    or (org_id is not null and public.is_org_admin(org_id))
  );

-- Tenancy columns are immutable after creation. Members can edit a project's
-- content but must not be able to re-parent it to another workspace or change
-- its owner (which would exfiltrate it out of the org). Backfill (null -> org)
-- is still permitted. Runs for the service role too, which never re-parents.
create or replace function public.projects_lock_tenancy()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'projects.owner_id is immutable';
  end if;
  if old.org_id is not null and new.org_id is distinct from old.org_id then
    raise exception 'projects.org_id cannot be changed once set';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_lock_tenancy on public.projects;
create trigger projects_lock_tenancy
  before update on public.projects
  for each row execute function public.projects_lock_tenancy();

alter table public.organizations       enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invites enable row level security;

drop policy if exists "orgs: member read"   on public.organizations;
drop policy if exists "orgs: authed insert" on public.organizations;
drop policy if exists "orgs: admin update"  on public.organizations;
drop policy if exists "orgs: owner delete"  on public.organizations;
create policy "orgs: member read"
  on public.organizations for select using (public.is_org_member(id));
create policy "orgs: authed insert"
  on public.organizations for insert with check (owner_id = auth.uid());
create policy "orgs: admin update"
  on public.organizations for update using (public.is_org_admin(id)) with check (public.is_org_admin(id));
create policy "orgs: owner delete"
  on public.organizations for delete using (owner_id = auth.uid());

-- Membership rows are read-only to members over their JWT; ALL writes go
-- through the API's service-role client, which enforces role checks and the
-- last-owner guard. Granting admins direct write here would let them bypass
-- those guards (self-promote to owner, delete the final owner).
drop policy if exists "org_members: read"         on public.organization_members;
drop policy if exists "org_members: admin manage" on public.organization_members;
create policy "org_members: read"
  on public.organization_members for select using (public.is_org_member(org_id));

-- Invites are managed exclusively by the API (service role). No direct JWT
-- access: with RLS enabled and no policy, all anon/authenticated access is
-- denied while the service role bypasses RLS.
drop policy if exists "org_invites: admin manage" on public.organization_invites;

-- Auto-provision a personal workspace whenever a new auth user is created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ref_code text;
  ref_user uuid;
  v_org    uuid;
  v_wsname text;
begin
  ref_code := nullif(new.raw_user_meta_data->>'referral_code', '');
  if ref_code is not null then
    select id into ref_user from public.profiles where referral_code = ref_code;
  end if;

  insert into public.profiles (id, referral_code, referred_by)
  values (new.id, public.gen_referral_code(), ref_user)
  on conflict (id) do nothing;

  if ref_user is not null and ref_user <> new.id then
    insert into public.referrals (referrer_id, referred_user_id, status)
    values (ref_user, new.id, 'pending')
    on conflict (referred_user_id) do nothing;
  end if;

  v_wsname := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    split_part(new.email, '@', 1),
    'My'
  ) || '''s Workspace';

  insert into public.organizations (name, personal, owner_id)
  values (v_wsname, true, new.id)
  returning id into v_org;

  insert into public.organization_members (org_id, user_id, role)
  values (v_org, new.id, 'owner')
  on conflict do nothing;

  return new;
end;
$$;

-- Backfill: give every existing user a personal workspace, assign their
-- projects to it, and fold existing project collaborators into the owning
-- workspace so nobody loses access. Idempotent via guards / on conflict.
do $$
declare u record; v_org uuid;
begin
  for u in select id, email, raw_user_meta_data from auth.users loop
    if not exists (
      select 1 from public.organizations o where o.owner_id = u.id and o.personal
    ) then
      insert into public.organizations (name, personal, owner_id)
      values (
        coalesce(
          nullif(u.raw_user_meta_data->>'full_name', ''),
          split_part(u.email, '@', 1),
          'My'
        ) || '''s Workspace',
        true,
        u.id
      )
      returning id into v_org;
      insert into public.organization_members (org_id, user_id, role)
      values (v_org, u.id, 'owner')
      on conflict do nothing;
    end if;
  end loop;
end $$;

update public.projects p
set org_id = o.id
from public.organizations o
where p.org_id is null and o.owner_id = p.owner_id and o.personal;

insert into public.organization_members (org_id, user_id, role)
select distinct p.org_id, pm.user_id, 'member'
from public.project_members pm
join public.projects p on p.id = pm.project_id
where p.org_id is not null
on conflict (org_id, user_id) do nothing;

-- ============================================================================
-- Billing seam (NOT active): subscriptions can attach to a user today and to a
-- workspace (org_id) in the future without a schema rewrite. Billing stays off
-- until STRIPE_* secrets are configured; see src/routes/stripe.ts.
-- ============================================================================

create table if not exists public.subscriptions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  org_id                 uuid references public.organizations(id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  plan                   text not null default 'free',
  status                 text not null default 'inactive',
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  updated_at             timestamptz not null default now()
);

-- Ensure org_id exists even if the subscriptions table predates workspaces.
alter table public.subscriptions
  add column if not exists org_id uuid references public.organizations(id) on delete cascade;

create index if not exists subscriptions_org_idx on public.subscriptions(org_id);

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions: self read" on public.subscriptions;
create policy "subscriptions: self read"
  on public.subscriptions for select using (auth.uid() = user_id);

-- ============================================================================
-- Project secrets (Replit-style env vars). Values are injected into the
-- WebContainer dev server + shell as process env. Access follows the same
-- has_project_access rule as files/messages, so collaborators share secrets.
-- ============================================================================

create table if not exists public.project_secrets (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  key        text not null,
  value      text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, key)
);

create index if not exists project_secrets_project_idx on public.project_secrets(project_id);

drop trigger if exists project_secrets_touch on public.project_secrets;
create trigger project_secrets_touch before update on public.project_secrets
  for each row execute function public.touch_updated_at();

alter table public.project_secrets enable row level security;

drop policy if exists "secrets: via project" on public.project_secrets;
create policy "secrets: via project"
  on public.project_secrets for all
  using (public.has_project_access(project_id))
  with check (public.has_project_access(project_id));

-- ============================================================================
-- Version control (checkpoints), Deployments, and the key-value Database —
-- the Replit-parity workspace tools. Checkpoints snapshot the full file tree
-- as jsonb; deployments store built static output served at /sites/:slug;
-- project_kv backs the Replit-DB-style store the running app reaches through
-- its ZOLA_DB_URL env var (routed by db_token, no user auth).
-- ============================================================================

create table if not exists public.project_snapshots (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  label      text not null default '',
  kind       text not null default 'manual' check (kind in ('manual', 'auto')),
  files      jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists project_snapshots_project_idx
  on public.project_snapshots(project_id, created_at desc);

alter table public.project_snapshots enable row level security;

drop policy if exists "snapshots: via project" on public.project_snapshots;
create policy "snapshots: via project"
  on public.project_snapshots for all
  using (public.has_project_access(project_id))
  with check (public.has_project_access(project_id));

create table if not exists public.deployments (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  slug       text not null,
  status     text not null default 'live',
  file_count int  not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists deployments_project_idx
  on public.deployments(project_id, created_at desc);
create index if not exists deployments_slug_idx
  on public.deployments(slug, created_at desc);

create table if not exists public.deployment_files (
  id            uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references public.deployments(id) on delete cascade,
  path          text not null,
  content       text not null,
  encoding      text not null default 'utf8' check (encoding in ('utf8', 'base64')),
  unique (deployment_id, path)
);

alter table public.deployments enable row level security;
alter table public.deployment_files enable row level security;

-- Owners/members manage deployments through their JWT; the public /sites/:slug
-- serving route reads via the service role, which bypasses RLS by design.
drop policy if exists "deployments: via project" on public.deployments;
create policy "deployments: via project"
  on public.deployments for all
  using (public.has_project_access(project_id))
  with check (public.has_project_access(project_id));

drop policy if exists "deployment files: via project" on public.deployment_files;
create policy "deployment files: via project"
  on public.deployment_files for all
  using (exists (
    select 1 from public.deployments d
    where d.id = deployment_id and public.has_project_access(d.project_id)
  ))
  with check (exists (
    select 1 from public.deployments d
    where d.id = deployment_id and public.has_project_access(d.project_id)
  ));

-- Per-project capability token the running app uses to reach its database.
-- Deliberately NOT a column on projects: projects can be publicly readable
-- (Explore), and the token grants KV write access, so it lives in a table
-- with RLS enabled and NO policies — service-role access only, via the API.
create table if not exists public.project_db_tokens (
  project_id uuid primary key references public.projects(id) on delete cascade,
  token      uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.project_db_tokens enable row level security;

create table if not exists public.project_kv (
  project_id uuid not null references public.projects(id) on delete cascade,
  key        text not null,
  value      text not null,
  updated_at timestamptz not null default now(),
  primary key (project_id, key)
);

alter table public.project_kv enable row level security;

drop policy if exists "kv: via project" on public.project_kv;
create policy "kv: via project"
  on public.project_kv for all
  using (public.has_project_access(project_id))
  with check (public.has_project_access(project_id));

-- ============================================================================
-- Community: public projects (Explore + Remix) and GitHub export. Public
-- visibility adds read-only anonymous access to the project row and its
-- files; chat, secrets, snapshots, and the KV store stay private.
-- ============================================================================

alter table public.projects
  add column if not exists visibility text not null default 'private'
    check (visibility in ('private', 'public'));

-- Last GitHub repo this project was pushed to ("owner/name"), for prefill.
alter table public.projects
  add column if not exists github_repo text;

create index if not exists projects_visibility_idx
  on public.projects(visibility, updated_at desc);

drop policy if exists "projects: public read" on public.projects;
create policy "projects: public read"
  on public.projects for select
  using (visibility = 'public');

drop policy if exists "files: public project read" on public.project_files;
create policy "files: public project read"
  on public.project_files for select
  using (exists (
    select 1 from public.projects p
    where p.id = project_id and p.visibility = 'public'
  ));

-- ============================================================================
-- Likes on public projects (Replit-style community upvotes).
-- ============================================================================

create table if not exists public.project_likes (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists project_likes_project_idx on public.project_likes(project_id);

alter table public.project_likes enable row level security;

-- Anyone (including logged-out visitors) can count likes on public projects;
-- members see likes on their own projects too.
drop policy if exists "likes: read" on public.project_likes;
create policy "likes: read"
  on public.project_likes for select
  using (exists (
    select 1 from public.projects p
    where p.id = project_id
      and (p.visibility = 'public' or public.has_project_access(p.id))
  ));

-- Users like/unlike as themselves, only on projects they can see.
drop policy if exists "likes: insert own" on public.project_likes;
create policy "likes: insert own"
  on public.project_likes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id
        and (p.visibility = 'public' or public.has_project_access(p.id))
    )
  );

drop policy if exists "likes: delete own" on public.project_likes;
create policy "likes: delete own"
  on public.project_likes for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- Custom domains: an organization links its own domain to a project's
-- deployment. Ownership is proven via a DNS TXT challenge; once verified,
-- the API serves that project's live deployment for requests whose Host
-- header matches (TLS termination is handled by the fronting infra).
-- ============================================================================

create table if not exists public.custom_domains (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  domain     text not null unique,
  token      uuid not null default gen_random_uuid(),
  verified   boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists custom_domains_project_idx on public.custom_domains(project_id);

alter table public.custom_domains enable row level security;

drop policy if exists "domains: via project" on public.custom_domains;
create policy "domains: via project"
  on public.custom_domains for all
  using (public.has_project_access(project_id))
  with check (public.has_project_access(project_id));

-- ============================================================================
-- AI usage metering: one row per model call (chat, swarm architect, swarm
-- worker). Powers monthly plan quotas and the admin usage stats. Writes are
-- service-role only; users can read their own usage.
-- ============================================================================

create table if not exists public.ai_usage (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  org_id            uuid references public.organizations(id) on delete set null,
  project_id        uuid references public.projects(id) on delete set null,
  model_id          text not null,
  kind              text not null default 'chat',
  prompt_tokens     integer not null default 0,
  completion_tokens integer not null default 0,
  created_at        timestamptz not null default now()
);

create index if not exists ai_usage_user_month_idx on public.ai_usage(user_id, created_at desc);
create index if not exists ai_usage_org_month_idx on public.ai_usage(org_id, created_at desc);

alter table public.ai_usage enable row level security;

drop policy if exists "ai usage: self read" on public.ai_usage;
create policy "ai usage: self read"
  on public.ai_usage for select using (auth.uid() = user_id);

-- ============================================================================
-- Site analytics (Monitoring tool): one row per project per day, incremented
-- by the public /sites serving routes via the service role. Owners/members
-- read their own project's traffic; nobody writes through their JWT.
-- ============================================================================

create table if not exists public.site_hits (
  project_id uuid not null references public.projects(id) on delete cascade,
  day        date not null default (now() at time zone 'utc')::date,
  count      bigint not null default 0,
  primary key (project_id, day)
);

alter table public.site_hits enable row level security;

drop policy if exists "site hits: read via project" on public.site_hits;
create policy "site hits: read via project"
  on public.site_hits for select
  using (public.has_project_access(project_id));

-- Atomic increment used by the serving routes (service role bypasses RLS,
-- but the function keeps the upsert race-free).
create or replace function public.bump_site_hit(p_project uuid)
returns void
language sql
security definer
set search_path = public, extensions
as $$
  insert into public.site_hits (project_id, day, count)
  values (p_project, (now() at time zone 'utc')::date, 1)
  on conflict (project_id, day)
  do update set count = public.site_hits.count + 1;
$$;

revoke execute on function public.bump_site_hit(uuid) from public, anon, authenticated;
