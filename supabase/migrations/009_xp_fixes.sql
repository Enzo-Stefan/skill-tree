-- 009: fixes to save_xp_events() from the review of 007 (#129). Replaces the function only; no table changes.
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run. Running it twice is safe.
-- It needs 007. (008 is the ratings migration, #136.)
--
-- What changes:
--  1. The amount. 007 kept the first amount and ignored a later one, while the app took the later copy's amount, so
--     the two could disagree for ever. Now both keep the SMALLER of the amounts seen for a key (src/lib/xp.ts,
--     `winner`), so an event is worth what it was first given and nothing can raise it afterwards.
--  2. The time. 007 accepted any time Postgres could read, such as 'infinity', which froze a key for ever (no later
--     change could beat it) and which the app then dropped. Now a time that is not a real date is skipped, and a
--     time later than the server's own clock is stored as the server's clock.
--  3. The tree. 007 took any text as a tree id, so one account could keep 6000 rows in each of unlimited made-up
--     trees. Now only the trees that exist are accepted. Adding a tree means adding it to this list in a new migration.
--  4. A missing key, xp or time is skipped on purpose (it used to be skipped only by accident, through an error).
--
-- Still true, and worth knowing: `xp` is the amount the app sends, within 0 to 10000. The server does not check it
-- against src/data/xp.ts. The XP total is fine for a player's own screens, but it must NOT go on the leaderboard or
-- anywhere other players see it until the server works out the amount from the event key itself.
-- Also still true: times come from the player's device. A clock set far ahead is pulled back to the server's time,
-- but a clock that is a little off can still make an undo and a re-pass on two devices resolve the wrong way round.

create or replace function public.save_xp_events(p_tree_id text, p_events jsonb) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  e       jsonb;
  changed integer := 0;
  n       integer;
  v_at    timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Sign in to save XP.' using errcode = '28000';
  end if;
  if p_tree_id is null or p_tree_id not in ('football', 'weights') then
    raise exception 'Unknown tree.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events) > 500 then
    raise exception 'Send at most 500 events at a time.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('save_xp_events:' || auth.uid()::text, 0));

  for e in select * from jsonb_array_elements(p_events) loop
    begin
      if jsonb_typeof(e) is distinct from 'object'
         or coalesce((e ->> 'key') !~ '^[a-z]+:[A-Za-z0-9_.:-]{1,90}$', true)
         or coalesce(char_length(e ->> 'key') > 100, true)
         or jsonb_typeof(e -> 'xp') is distinct from 'number'
         or coalesce((e ->> 'xp') !~ '^[0-9]{1,5}$', true)
         or coalesce((e ->> 'xp')::integer > 10000, true)
         or jsonb_typeof(e -> 'active') is distinct from 'boolean'
         or jsonb_typeof(e -> 'at') is distinct from 'string' then
        continue;
      end if;

      v_at := (e ->> 'at')::timestamptz;
      if not isfinite(v_at) then
        continue;
      end if;
      v_at := least(v_at, now());

      if (select count(*) from public.xp_events x where x.user_id = auth.uid() and x.tree_id = p_tree_id) >= 6000
         and not exists (select 1 from public.xp_events x where x.user_id = auth.uid() and x.tree_id = p_tree_id and x.event_key = e ->> 'key') then
        continue;
      end if;

      -- A later change decides `active` and `at` (on the same instant the switched-off one wins). The amount is
      -- always the smaller one. A row is only written when something would change.
      insert into public.xp_events as x (user_id, tree_id, event_key, xp, active, at)
      values (auth.uid(), p_tree_id, e ->> 'key', (e ->> 'xp')::integer, (e ->> 'active')::boolean, v_at)
      on conflict (user_id, tree_id, event_key) do update
         set xp     = least(x.xp, excluded.xp),
             active = case when excluded.at > x.at or (excluded.at = x.at and x.active and not excluded.active)
                           then excluded.active else x.active end,
             at     = case when excluded.at > x.at or (excluded.at = x.at and x.active and not excluded.active)
                           then excluded.at else x.at end
       where excluded.at > x.at
          or (excluded.at = x.at and x.active and not excluded.active)
          or excluded.xp < x.xp;
      get diagnostics n = row_count;
      changed := changed + n;
    exception when others then
      -- Anything else wrong with one event: skip it.
      continue;
    end;
  end loop;
  return changed;
end;
$$;

revoke all on function public.save_xp_events(text, jsonb) from public, anon;
grant execute on function public.save_xp_events(text, jsonb) to authenticated;
