-- Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
-- Rate limiting + chat history persistence
-- Run this AFTER supabase/schema.sql

-- ---------- Rate limit log -----------------------------------------------
create table if not exists public.usage_log (
  id         bigserial primary key,
  user_id    uuid references auth.users(id) on delete cascade,
  endpoint   text not null,
  created_at timestamptz not null default now()
);

create index if not exists usage_log_user_endpoint_created_idx
  on public.usage_log (user_id, endpoint, created_at desc);

alter table public.usage_log enable row level security;

drop policy if exists "usage_log: owner read" on public.usage_log;
create policy "usage_log: owner read"
  on public.usage_log for select
  using (auth.uid() = user_id);

-- Cap each user to 30 chat requests per minute.
create or replace function public.check_chat_rate_limit(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count int;
begin
  select count(*) into recent_count
  from public.usage_log
  where user_id = p_user_id
    and endpoint = 'chat'
    and created_at > now() - interval '1 minute';

  if recent_count >= 30 then
    return false;
  end if;

  insert into public.usage_log (user_id, endpoint) values (p_user_id, 'chat');
  return true;
end;
$$;

grant execute on function public.check_chat_rate_limit(uuid) to authenticated;

-- Sweep old usage rows once a day. Run from the Supabase cron extension or
-- call manually with: select public.purge_old_usage_log();
create or replace function public.purge_old_usage_log()
returns void
language sql
as $$
  delete from public.usage_log where created_at < now() - interval '24 hours';
$$;

-- ---------- Messages: backfill default + index ---------------------------
-- (table itself was created in schema.sql)
create index if not exists messages_project_created_idx
  on public.messages (project_id, created_at);
