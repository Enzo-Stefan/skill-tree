-- The ranked leaderboard (#96). Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- Players opt in (off by default), pick a display name and optionally a country. Scopes at launch: global,
-- continent, hemisphere, country (no city board: it would show who lives in a given city). Ranking is done
-- here in the database, never in the browser. Rules (the same ones as src/lib/leaderboard.ts, which the
-- tests hold both to):
--   * Rank by skills finished (more is better), then level step 1 to 16 (higher), then best 30 m sprint (faster).
--   * Ties share a rank and the next rank is skipped (1, 2, 2, 4).
--   * Only opted-in players are ever returned, and only display name, country, rank, score and a random
--     per-player row key (for report_row(), never the user id). Never the city.
--   * Skills count only distinct, real football skill ids, so duplicates or made-up ids add nothing.
--   * Sprint times under 3.6 s or over 15 s are ignored, and the fastest one is rounded to 0.01 s before it
--     is compared, so 4.996 is not faster than 5.00.
--   * First save: skills at most 3, level step at most 1, sprint no faster than 4.5 s. Each 24-hour timer
--     starts then (when its value is above zero or set).
--   * After that, once per 24 hours each: skills can rise by at most 3, the level step by 1, and the sprint
--     record can get faster by at most 5% (to round(record * 0.95, 2)). Going down is always allowed and
--     doesn't touch the timer. One timer per value: a raise of 1 skill uses up that day's skills raise.
--   * Clearing the sprint results does not reset the sprint timer, and opting out only hides the row: the
--     score and its timers are kept, so opting out and back in resets nothing.
--   * A scoring error is logged as a warning and never blocks the player's progress save.
--   * Display names are stored NFKC-normalised and trimmed, use Latin, Cyrillic or Greek letters (one alphabet per
--     name), are unique ignoring case and look-alike letters, and pass a short blocklist (section 1).
-- Only the football tree is ranked at launch.

-- 1. Profiles: what a player tells the leaderboard about themselves. Only the owner can read or write a row.
create table if not exists public.profiles (
  user_id             uuid        primary key references auth.users (id) on delete cascade,
  display_name        text        not null check (char_length(display_name) between 3 and 20),
  country_code        text                 check (country_code ~ '^[A-Z]{2}$'),
  -- Stored for a later local board, never read by leaderboard() and never shown to anyone but the owner.
  city                text                 check (char_length(city) <= 60),
  hemisphere          text                 check (hemisphere in ('N', 'S')),
  leaderboard_opt_in  boolean     not null default false,
  updated_at          timestamptz not null default now()
);

create index if not exists profiles_country_idx on public.profiles (country_code) where leaderboard_opt_in;

-- Display names are stored NFKC-normalised with spaces trimmed from both ends (the trigger below does it, and
-- the app sends normalizeDisplayName()), so fullwidth or maths letters arrive as plain ones. This needs a UTF-8
-- database, which Supabase always is. The allowed letters are explicit ranges rather than [[:alnum:]], so they
-- don't depend on the locale; lower() does (Supabase's en_US.UTF-8 or C.UTF-8 lowers every alphabet, a plain C
-- locale only A-Z), which is why the look-alike maps list upper case too.

-- What must be unique: lower case with Cyrillic and Greek look-alikes (and the dotless ı) turned into Latin
-- letters, so an all-Cyrillic "Сосо" can't stand in for "Coco". The same as displayNameKey() in
-- src/lib/leaderboard.ts, and the first step of display_name_blocked() below.
create or replace function public.display_name_key(name text) returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  -- Upper case look-alikes are listed too, so this works even where lower() only knows ASCII.
  homoglyph_from text   := 'авеёіїјкмнорстухѕһӏАВЕЁІЇЈКМНОРСТУХЅҺӀαβεηικνορτυχάέήίόύΑΒΕΗΙΚΝΟΡΤΥΧΆΈΉΊΌΎζΖı';
  homoglyph_to   text   := 'abeeiijkmhopctyxshlabeeiijkmhopctyxshlabenikvoptuxaeniouabehiknoptyxaehioyzzi';
begin
  -- Look-alikes before and after lower case, so capital Greek Ν reads as n, not ν.
  return translate(lower(translate(name, homoglyph_from, homoglyph_to)), homoglyph_from, homoglyph_to);
