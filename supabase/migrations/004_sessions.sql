-- Adds training sessions (idea 5 in #17): which skills a player worked on each day, so the history
-- follows a signed-in player to every device, like finished skills and the lift log.
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run. Running it twice is safe.
--
-- Run it BEFORE the app version that reads this column is merged: main deploys itself once CI passes,
-- and without the column, loading and saving progress fails for every signed-in player.
--
-- A list of small objects, cleaned by the app on every load (src/lib/sessions.ts):
--   sessions: [{ "date": "2026-11-24", "skillId": "bc1" }, ...]
-- The app keeps at most 5000 per tree. The limit here is a little higher, as a backstop.
-- Row-level security from 001 already covers new columns: players still only reach their own rows.

alter table public.progress
  add column if not exists sessions jsonb not null default '[]'::jsonb;

alter table public.progress drop constraint if exists progress_sessions_is_list;
alter table public.progress add constraint progress_sessions_is_list
  check (jsonb_typeof(sessions) = 'array' and jsonb_array_length(sessions) <= 6000);
