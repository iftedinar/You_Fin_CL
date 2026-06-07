-- ============================================================
-- KnowBase — Complete Supabase Schema
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- Resources table: stores every learning resource
create table if not exists public.resources (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  title           text not null default 'Untitled',
  source_type     text not null check (source_type in ('youtube', 'article', 'pdf', 'docx', 'txt', 'note')),
  source_url      text,
  raw_text        text,
  extracted       jsonb,
  status          text not null default 'processing' check (status in ('processing', 'ready', 'error')),
  study_status    text not null default 'not_started' check (study_status in ('not_started', 'in_progress', 'completed', 'saved_for_later')),
  error_message   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Notes table: personal notes per resource
create table if not exists public.notes (
  id              uuid primary key default gen_random_uuid(),
  resource_id     uuid not null references public.resources(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  content         text not null,
  created_at      timestamptz not null default now()
);

-- Quiz attempts table: track scores per resource
create table if not exists public.quiz_attempts (
  id              uuid primary key default gen_random_uuid(),
  resource_id     uuid not null references public.resources(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  score           integer not null,
  total           integer not null,
  answers         jsonb not null default '[]',
  created_at      timestamptz not null default now()
);

-- Test attempts table: cross-resource tests (combines questions from multiple resources)
create table if not exists public.test_attempts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  resource_ids    uuid[] not null default '{}',
  score           integer not null,
  total           integer not null,
  answers         jsonb not null default '[]',
  questions       jsonb not null default '[]',
  created_at      timestamptz not null default now()
);

-- Auto-update updated_at on resources
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger resources_updated_at
  before update on public.resources
  for each row execute function update_updated_at();

-- Row Level Security: users can only see their own data
alter table public.resources enable row level security;
alter table public.notes enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.test_attempts enable row level security;

create policy "Users manage own resources"
  on public.resources for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own notes"
  on public.notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own quiz attempts"
  on public.quiz_attempts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own test attempts"
  on public.test_attempts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Indexes for performance
create index if not exists resources_user_id_idx on public.resources(user_id);
create index if not exists resources_status_idx on public.resources(status);
create index if not exists resources_created_at_idx on public.resources(created_at desc);
create index if not exists notes_resource_id_idx on public.notes(resource_id);
create index if not exists quiz_attempts_resource_id_idx on public.quiz_attempts(resource_id);
create index if not exists quiz_attempts_user_id_idx on public.quiz_attempts(user_id);
create index if not exists test_attempts_user_id_idx on public.test_attempts(user_id);