end;
$$;

-- One display name per player, ignoring case and look-alike letters. It replaces the older lower() index.
drop index if exists public.profiles_display_name_key;
create unique index if not exists profiles_display_name_unique on public.profiles (public.display_name_key(display_name));

-- Names: a letter or digit first, then letters, digits 0-9, spaces, dots, dashes and underscores. No "@", so no
-- email addresses. Letters are Latin (A-Z, Latin-1, Extended-A and -B, Extended Additional for Vietnamese)
-- without × and ÷, Greek U+0386-U+03CE and Cyrillic U+0400-U+04FF without the signs and combining marks in
-- those blocks; anything else (small capitals, other scripts, emoji, stray accents) is refused.
-- One alphabet per name: Latin, Cyrillic and Greek letters can't be mixed, so "fuсk" with a Cyrillic "с" is
-- refused. Names written wholly in Cyrillic or Greek are fine. The ranges are written as literal characters;
-- they are NAME_PATTERN and SCRIPT_CLASSES in src/lib/leaderboard.ts, and the tests check they agree.
create or replace function public.display_name_chars_ok(name text) returns boolean
language sql
immutable
set search_path = ''
as $$
  select name ~ '^[0-9A-Za-zÀ-ÖØ-öø-ɏḀ-ỿΆΈ-ΊΌΎ-ΡΣ-ώЀ-ҁҊ-ӿ][0-9A-Za-zÀ-ÖØ-öø-ɏḀ-ỿΆΈ-ΊΌΎ-ΡΣ-ώЀ-ҁҊ-ӿ ._-]*$'
     and (name ~ '[A-Za-zÀ-ɏḀ-ỿ]')::int
       + (name ~ '[Ѐ-ӿ]')::int
       + (name ~ '[Ͱ-Ͽ]')::int <= 1;
$$;

alter table public.profiles drop constraint if exists profiles_display_name_chars;
alter table public.profiles drop constraint if exists profiles_display_name_one_script;
alter table public.profiles add constraint profiles_display_name_chars
  check (public.display_name_chars_ok(display_name));

alter table public.profiles enable row level security;
-- "revoke all" first, so running this again also removes an older table-wide insert or update grant.
-- Writes are granted per column, so updated_at is only set by the trigger. user_id is in the update list so a
-- supabase-js upsert works; the update policy's check still keeps it equal to the player's own id.
revoke all on public.profiles from anon, authenticated;
grant select, delete on public.profiles to authenticated;
grant insert (user_id, display_name, country_code, city, hemisphere, leaderboard_opt_in),
      update (user_id, display_name, country_code, city, hemisphere, leaderboard_opt_in)
   on public.profiles to authenticated;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own profile" on public.profiles;
create policy "delete own profile" on public.profiles
  for delete to authenticated using (auth.uid() = user_id);

-- A short English and Spanish blocklist, a first line of defence. Each word is checked on its own (runs of
-- one- and two-letter words joined, so "p u t a" counts), folded two ways: look-alike digits as letters
-- ("sh1t") and digits dropped ("Puta10"). Strong stems are blocked anywhere in a word; short words only as a
-- whole word, plural "s"/"es" included, so "grape" and "computadora" stay fine. Every check also runs with
-- repeated letters squeezed ("fuuck"). A word that is a known innocent word ("Scunthorpe", "Yamashita",
-- "Putto") is let through: compared with digits dropped (so "Pu7to" is not "putto"), squeezed or not,
-- plural "s"/"es" allowed. Only the whole word counts, so "Sniggle" and "Niggler" are still caught. Cyrillic
-- and Greek look-alikes are turned into Latin letters first (display_name_key) and accents taken off (ñ kept).
-- Extend it before launch. These lists and steps are the same as in src/lib/leaderboard.ts; the tests check
-- the lists agree, and src/lib/displayNameCases.json holds names both must judge alike.
create or replace function public.display_name_blocked(name text) returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  blocked_stems  text[] := array['fuck','shit','bitch','cunt','nigg','whore','hitler','mierda','pendejo','cabron','faggot'];
  blocked_words  text[] := array['fag','slut','rape','nazi','puta','puto','joder','coño','verga','pija','violar'];
  allowed_words  text[] := array['scunthorpe','niggle','niggling','niggemann','shitake','yamashita','matsushita','kinoshita','morishita','ishita','kshitij','yoshitaka','mishit','pushit','pushitup','putto','rappe'];
  lookalike_from text   := '013457';
  lookalike_to   text   := 'oieast';
  raw            text;
  letters        text;
  mapped         text;
  bare           text;
  run_mapped     text   := '';
  run_bare       text   := '';
  words_mapped   text[] := '{}';
  words_bare     text[] := '{}';
  forms          text[];
  form           text;
  exempt         boolean;
  stem           text;
  i              int;
