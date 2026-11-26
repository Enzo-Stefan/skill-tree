-- 008: the player card fields and the weekly rating snapshots (#123, src/lib/ratings.ts).
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run. Running it twice is safe.
-- It needs 001 (touch_updated_at). Run it BEFORE the app version that reads it is merged: main deploys itself.
--
--   player_cards       position and preferred foot. Optional, synced, and private: only the owner can read their
--                      row, and nothing here is returned by leaderboard(). A player who joins the leaderboard
--                      shares nothing more than before. (Showing these to others would be a later opt-in.)
--   rating_snapshots   one row per player, tree and week (the week's Monday): the six branch ratings and the
--                      overall, so the career page can draw how a player developed. Written only through
--                      save_rating_snapshots(); a later `at` for the same week replaces an earlier one.

create table if not exists public.player_cards (
  user_id         uuid        primary key references auth.users (id) on delete cascade,
  player_position text                 check (player_position in ('GK', 'DEF', 'MID', 'FWD')),
  preferred_foot  text                 check (preferred_foot in ('left', 'right', 'both')),
  updated_at      timestamptz not null default now()
);

alter table public.player_cards enable row level security;
revoke all on public.player_cards from anon, authenticated;
grant select, delete on public.player_cards to authenticated;
-- Per-column writes, so updated_at is only set by the trigger.
grant insert (user_id, player_position, preferred_foot), update (player_position, preferred_foot) on public.player_cards to authenticated;

drop policy if exists "read own card" on public.player_cards;
create policy "read own card" on public.player_cards for select to authenticated using (auth.uid() = user_id);
drop policy if exists "insert own card" on public.player_cards;
create policy "insert own card" on public.player_cards for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "update own card" on public.player_cards;
create policy "update own card" on public.player_cards for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "delete own card" on public.player_cards;
create policy "delete own card" on public.player_cards for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists player_cards_touch on public.player_cards;
create trigger player_cards_touch before update on public.player_cards
  for each row execute function public.touch_updated_at();

create table if not exists public.rating_snapshots (
  user_id  uuid        not null references auth.users (id) on delete cascade,
  tree_id  text        not null check (char_length(tree_id) between 1 and 64),
  week     date        not null check (extract(isodow from week) = 1),
  ratings  jsonb       not null check (jsonb_typeof(ratings) = 'object'),
  overall  smallint    not null check (overall between 0 and 99),
  at       timestamptz not null,
  primary key (user_id, tree_id, week)
);

alter table public.rating_snapshots enable row level security;
revoke all on public.rating_snapshots from anon, authenticated;
grant select on public.rating_snapshots to authenticated;
drop policy if exists "read own snapshots" on public.rating_snapshots;
create policy "read own snapshots" on public.rating_snapshots for select to authenticated using (auth.uid() = user_id);

-- Saves a batch of snapshots: [{ "week": "2026-11-23", "ratings": { "bc": 30, ... }, "overall": 5, "at": "..." }].
-- A snapshot for a week that already has one replaces it only when its `at` is later. Bad entries are skipped.
-- At most 300 per call and 520 weeks per player and tree.
create or replace function public.save_rating_snapshots(p_tree_id text, p_snapshots jsonb) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  s       jsonb;
  changed integer := 0;
  n       integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to save ratings.' using errcode = '28000';
  end if;
  if p_tree_id is null or char_length(p_tree_id) not between 1 and 64 then
    raise exception 'Unknown tree.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_snapshots) is distinct from 'array' or jsonb_array_length(p_snapshots) > 300 then
    raise exception 'Send at most 300 snapshots at a time.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('save_rating_snapshots:' || auth.uid()::text, 0));

  for s in select * from jsonb_array_elements(p_snapshots) loop
    begin
      if jsonb_typeof(s) <> 'object'
         or jsonb_typeof(s -> 'ratings') <> 'object'
         or (select count(*) from jsonb_object_keys(s -> 'ratings')) > 12
         or exists (select 1 from jsonb_each(s -> 'ratings') e
                     where jsonb_typeof(e.value) <> 'number' or (e.value #>> '{}') !~ '^[0-9]{1,2}$' or (e.value #>> '{}')::integer > 99
                        or e.key !~ '^[a-z0-9_-]{1,32}$')
         or jsonb_typeof(s -> 'overall') <> 'number' or (s ->> 'overall') !~ '^[0-9]{1,2}$' or (s ->> 'overall')::integer > 99 then
        continue;
      end if;
      if (select count(*) from public.rating_snapshots x where x.user_id = auth.uid() and x.tree_id = p_tree_id) >= 520
         and not exists (select 1 from public.rating_snapshots x where x.user_id = auth.uid() and x.tree_id = p_tree_id and x.week = (s ->> 'week')::date) then
        continue;
      end if;
      insert into public.rating_snapshots as x (user_id, tree_id, week, ratings, overall, at)
      values (auth.uid(), p_tree_id, (s ->> 'week')::date, s -> 'ratings', (s ->> 'overall')::integer, (s ->> 'at')::timestamptz)
      on conflict (user_id, tree_id, week) do update
         set ratings = excluded.ratings, overall = excluded.overall, at = excluded.at
       where excluded.at > x.at;
      get diagnostics n = row_count;
      changed := changed + n;
    exception when others then
      -- A bad date or time in one snapshot (or a week that is not a Monday): skip it.
      continue;
    end;
  end loop;
  return changed;
end;
$$;

revoke all on function public.save_rating_snapshots(text, jsonb) from public, anon;
grant execute on function public.save_rating_snapshots(text, jsonb) to authenticated;
