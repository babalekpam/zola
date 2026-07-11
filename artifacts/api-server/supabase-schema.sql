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