begin
  foreach raw in array regexp_split_to_array(btrim(normalize(name, NFKC), ' '), '[\s._-]+') loop
    -- Lower case and look-alikes, then accents off (ñ kept, Ñ too where lower() only knows ASCII).
    letters := replace(replace(public.display_name_key(raw), 'ñ', 'n~'), 'Ñ', 'n~');
    letters := replace(lower(regexp_replace(normalize(letters, NFD), '[\u0300-\u036f]', '', 'g')), 'n~', 'ñ');
    mapped := regexp_replace(translate(letters, lookalike_from, lookalike_to), '[^a-zñ]', '', 'g');
    bare := regexp_replace(letters, '[^a-zñ]', '', 'g');
    continue when mapped = '';
    if char_length(mapped) <= 2 then
      run_mapped := run_mapped || mapped;
      run_bare := run_bare || bare;
      continue;
    end if;
    if run_mapped <> '' then
      words_mapped := words_mapped || run_mapped;
      words_bare := words_bare || run_bare;
    end if;
    run_mapped := '';
    run_bare := '';
    words_mapped := words_mapped || mapped;
    words_bare := words_bare || bare;
  end loop;
  if run_mapped <> '' then
    words_mapped := words_mapped || run_mapped;
    words_bare := words_bare || run_bare;
  end if;

  for i in 1 .. coalesce(array_length(words_mapped, 1), 0) loop
    forms := array[words_mapped[i], regexp_replace(words_mapped[i], '(.)\1+', '\1', 'g'),
                   words_bare[i], regexp_replace(words_bare[i], '(.)\1+', '\1', 'g')];
    exempt := false;
    foreach form in array forms[3:4] loop
      if form = any (allowed_words) or regexp_replace(form, 's$', '') = any (allowed_words)
         or regexp_replace(form, 'es$', '') = any (allowed_words) then
        exempt := true;
      end if;
    end loop;
    continue when exempt;
    foreach form in array forms loop
      foreach stem in array blocked_stems loop
        if position(stem in form) > 0 then
          return true;
        end if;
      end loop;
    end loop;
    foreach form in array forms loop
      if form = any (blocked_words) or regexp_replace(form, 's$', '') = any (blocked_words)
         or regexp_replace(form, 'es$', '') = any (blocked_words) then
        return true;
      end if;
    end loop;
  end loop;
  return false;
end;
$$;

-- Stores the name NFKC-normalised and trimmed, then refuses a blocked one. A name that breaks the length or
-- character rules is left to the constraints, so it is refused for that reason, as displayNameError() does.
create or replace function public.check_display_name() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.display_name := btrim(normalize(new.display_name, NFKC), ' ');
  if char_length(new.display_name) between 3 and 20
     and public.display_name_chars_ok(new.display_name)
     and public.display_name_blocked(new.display_name) then
    raise exception 'That display name is not allowed.' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_check_name on public.profiles;
create trigger profiles_check_name before insert or update of display_name on public.profiles
  for each row execute function public.check_display_name();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- 2. Scores: one row per player and tree. Filled only by the trigger below, so the browser never writes a score.

-- The football skill ids that count towards the skills score. `done` is written by the browser, so the score
-- counts only distinct ids from this list. It mirrors src/data/football.ts; the tests check the two agree.
create or replace function public.football_skill_ids() returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['root','bc1','bc2','bc3','bc4','bc5','ps1','ps2','ps3','ps4','ps5','dr1','dr2','dr3','dr4','dr5','sh1','sh2','sh3','sh4','sh5','df1','df2','df4','df3','df5','ft1','ft2','ft3','ft4','ft5','final']::text[];
$$;

