-- The ranked leaderboard (#96). Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- Players opt in (off by default), pick a display name and optionally a country. Scopes at launch: global,
-- continent, hemisphere, country (no city board: it would show who lives in a given city). Ranking is done
-- here in the database, never in the browser. Rules (the same ones as src/lib/leaderboard.ts, which the
-- tests hold both to):
--   * Rank by skills finished (more is better), then level step 1 to 16 (higher), then best 30 m sprint (faster).
--   * Ties share a rank and the next rank is skipped (1, 2, 2, 4).
--   * Only opted-in players are ever returned, and only display name, country, rank and score. Never the city.
--   * Skills count only distinct, real football skill ids, so duplicates or made-up ids add nothing.
--   * Sprint times under 3.6 s or over 15 s are ignored; a best sprint can get faster once per 24 hours;
--     the level step can rise by 1 once per 24 hours. A player's first save is taken as it is but starts
--     both 24-hour timers, and clearing the sprint results does not reset the sprint timer.
--   * A scoring error is logged as a warning and never blocks the player's progress save.
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

-- One display name per player, ignoring case.
create unique index if not exists profiles_display_name_key on public.profiles (lower(display_name));
create index if not exists profiles_country_idx on public.profiles (country_code) where leaderboard_opt_in;

-- Names: letters, digits, spaces, dots, dashes and underscores. No "@", so no email addresses.
alter table public.profiles drop constraint if exists profiles_display_name_chars;
alter table public.profiles add constraint profiles_display_name_chars
  check (display_name ~ '^[[:alnum:]][[:alnum:] ._-]*$');

-- One alphabet per name: Latin, Cyrillic and Greek letters can't be mixed, so "fuсk" with a Cyrillic "с"
-- is refused. Names written wholly in Cyrillic or Greek are fine. The ranges are written as literal
-- characters: Latin A-Z a-z U+00C0-U+024F, Cyrillic U+0400-U+04FF, Greek U+0370-U+03FF.
alter table public.profiles drop constraint if exists profiles_display_name_one_script;
alter table public.profiles add constraint profiles_display_name_one_script
  check ((display_name ~ '[A-Za-zÀ-ɏ]')::int
       + (display_name ~ '[Ѐ-ӿ]')::int
       + (display_name ~ '[Ͱ-Ͽ]')::int <= 1);

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

-- A short English and Spanish blocklist, a first line of defence. Strong stems are blocked anywhere in the
-- name; short words only as a whole word, so "grape" and "computadora" stay fine. Known innocent words
-- that hold a stem ("Scunthorpe", "snigger", "Yamashita") are taken out before the stem check. Cyrillic
-- and Greek look-alikes ("ѕһіт") are turned into Latin letters first. Extend it before launch.
-- These lists are the same as in src/lib/leaderboard.ts; the tests check they agree.
create or replace function public.display_name_blocked(name text) returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  blocked_stems  text[] := array['fuck','shit','bitch','cunt','nigg','whore','hitler','mierda','pendejo','cabron','faggot'];
  blocked_words  text[] := array['fag','slut','rape','nazi','puta','puto','joder','coño','verga','pija','violar'];
  allowed_words  text[] := array['scunthorpe','snigger','sniggle','niggle','niggling','niggard','shitake','yamashita','matsushita','kinoshita','morishita','mishit','pushit'];
  -- Upper case look-alikes are listed too, so this works even where lower() only knows ASCII.
  homoglyph_from text   := 'авеёіїјкмнорстухѕһӏАВЕЁІЇЈКМНОРСТУХЅҺӀαβεηικνορτυχάέήίόύΑΒΕΗΙΚΝΟΡΤΥΧΆΈΉΊΌΎζΖ';
  homoglyph_to   text   := 'abeeiijkmhopctyxshlabeeiijkmhopctyxshlabenikvoptuxaeniouabehiknoptyxaehioyzz';
  lookalike_from text   := '013457$@!';
  lookalike_to   text   := 'oieastsai';
  folded text;
  joined text;
  stem text;
  word text;
  allowed text;
begin
  -- Look-alike letters to Latin before and after lower case (so capital Greek Ν reads as n, not ν), then
  -- symbols to letters, accents off.
  folded := translate(lower(translate(name, homoglyph_from, homoglyph_to)), homoglyph_from, homoglyph_to);
  folded := translate(folded, lookalike_from, lookalike_to);
  folded := translate(folded, 'áàäâéèëêíìïîóòöôúùüû', 'aaaaeeeeiiiioooouuuu');
  joined := regexp_replace(folded, '[^a-zñ]', '', 'g');
  foreach allowed in array allowed_words loop
    joined := replace(joined, allowed, '');
  end loop;
  foreach stem in array blocked_stems loop
    if position(stem in joined) > 0 then
      return true;
    end if;
  end loop;
  -- Spelled out letter by letter ("p u t a") also counts as the whole word.
  if regexp_replace(folded, '[^a-zñ]', '', 'g') = any (blocked_words) then
    return true;
  end if;
  foreach word in array regexp_split_to_array(folded, '[\s._-]+') loop
    if regexp_replace(word, '[^a-zñ]', '', 'g') = any (blocked_words) then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

create or replace function public.check_display_name() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.display_name_blocked(new.display_name) then
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
-- once-per-24-hours limit on getting faster.
create table if not exists public.leaderboard_scores (
  user_id                uuid        not null references auth.users (id) on delete cascade,
  tree_id                text        not null,
  skills                 integer     not null default 0,
  level_step             smallint    not null default 0 check (level_step between 0 and 16),
  best_sprint            numeric(5,2)         check (best_sprint between 3.6 and 15),
  sprint_record          numeric(5,2)         check (sprint_record between 3.6 and 15),
  sprint_improved_at     timestamptz,
  level_step_raised_at   timestamptz,
  updated_at             timestamptz not null default now(),
  primary key (user_id, tree_id)
);

-- For a database that already ran an earlier version of this file: add the record and recount skills.
alter table public.leaderboard_scores
  add column if not exists sprint_record numeric(5,2) check (sprint_record between 3.6 and 15);
update public.leaderboard_scores set sprint_record = best_sprint where sprint_record is null and best_sprint is not null;
update public.leaderboard_scores s
   set skills = (select count(distinct d) from unnest(p.done) d where d = any (public.football_skill_ids()))
  from public.progress p
 where p.user_id = s.user_id and p.tree_id = s.tree_id and s.tree_id = 'football';

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
    -- sprint: the fastest possible one. Impossible times (under 3.6 s or over 15 s) are left out, so one of
    -- them can't hide a real time.
    has_sprint := exists (select 1 from jsonb_array_elements(new.results) r where r ->> 'skillId' = 'ft2');
    select min(v) into sprint from (
      select case when (r ->> 'value') ~ '^[0-9]+(\.[0-9]+)?$' then (r ->> 'value')::numeric end as v
        from jsonb_array_elements(new.results) r
       where r ->> 'skillId' = 'ft2'
    ) t where v between 3.6 and 15;

    select * into prev from public.leaderboard_scores where user_id = new.user_id and tree_id = new.tree_id;

    -- First save: taken as it is, but both 24-hour timers start now.
    if not found then
      insert into public.leaderboard_scores
        (user_id, tree_id, skills, level_step, level_step_raised_at, best_sprint, sprint_record, sprint_improved_at)
      values (
        new.user_id, new.tree_id, skill_count, wanted,
        case when wanted > 0 then now() end,
        sprint, sprint,
        case when sprint is not null then now() end
      );
      return new;
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
    elsif prev.sprint_record is null
       or (sprint < prev.sprint_record
           and (prev.sprint_improved_at is null or now() - prev.sprint_improved_at >= interval '24 hours')) then
      -- First real time, or a faster one after 24 hours: a new record.
      new_best := sprint;
      new_record := sprint;
      new_improved := now();
    elsif sprint >= prev.sprint_record then
      -- Not faster than the record: taken as it is.
      new_best := sprint;
    else
      -- Faster than the record too soon: keep the previous best, or the record if the best was cleared.
      new_best := coalesce(prev.best_sprint, prev.sprint_record);
    end if;

    update public.leaderboard_scores
       set skills = skill_count,
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

-- Players only ever see the leaderboard through this function, which holds the row ids back: it takes a
-- "rank key" instead of a user id. To report a row, the app passes the display name.
create or replace function public.report_row(reported_name text, reason text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to report a row.' using errcode = '28000';
  end if;
  select p.user_id into target from public.profiles p
   where lower(p.display_name) = lower(reported_name) and p.leaderboard_opt_in;
  if target is null or target = auth.uid() then
    return;
  end if;
  insert into public.leaderboard_reports (reporter_id, reported_id, reason)
  values (auth.uid(), target, left(reason, 300))
  on conflict (reporter_id, reported_id) do nothing;
end;
$$;

revoke all on function public.report_row(text, text) from public, anon;
grant execute on function public.report_row(text, text) to authenticated;

-- 5. The leaderboard: top 50 in the scope, plus the caller's own row. Opted-in players only. Never the city.
-- scope: global | continent | hemisphere | country. test_id: rank by one test alone (ft2, the 30 m sprint,
-- is the only one at launch); null ranks overall.
create or replace function public.leaderboard(scope text, tree_id text default 'football', test_id text default null)
returns table (rank bigint, display_name text, country_code text, skills integer, level_step integer, best_sprint numeric, is_me boolean)
language plpgsql
stable
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
  select r.rk, r.dn, r.cc, r.sk, r.ls, r.bs, (r.user_id = auth.uid())
    from ranked r
   where r.rk <= 50 or r.user_id = auth.uid()
   order by r.rk, r.dn;
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
    when code = any (array['AL','AD','AT','BY','BE','BA','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IE','IT','XK','LV','LI','LT','LU','MT','MD','MC','ME','NL','MK','NO','PL','PT','RO','RU','SM','RS','SK','SI','ES','SE','CH','UA','GB','VA']) then 'EU'
    when code = any (array['AF','AM','AZ','BH','BD','BT','BN','KH','CN','GE','IN','ID','IR','IQ','IL','JP','JO','KZ','KW','KG','LA','LB','MY','MV','MN','MM','NP','KP','OM','PK','PS','PH','QA','SA','SG','KR','LK','SY','TW','TJ','TH','TL','TR','TM','AE','UZ','VN','YE']) then 'AS'
    when code = any (array['DZ','AO','BJ','BW','BF','BI','CV','CM','CF','TD','KM','CG','CD','CI','DJ','EG','GQ','ER','SZ','ET','GA','GM','GH','GN','GW','KE','LS','LR','LY','MG','MW','ML','MR','MU','MA','MZ','NA','NE','NG','RW','ST','SN','SC','SL','SO','ZA','SS','SD','TZ','TG','TN','UG','ZM','ZW']) then 'AF'
    when code = any (array['AG','BS','BB','BZ','CA','CR','CU','DM','DO','SV','GD','GT','HT','HN','JM','MX','NI','PA','KN','LC','VC','TT','US']) then 'NA'
    when code = any (array['AR','BO','BR','CL','CO','EC','GY','PY','PE','SR','UY','VE']) then 'SA'
    when code = any (array['AU','FJ','KI','MH','FM','NR','NZ','PW','PG','WS','SB','TO','TV','VU']) then 'OC'
  end;
$$;

create or replace function public.country_hemisphere(code text, picked text) returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when code is null then null
    -- Countries with land on both sides of the equator: the player's own pick.
    when code = any (array['ID','MV','CG','CD','GQ','GA','KE','ST','SO','UG','BR','CO','EC','KI','NR']) then picked
    -- Capital in the south.
    when code = any (array['TL','AO','BW','BI','KM','SZ','LS','MG','MW','MU','MZ','NA','RW','SC','ZA','TZ','ZM','ZW','AR','BO','CL','PY','PE','UY','AU','FJ','NZ','PG','WS','SB','TO','TV','VU']) then 'S'
    else 'N'
  end;
$$;

revoke all on function public.country_continent(text), public.country_hemisphere(text, text) from public, anon;
grant execute on function public.country_continent(text), public.country_hemisphere(text, text) to authenticated;

-- 7. Leaving: turn the opt-in off. The row disappears from every ranking at once. (Deleting the account removes
-- everything, as in 002_delete_account.sql, because every table here cascades from auth.users.)
