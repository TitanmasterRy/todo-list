-- Homework To-Do: email + password accounts for sync.
-- Run once in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.
-- Each signed-in user gets one row holding their synced data. Row-level security makes
-- every row readable and writable only by its owner, so the public anon key is safe to ship.

create table if not exists public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null,
  version    integer     not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

drop policy if exists "read own data"   on public.user_data;
drop policy if exists "insert own data" on public.user_data;
drop policy if exists "update own data" on public.user_data;
drop policy if exists "delete own data" on public.user_data;

create policy "read own data"   on public.user_data for select using (auth.uid() = user_id);
create policy "insert own data" on public.user_data for insert with check (auth.uid() = user_id);
create policy "update own data" on public.user_data for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own data" on public.user_data for delete using (auth.uid() = user_id);

-- Keep one account's data from growing without bound (5 MB of JSON).
alter table public.user_data drop constraint if exists user_data_size;
alter table public.user_data add constraint user_data_size check (pg_column_size(data) < 5 * 1024 * 1024);

-- ---------------------------------------------------------------------------------------------
-- Optional: live friend cards (Stats → Friends → Keep my card live). Safe to run again.
-- One row per person who turns it on, keyed by a random public id that's inside their friend code.
-- The card holds only name, emoji, streak, best streak, this week's XP, level and a timestamp.
-- Owners can write and see their own row; anyone else can read a row only by its id, through
-- friend_cards_by_id() below, so the table can't be listed or searched.

create table if not exists public.friend_cards (
  id         text        primary key check (id ~ '^[a-z0-9]{16,40}$'),
  owner      uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  card       jsonb       not null check (pg_column_size(card) < 2048),
  updated_at timestamptz not null default now()
);

alter table public.friend_cards enable row level security;

drop policy if exists "read own card"   on public.friend_cards;
drop policy if exists "insert own card" on public.friend_cards;
drop policy if exists "update own card" on public.friend_cards;
drop policy if exists "delete own card" on public.friend_cards;

create policy "read own card"   on public.friend_cards for select using (auth.uid() = owner);
create policy "insert own card" on public.friend_cards for insert with check (auth.uid() = owner);
create policy "update own card" on public.friend_cards for update using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "delete own card" on public.friend_cards for delete using (auth.uid() = owner);

-- Public read by id only (at most 100 ids per call).
create or replace function public.friend_cards_by_id(ids text[])
returns table (id text, card jsonb, updated_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select f.id, f.card, f.updated_at from public.friend_cards f
  where f.id = any (ids[1:100]);
$$;

revoke all on function public.friend_cards_by_id(text[]) from public;
grant execute on function public.friend_cards_by_id(text[]) to anon, authenticated;
