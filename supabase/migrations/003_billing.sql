-- Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
-- Billing: per-user subscription state synced from Stripe webhooks.
-- Run AFTER 002_production_hardening.sql.

create table if not exists public.subscriptions (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id   text unique,
  stripe_subscription_id text unique,
  plan                 text not null default 'free'
                       check (plan in ('free', 'pro', 'team')),
  status               text not null default 'active',
  current_period_end   timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "subs: owner read" on public.subscriptions;
create policy "subs: owner read"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Updated rate limit: per-tier caps.
create or replace function public.check_chat_rate_limit(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count int;
  user_plan    text;
  per_minute   int;
begin
  select coalesce(plan, 'free') into user_plan
    from public.subscriptions where user_id = p_user_id;
  user_plan := coalesce(user_plan, 'free');

  per_minute := case user_plan
    when 'free' then 15
    when 'pro'  then 60
    when 'team' then 200
    else 15
  end;

  select count(*) into recent_count
  from public.usage_log
  where user_id = p_user_id
    and endpoint = 'chat'
    and created_at > now() - interval '1 minute';

  if recent_count >= per_minute then
    return false;
  end if;

  insert into public.usage_log (user_id, endpoint) values (p_user_id, 'chat');
  return true;
end;
$$;

grant execute on function public.check_chat_rate_limit(uuid) to authenticated;
