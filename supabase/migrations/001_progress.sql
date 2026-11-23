-- One row per player per tree: finished skills, the level they train at, and their training streak.
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

create table if not exists public.progress (
  user_id          uuid        not null references auth.users (id) on delete cascade,
  tree_id          text        not null check (char_length(tree_id) between 1 and 64),
  done             text[]      not null default '{}' check (cardinality(done) <= 500),
  player_level     text                 check (char_length(player_level) <= 64),
  player_step      smallint    not null default 1 check (player_step between 1 and 4),
  -- Training check-ins and streak state (src/lib/streak.ts). Weeks are identified by their Monday.
  practice_days    date[]      not null default '{}' check (cardinality(practice_days) <= 4000),
  streak_since     date,
  streak_asked_week date,
  updated_at       timestamptz not null default now(),
  primary key (user_id, tree_id)
);

-- Row-level security: a signed-in player can only see and change their own rows.
-- Without these policies the public anon key could read everyone's progress.
alter table public.progress enable row level security;

-- Let signed-in players reach the table through the API at all. The policies above still limit
-- them to their own rows. Signed-out visitors (anon) get no access. Needed when the project has
-- "Grant API access to new tables automatically" turned off.
revoke all on public.progress from anon;
grant select, insert, update, delete on public.progress to authenticated;

drop policy if exists "read own progress" on public.progress;
create policy "read own progress" on public.progress
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "insert own progress" on public.progress;
create policy "insert own progress" on public.progress
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "update own progress" on public.progress;
create policy "update own progress" on public.progress
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own progress" on public.progress;
create policy "delete own progress" on public.progress
  for delete to authenticated using (auth.uid() = user_id);

-- Keep updated_at current on every change.
create or replace function public.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists progress_touch on public.progress;
create trigger progress_touch before update on public.progress
  for each row execute function public.touch_updated_at();