revoke all on function public.football_skill_ids() from public, anon, authenticated;

-- best_sprint is what the boards show and rank, and is cleared when the player clears their 30 m results.
-- sprint_record is the fastest time ever accepted and is never cleared, so clearing results can't reset the
-- once-per-24-hours limit on getting faster. The *_at columns are the 24-hour timers.
-- Opting out of the leaderboard only hides the row (leaderboard() shows opted-in players only): the score
-- row and its timers are kept, so opting out and back in can't reset any limit.
create table if not exists public.leaderboard_scores (
  user_id                uuid        not null references auth.users (id) on delete cascade,
  tree_id                text        not null,
  skills                 integer     not null default 0,
  level_step             smallint    not null default 0 check (level_step between 0 and 16),
  best_sprint            numeric(5,2)         check (best_sprint between 3.6 and 15),
  sprint_record          numeric(5,2)         check (sprint_record between 3.6 and 15),
  sprint_improved_at     timestamptz,
  level_step_raised_at   timestamptz,
  skills_raised_at       timestamptz,
  updated_at             timestamptz not null default now(),
  primary key (user_id, tree_id)
);

-- For a database that already ran an earlier version of this file: add the new columns and fix up the rows.
alter table public.leaderboard_scores
  add column if not exists sprint_record numeric(5,2) check (sprint_record between 3.6 and 15);
alter table public.leaderboard_scores
  add column if not exists skills_raised_at timestamptz;
update public.leaderboard_scores set sprint_record = best_sprint where sprint_record is null and best_sprint is not null;
-- Recount skills as distinct real ids, but only ever lower them: a re-run must not lift a score past the
-- 3-per-day limit. (Existing rows keep skills_raised_at null, so their next save may add up to 3 at once.)
update public.leaderboard_scores s
   set skills = least(s.skills, (select count(distinct d) from unnest(p.done) d where d = any (public.football_skill_ids())))
  from public.progress p
 where p.user_id = s.user_id and p.tree_id = s.tree_id and s.tree_id = 'football';

-- Football progress saved before this ran (or before the trigger existed) and with no score row yet gets one,
-- by the first-save rules of the trigger below: skills at most 3, level step at most 1, sprint rounded to
-- 0.01 s and no faster than 4.5 s, timers starting now.
insert into public.leaderboard_scores
  (user_id, tree_id, skills, skills_raised_at, level_step, level_step_raised_at, best_sprint, sprint_record, sprint_improved_at)
select p.user_id, p.tree_id,
       f.skills, case when f.skills > 0 then now() end,
       f.step, case when f.step > 0 then now() end,
       case when f.sprint is not null then greatest(f.sprint, 4.5) end,
       case when f.sprint is not null then greatest(f.sprint, 4.5) end,
       case when f.sprint is not null then now() end
  from public.progress p
  cross join lateral (
    select
      least(3, (select count(distinct d) from unnest(p.done) d where d = any (public.football_skill_ids())))::integer as skills,
      case when array_position(array['beginner', 'intermediate', 'advanced', 'expert'], p.player_level) is null
           then 0 else 1 end as step,
      (select round(min(v), 2) from (
         select case when (r ->> 'value') ~ '^[0-9]+(\.[0-9]+)?$' then (r ->> 'value')::numeric end as v
           from jsonb_array_elements(case when jsonb_typeof(p.results) = 'array' then p.results else '[]'::jsonb end) r
          where r ->> 'skillId' = 'ft2'
       ) t where v between 3.6 and 15) as sprint
  ) f
 where p.tree_id = 'football'
on conflict (user_id, tree_id) do nothing;

-- At most the number of football skills (32; the tests check it matches src/data/football.ts).
alter table public.leaderboard_scores drop constraint if exists leaderboard_scores_skills_check;
alter table public.leaderboard_scores drop constraint if exists leaderboard_scores_skills_range;
alter table public.leaderboard_scores add constraint leaderboard_scores_skills_range
  check (skills between 0 and 32);

