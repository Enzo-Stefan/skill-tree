-- Adds the lift log (#18) and test results (idea 6 in #17) to each progress row, so they follow a
-- signed-in player to every device, like finished skills do.
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run. Running it twice is safe.
--
-- Run it BEFORE the app version that reads these columns goes live. Without the columns, loading and
-- saving progress fails for every signed-in player (the app keeps working on the device).
--
-- Both are lists of small objects, cleaned by the app on every load (src/lib/lifts.ts, src/lib/results.ts):
--   lift_log: [{ "skillId": "lg1", "date": "2026-11-20", "kg": 62.5 }, ...]
--   results:  [{ "skillId": "ft2", "date": "2026-11-20", "value": 5.61 }, ...]
-- The app keeps at most 3000 of each per tree. The limits here are a little higher, as a backstop.
-- Row-level security from 001 already covers new columns: players still only reach their own rows.

alter table public.progress
  add column if not exists lift_log jsonb not null default '[]'::jsonb,
  add column if not exists results  jsonb not null default '[]'::jsonb;

alter table public.progress drop constraint if exists progress_lift_log_is_list;
alter table public.progress add constraint progress_lift_log_is_list
  check (jsonb_typeof(lift_log) = 'array' and jsonb_array_length(lift_log) <= 4000);

alter table public.progress drop constraint if exists progress_results_is_list;
alter table public.progress add constraint progress_results_is_list
  check (jsonb_typeof(results) = 'array' and jsonb_array_length(results) <= 4000);
