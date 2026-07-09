-- ============================================================
-- Migration: spaced-repetition flashcards
-- Run this in Supabase SQL Editor
-- ============================================================

create table if not exists public.flashcards (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  resource_id     uuid not null references public.resources(id) on delete cascade,
  front           text not null,
  back            text not null,
  -- SM-2 scheduling state
  ease            real not null default 2.5,
  interval_days   real not null default 0,
  reps            integer not null default 0,
  due_at          timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

alter table public.flashcards enable row level security;

create policy "Users manage own flashcards"
  on public.flashcards for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists flashcards_user_due_idx on public.flashcards(user_id, due_at);
create index if not exists flashcards_resource_idx on public.flashcards(resource_id);