alter table public.leaderboard_scores enable row level security;
revoke all on public.leaderboard_scores from anon, authenticated;
-- No policies and no grants: players cannot read or write this table directly. The function below reads it.

-- 3. Keep the score up to date whenever progress changes, with the cheating limits applied.
-- The steps match applyScoreUpdate() in src/lib/leaderboard.ts one for one.
create or replace function public.update_leaderboard_score() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  levels       text[] := array['beginner', 'intermediate', 'advanced', 'expert'];
  idx          integer;
  wanted       integer;
  skill_count  integer;
  has_sprint   boolean;
  sprint       numeric;
  prev         public.leaderboard_scores%rowtype;
  first_skills integer;
  first_step   integer;
  first_sprint numeric;
  new_skills   integer;
  new_skills_raised timestamptz;
  new_step     integer;
  new_raised   timestamptz;
  new_best     numeric;
  new_record   numeric;
  new_improved timestamptz;
begin
  -- A scoring error must never block the player's progress save: it is logged and the save goes on.
  begin
    -- Only the football tree is ranked at launch.
    if new.tree_id <> 'football' then
      return new;
    end if;

    idx := array_position(levels, new.player_level);
    wanted := case when idx is null then 0 else (idx - 1) * 4 + least(4, greatest(1, new.player_step)) end;

    -- Skills: distinct real football skill ids only, so duplicates or made-up ids count for nothing.
    select count(distinct d) into skill_count from unnest(new.done) d where d = any (public.football_skill_ids());

    -- The 30 m sprint (skill ft2). has_sprint: are there any ft2 results at all, possible or not.
    -- sprint: the fastest possible one, rounded to 0.01 s. Impossible times (under 3.6 s or over 15 s) are
    -- left out first, so one of them can't hide a real time; rounding before the comparisons below means
    -- 4.996 is 5.00, not faster than a 5.00 record.
    has_sprint := exists (select 1 from jsonb_array_elements(new.results) r where r ->> 'skillId' = 'ft2');
    select round(min(v), 2) into sprint from (
      select case when (r ->> 'value') ~ '^[0-9]+(\.[0-9]+)?$' then (r ->> 'value')::numeric end as v
        from jsonb_array_elements(new.results) r
       where r ->> 'skillId' = 'ft2'
    ) t where v between 3.6 and 15;

    -- "for update" so two saves at the same moment can't both take the same day's raise.
    select * into prev from public.leaderboard_scores
     where user_id = new.user_id and tree_id = new.tree_id for update;

    -- First save: skills at most 3, level step at most 1, sprint no faster than 4.5 s. Each 24-hour timer
    -- starts now when its value is above zero or set. If another save inserted the row first, nothing is
    -- inserted here and this save goes down the normal path below against that row.
    if not found then
      first_skills := least(skill_count, 3);
      first_step := least(wanted, 1);
      first_sprint := case when sprint is not null then greatest(sprint, 4.5) end;
      insert into public.leaderboard_scores
        (user_id, tree_id, skills, skills_raised_at, level_step, level_step_raised_at, best_sprint, sprint_record, sprint_improved_at)
      values (
        new.user_id, new.tree_id,
        first_skills, case when first_skills > 0 then now() end,
        first_step, case when first_step > 0 then now() end,
        first_sprint, first_sprint,
        case when first_sprint is not null then now() end
      )
      on conflict (user_id, tree_id) do nothing;
      if found then
        return new;
      end if;
      select * into prev from public.leaderboard_scores
       where user_id = new.user_id and tree_id = new.tree_id for update;
    end if;

    -- Skills: down is always allowed and leaves the timer alone; up by at most 3, once per 24 hours.
    new_skills := prev.skills;
    new_skills_raised := prev.skills_raised_at;
    if skill_count <= prev.skills then
      new_skills := skill_count;
    elsif prev.skills_raised_at is null or now() - prev.skills_raised_at >= interval '24 hours' then
      new_skills := least(skill_count, prev.skills + 3);
      new_skills_raised := now();
    end if;

    -- Level step: down is always allowed; up by 1, once per 24 hours.
    new_step := prev.level_step;
    new_raised := prev.level_step_raised_at;
    if wanted <= prev.level_step then
      new_step := wanted;
    elsif prev.level_step_raised_at is null or now() - prev.level_step_raised_at >= interval '24 hours' then
      new_step := prev.level_step + 1;
      new_raised := now();
    end if;

    -- Sprint. best_sprint is shown and ranked; sprint_record (the fastest time ever accepted) and
    -- sprint_improved_at are never cleared, so clearing results can't reset the 24-hour limit.
    new_best := prev.best_sprint;
    new_record := prev.sprint_record;
    new_improved := prev.sprint_improved_at;
    if not has_sprint then
      -- No 30 m results at all: off the sprint board, history kept.
      new_best := null;
    elsif sprint is null then
      -- Only impossible times: nothing changes.
      null;
    elsif prev.sprint_record is null then
      -- First real time: a new record, but no faster than 4.5 s.
      new_best := greatest(sprint, 4.5);
      new_record := new_best;
      new_improved := now();
    elsif sprint < prev.sprint_record
      and (prev.sprint_improved_at is null or now() - prev.sprint_improved_at >= interval '24 hours') then
      -- Faster after 24 hours: a new record, but at most 5% faster than the old one.
      new_best := greatest(sprint, round(prev.sprint_record * 0.95, 2));
      new_record := new_best;
      new_improved := now();
    elsif sprint >= prev.sprint_record then
      -- Not faster than the record: taken as it is.
      new_best := sprint;
    else
      -- Faster than the record too soon: keep the previous best, or the record if the best was cleared.
      new_best := coalesce(prev.best_sprint, prev.sprint_record);
    end if;

    update public.leaderboard_scores
       set skills = new_skills,
           skills_raised_at = new_skills_raised,
           level_step = new_step,
           level_step_raised_at = new_raised,
           best_sprint = new_best,
           sprint_record = new_record,
           sprint_improved_at = new_improved,
           updated_at = now()
     where user_id = new.user_id and tree_id = new.tree_id;
  exception when others then
    raise warning 'leaderboard score not updated: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists progress_leaderboard on public.progress;
