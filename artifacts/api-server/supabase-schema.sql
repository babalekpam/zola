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
returns text language plpgsql as $$
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
create policy "projects: member read"
  on public.projects for select using (public.has_project_access(id));

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