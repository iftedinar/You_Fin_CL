-- ============================================================
-- KnowBase — Migration: add test_attempts table
-- Run this in the Supabase SQL Editor (safe to run once;
-- "if not exists" guards make it safe to re-run too)
-- ============================================================

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

alter table public.test_attempts enable row level security;

drop policy if exists "Users manage own test attempts" on public.test_attempts;
create policy "Users manage own test attempts"
  on public.test_attempts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists test_attempts_user_id_idx on public.test_attempts(user_id);