create trigger progress_leaderboard after insert or update on public.progress
  for each row execute function public.update_leaderboard_score();

-- 4. Reports: a player can report a row. Reviewed by hand for now.
create table if not exists public.leaderboard_reports (
  id            bigint generated always as identity primary key,
  reporter_id   uuid        not null references auth.users (id) on delete cascade,
  reported_id   uuid        not null references auth.users (id) on delete cascade,
  reason        text        not null check (char_length(reason) between 1 and 300),
  created_at    timestamptz not null default now(),
  unique (reporter_id, reported_id)
);

alter table public.leaderboard_reports enable row level security;
revoke all on public.leaderboard_reports from anon, authenticated;
-- Reports are written only through report_row(). Nobody reads them from the app.
create index if not exists leaderboard_reports_reporter_idx on public.leaderboard_reports (reporter_id, created_at);

-- Each player's row key: a random id that leaderboard() returns instead of the user id, so the app can
-- report a row without ever seeing who it is. It never changes, so a report reaches the player who was on
-- the row even after a rename. Keys are made by leaderboard() the first time a player is listed.
create table if not exists public.leaderboard_keys (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  row_key  uuid not null unique default gen_random_uuid()
);

alter table public.leaderboard_keys enable row level security;
revoke all on public.leaderboard_keys from anon, authenticated;
-- No policies and no grants: only leaderboard() and report_row() read or write this table.

