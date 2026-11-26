-- 010: fixes to 008 (ratings, #136) found in review. Changes grants, one constraint and one function; no new tables.
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run. Running it twice is safe.
-- It needs 008.
--
-- What changes:
--  1. player_cards: the app saves the card with an upsert that also sets user_id (src/lib/ratingHistory.ts), and 008
--     only allowed updating position and foot, so every save of an existing card failed with "permission denied".
--     user_id is now updatable. The row-level policy still requires user_id = auth.uid() before and after, so a
--     player cannot move a card to someone else.
--  2. The week. 008 only checked that the day is a Monday. For 'infinity' the check returns NULL, which a CHECK
--     accepts, and any year passed. Now a week must be a real Monday from 2020-01-01 to one week ahead of today.
--     The table constraint is NOT VALID so rows already stored are not re-checked; the function applies the same rule.
--  3. The time. `at` could be 'infinity' (nothing could ever replace that week) or years ahead. Now a time that is not
--     a real date is skipped, and a time later than the server's clock is stored as the server's clock.
--  4. The tree. 008 took any text of 1 to 64 characters, so one account could keep 520 weeks in each of unlimited
--     made-up trees. Now only the trees that exist are accepted ('football', 'weights', the same list as save_xp_events
--     in 009). Adding a tree means adding it to this list in a new migration.
--
-- Still true: the ratings are whatever the app sends (0 to 99). The server does not recompute them from progress, so
-- they are for a player's own career page and must not go on the leaderboard until it does. Times come from the
-- player's device, so a clock that is a little off can still pick the wrong one of two edits to the same week.

grant update (user_id) on public.player_cards to authenticated;

alter table public.rating_snapshots drop constraint if exists rating_snapshots_week_sane;
alter table public.rating_snapshots
  add constraint rating_snapshots_week_sane
  check (isfinite(week) and week between date '2020-01-01' and current_date + 7) not valid;

create or replace function public.save_rating_snapshots(p_tree_id text, p_snapshots jsonb) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  s       jsonb;
  changed integer := 0;
  n       integer;
  v_week  date;
  v_at    timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Sign in to save ratings.' using errcode = '28000';
  end if;
  if p_tree_id is null or p_tree_id not in ('football', 'weights') then
    raise exception 'Unknown tree.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_snapshots) is distinct from 'array' or jsonb_array_length(p_snapshots) > 300 then
    raise exception 'Send at most 300 snapshots at a time.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('save_rating_snapshots:' || auth.uid()::text, 0));

  for s in select * from jsonb_array_elements(p_snapshots) loop
    begin
      if jsonb_typeof(s) is distinct from 'object'
         or jsonb_typeof(s -> 'ratings') is distinct from 'object'
         or (select count(*) from jsonb_object_keys(s -> 'ratings')) > 12
         or exists (select 1 from jsonb_each(s -> 'ratings') e
                     where jsonb_typeof(e.value) <> 'number' or (e.value #>> '{}') !~ '^[0-9]{1,2}$' or (e.value #>> '{}')::integer > 99
                        or e.key !~ '^[a-z0-9_-]{1,32}$')
         or jsonb_typeof(s -> 'overall') is distinct from 'number'
         or coalesce((s ->> 'overall') !~ '^[0-9]{1,2}$', true)
         or (s ->> 'overall')::integer > 99
         or jsonb_typeof(s -> 'week') is distinct from 'string'
         or jsonb_typeof(s -> 'at') is distinct from 'string' then
        continue;
      end if;

      v_week := (s ->> 'week')::date;
      v_at   := (s ->> 'at')::timestamptz;
      if not isfinite(v_week) or v_week not between date '2020-01-01' and current_date + 7
         or extract(isodow from v_week) <> 1 or not isfinite(v_at) then
        continue;
      end if;
      v_at := least(v_at, now());

      if (select count(*) from public.rating_snapshots x where x.user_id = auth.uid() and x.tree_id = p_tree_id) >= 520
         and not exists (select 1 from public.rating_snapshots x where x.user_id = auth.uid() and x.tree_id = p_tree_id and x.week = v_week) then
        continue;
      end if;
      insert into public.rating_snapshots as x (user_id, tree_id, week, ratings, overall, at)
      values (auth.uid(), p_tree_id, v_week, s -> 'ratings', (s ->> 'overall')::integer, v_at)
      on conflict (user_id, tree_id, week) do update
         set ratings = excluded.ratings, overall = excluded.overall, at = excluded.at
       where excluded.at > x.at;
      get diagnostics n = row_count;
      changed := changed + n;
    exception when others then
      -- A bad date or time in one snapshot: skip it.
      continue;
    end;
  end loop;
  return changed;
end;
$$;

revoke all on function public.save_rating_snapshots(text, jsonb) from public, anon;
grant execute on function public.save_rating_snapshots(text, jsonb) to authenticated;
