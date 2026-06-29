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