-- Report a row by the row key leaderboard() gave for it. At most 10 reports per player in 24 hours.
-- An unknown key, a player who has left the board, or the caller's own row is ignored without an error, so
-- keys can't be probed. One report per player and reported player; an empty reason is saved as 'unspecified'.
drop function if exists public.report_row(text, text);
create or replace function public.report_row(row_key uuid, reason text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
  why    text := left(coalesce(nullif(btrim(report_row.reason), ''), 'unspecified'), 300);
begin
  if auth.uid() is null then
    raise exception 'Sign in to report a row.' using errcode = '28000';
  end if;
  -- One report at a time per player, so two at once can't both slip under the limit.
  perform pg_advisory_xact_lock(hashtextextended('report_row:' || auth.uid()::text, 0));
  if (select count(*) from public.leaderboard_reports r
       where r.reporter_id = auth.uid() and r.created_at > now() - interval '24 hours') >= 10 then
    raise exception 'Too many reports today.';
  end if;
  select k.user_id into target
    from public.leaderboard_keys k
    join public.profiles p on p.user_id = k.user_id and p.leaderboard_opt_in
   where k.row_key = report_row.row_key;
  if target is null or target = auth.uid() then
    return;
  end if;
  insert into public.leaderboard_reports (reporter_id, reported_id, reason)
  values (auth.uid(), target, why)
  on conflict (reporter_id, reported_id) do nothing;
end;
$$;

revoke all on function public.report_row(uuid, text) from public, anon;
grant execute on function public.report_row(uuid, text) to authenticated;

-- 5. The leaderboard: the top 50 in the scope (everyone tied at rank 50 too, so a board can be a little
-- longer), plus the caller's own row. Opted-in players only; opted-out players are hidden. Never the city
-- and never the user id: each row carries its row key instead, for report_row(). Rows are in rank order,
-- then by display name in plain code-point order (collate "C"), the same as rankEntries() in TypeScript.
-- scope: global | continent | hemisphere | country. test_id: rank by one test alone (ft2, the 30 m sprint,
-- is the only one at launch); null ranks overall.
-- Not "stable": it creates missing row keys, so it has to be called with POST (the supabase-js rpc default).
-- The return columns changed (row_key), which "create or replace" can't do, so the old one is dropped first.
drop function if exists public.leaderboard(text, text, text);
create or replace function public.leaderboard(scope text, tree_id text default 'football', test_id text default null)
returns table (rank bigint, row_key uuid, display_name text, country_code text, skills integer, level_step integer, best_sprint numeric, is_me boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me         public.profiles%rowtype;
  my_cont    text;
  my_hemi    text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to see the leaderboard.' using errcode = '28000';
  end if;
  if scope not in ('global', 'continent', 'hemisphere', 'country') then
    raise exception 'Unknown scope.' using errcode = '22023';
  end if;
  if test_id is not null and test_id <> 'ft2' then
    raise exception 'Only the 30 m sprint can be ranked on its own.' using errcode = '22023';
  end if;

  select * into me from public.profiles where user_id = auth.uid();

  -- A row key for every listed player who has none yet.
  insert into public.leaderboard_keys (user_id)
  select p.user_id from public.profiles p
   where p.leaderboard_opt_in
     and not exists (select 1 from public.leaderboard_keys k where k.user_id = p.user_id)
  on conflict do nothing;

  return query
  with board as (
    select p.user_id, p.display_name, p.country_code, p.hemisphere,
           s.skills, s.level_step::integer as level_step, s.best_sprint
      from public.profiles p
      join public.leaderboard_scores s on s.user_id = p.user_id and s.tree_id = leaderboard.tree_id
     where p.leaderboard_opt_in
  ),
  scoped as (
    select b.* from board b
     where b.user_id = auth.uid()
        or case scope
             when 'global' then true
             when 'country' then me.country_code is not null and b.country_code = me.country_code
             when 'continent' then me.country_code is not null
                               and public.country_continent(b.country_code) = public.country_continent(me.country_code)
             when 'hemisphere' then public.country_hemisphere(me.country_code, me.hemisphere) is not null
                               and public.country_hemisphere(b.country_code, b.hemisphere) = public.country_hemisphere(me.country_code, me.hemisphere)
           end
  ),
  ranked as (
    select sc.user_id, sc.display_name as dn, sc.country_code as cc, sc.skills as sk, sc.level_step as ls, sc.best_sprint as bs,
           case when test_id is null
                then rank() over (order by sc.skills desc, sc.level_step desc, sc.best_sprint asc nulls last)
                else rank() over (order by sc.best_sprint asc)
           end as rk
      from scoped sc
     where test_id is null or sc.best_sprint is not null
  )
  select r.rk, k.row_key, r.dn, r.cc, r.sk, r.ls, r.bs, (r.user_id = auth.uid())
    from ranked r
    join public.leaderboard_keys k on k.user_id = r.user_id
   where r.rk <= 50 or r.user_id = auth.uid()
   order by r.rk, r.dn collate "C";
end;
$$;

revoke all on function public.leaderboard(text, text, text) from public, anon;
grant execute on function public.leaderboard(text, text, text) to authenticated;

-- 6. Country lookups for the Continent and Hemisphere scopes. These mirror src/data/countries.ts; the
-- tests check the two lists agree. Hemisphere comes from the capital; countries that cross the equator use
-- the player's own pick.
create or replace function public.country_continent(code text) returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when code = any (array['AL','AD','AT','BY','BE','BA','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IE','IT','XK','LV','LI','LT','LU','MT','MD','MC','ME','NL','MK','NO','PL','PT','RO','RU','SM','RS','SK','SI','ES','SE','CH','UA','GB','VA','AX','FO','GI','GG','IM','JE','SJ']) then 'EU'
    when code = any (array['AF','AM','AZ','BH','BD','BT','BN','KH','CN','GE','IN','ID','IR','IQ','IL','JP','JO','KZ','KW','KG','LA','LB','MY','MV','MN','MM','NP','KP','OM','PK','PS','PH','QA','SA','SG','KR','LK','SY','TW','TJ','TH','TL','TR','TM','AE','UZ','VN','YE','HK','MO']) then 'AS'
    when code = any (array['DZ','AO','BJ','BW','BF','BI','CV','CM','CF','TD','KM','CG','CD','CI','DJ','EG','GQ','ER','SZ','ET','GA','GM','GH','GN','GW','KE','LS','LR','LY','MG','MW','ML','MR','MU','MA','MZ','NA','NE','NG','RW','ST','SN','SC','SL','SO','ZA','SS','SD','TZ','TG','TN','UG','ZM','ZW','RE','YT','SH','EH']) then 'AF'
    when code = any (array['AG','BS','BB','BZ','CA','CR','CU','DM','DO','SV','GD','GT','HT','HN','JM','MX','NI','PA','KN','LC','VC','TT','US','AI','AW','BM','BQ','VG','KY','CW','GL','GP','MQ','MS','PR','BL','MF','PM','SX','TC','VI']) then 'NA'
    when code = any (array['AR','BO','BR','CL','CO','EC','GY','PY','PE','SR','UY','VE','FK','GF']) then 'SA'
    when code = any (array['AU','FJ','KI','MH','FM','NR','NZ','PW','PG','WS','SB','TO','TV','VU','AS','CX','CC','CK','PF','GU','NC','NU','NF','MP','PN','TK','WF']) then 'OC'
  end;
$$;

create or replace function public.country_hemisphere(code text, picked text) returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when code is null then null
    -- Not in the country list: unknown, as in hemisphereFor().
    when public.country_continent(code) is null then null
    -- Countries with land on both sides of the equator: the player's own pick.
    when code = any (array['ID','MV','CG','CD','GQ','GA','KE','ST','SO','UG','BR','CO','EC','KI']) then picked
    -- Capital in the south.
    when code = any (array['TL','AO','BW','BI','KM','SZ','LS','MG','MW','MU','MZ','NA','RW','SC','ZA','TZ','ZM','ZW','AR','BO','CL','PY','PE','UY','AU','FJ','NR','NZ','PG','WS','SB','TO','TV','VU','RE','YT','SH','FK','AS','CX','CC','CK','PF','NC','NU','NF','PN','TK','WF']) then 'S'
    else 'N'
  end;
$$;

revoke all on function public.country_continent(text), public.country_hemisphere(text, text) from public, anon;
grant execute on function public.country_continent(text), public.country_hemisphere(text, text) to authenticated;

-- 7. Leaving: turn the opt-in off. The row is hidden from every ranking at once; the score and its 24-hour
-- limits are kept, so opting back in shows the same score. (Deleting the account removes everything, as in
-- 002_delete_account.sql, because every table here cascades from auth.users.)

-- Only country codes from the list above can be saved, so "ZZ" is refused. Added here, after section 6,
-- because the check calls public.country_continent(). It is NOT VALID so rows saved before this check
-- don't stop the migration; such a row has to get a known code (or none) the next time it is updated.
alter table public.profiles drop constraint if exists profiles_country_code_known;
alter table public.profiles add constraint profiles_country_code_known
  check (country_code is null or public.country_continent(country_code) is not null) not valid;
