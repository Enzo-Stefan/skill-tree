-- 007: the XP ledger (#121, src/lib/xp.ts). One row per player, tree and event key, so the same thing never pays
-- twice: a unique key (the primary key) rejects a duplicate, whichever device or sync produced it.
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run. Running it twice is safe.
--
-- Run it BEFORE the app version that reads it is merged: main deploys itself once CI passes.
--
--   event_key  "skill:bc1:pass", "session:2026-11-25", "streak:4", ... (src/lib/xp.ts builds them)
--   xp         what the event was worth when it was awarded. Retuning src/data/xp.ts never changes it.
--   active     false after an undo (the pass was un-ticked). The XP stops counting but the key stays, so
--              passing again switches it back on instead of paying twice.
--   at         when the row last changed. Two devices saving different states of one key: the later `at` wins.
--
-- Players read their own rows. They write only through save_xp_events(), which applies the same rules as the
-- app (a valid key, 0 to 10000 XP) and the later change winning. Nothing else has write access.

create table if not exists public.xp_events (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  tree_id    text        not null check (char_length(tree_id) between 1 and 64),
  event_key  text        not null check (event_key ~ '^[a-z]+:[A-Za-z0-9_.:-]{1,90}$' and char_length(event_key) <= 100),
  xp         integer     not null check (xp between 0 and 10000),
  active     boolean     not null,
  at         timestamptz not null,
  primary key (user_id, tree_id, event_key)
);

alter table public.xp_events enable row level security;
revoke all on public.xp_events from anon, authenticated;
grant select on public.xp_events to authenticated;

drop policy if exists "read own xp events" on public.xp_events;
create policy "read own xp events" on public.xp_events
  for select to authenticated using (auth.uid() = user_id);

-- Saves a batch of events for the signed-in player: new keys are added, and a key that is already there is
-- only changed when the incoming change is later (or the same instant and switched off, so a tie never
-- over-awards). Returns how many rows changed. Bad entries are skipped, not fatal, so one broken event
-- cannot block the rest of a sync. At most 500 events per call and 6000 per player and tree.
create or replace function public.save_xp_events(p_tree_id text, p_events jsonb) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  e       jsonb;
  changed integer := 0;
  n       integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to save XP.' using errcode = '28000';
  end if;
  if p_tree_id is null or char_length(p_tree_id) not between 1 and 64 then
    raise exception 'Unknown tree.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events) > 500 then
    raise exception 'Send at most 500 events at a time.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('save_xp_events:' || auth.uid()::text, 0));

  for e in select * from jsonb_array_elements(p_events) loop
    begin
      if jsonb_typeof(e) <> 'object'
         or (e ->> 'key') !~ '^[a-z]+:[A-Za-z0-9_.:-]{1,90}$'
         or char_length(e ->> 'key') > 100
         or jsonb_typeof(e -> 'xp') <> 'number' or (e ->> 'xp') !~ '^[0-9]{1,5}$' or (e ->> 'xp')::integer > 10000
         or jsonb_typeof(e -> 'active') <> 'boolean' then
        continue;
      end if;
      if (select count(*) from public.xp_events x where x.user_id = auth.uid() and x.tree_id = p_tree_id) >= 6000
         and not exists (select 1 from public.xp_events x where x.user_id = auth.uid() and x.tree_id = p_tree_id and x.event_key = e ->> 'key') then
        continue;
      end if;
      insert into public.xp_events as x (user_id, tree_id, event_key, xp, active, at)
      values (auth.uid(), p_tree_id, e ->> 'key', (e ->> 'xp')::integer, (e ->> 'active')::boolean, (e ->> 'at')::timestamptz)
      on conflict (user_id, tree_id, event_key) do update
         set active = excluded.active, at = excluded.at
       where excluded.at > x.at or (excluded.at = x.at and x.active and not excluded.active);
      get diagnostics n = row_count;
      changed := changed + n;
    exception when others then
      -- A bad time or value in one event: skip it.
      continue;
    end;
  end loop;
  return changed;
end;
$$;

revoke all on function public.save_xp_events(text, jsonb) from public, anon;
grant execute on function public.save_xp_events(text, jsonb) to authenticated;
