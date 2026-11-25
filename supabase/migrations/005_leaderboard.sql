-- The ranked leaderboard (#96). Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- Players opt in (off by default), pick a display name and optionally a country and city. Ranking is done
-- here in the database, never in the browser. Rules (the same ones as src/lib/leaderboard.ts, which the
-- tests hold both to):
--   * Rank by skills finished (more is better), then level step 1 to 16 (higher), then best 30 m sprint (faster).
--   * Ties share a rank and the next rank is skipped (1, 2, 2, 4).
--   * Only opted-in players are ever returned, and only display name, country, rank and score. Never the city.
--   * Sprint times under 3.6 s or over 15 s are ignored; a best sprint can get faster once per 24 hours;
--     the level step can rise by 1 once per 24 hours.
-- Only the football tree is ranked at launch.

-- 1. Profiles: what a player tells the leaderboard about themselves. Only the owner can read or write a row.
create table if not exists public.profiles (
  user_id             uuid        primary key references auth.users (id) on delete cascade,
  display_name        text        not null check (char_length(display_name) between 3 and 20),
  country_code        text                 check (country_code ~ '^[A-Z]{2}$'),
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

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;

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
-- name; short words only as a whole word, so "grape" and "computadora" stay fine. Extend it before launch.
create or replace function public.display_name_blocked(name text) returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  folded text;
  stem text;
  word text;
begin
  -- Lower case, look-alike symbols to letters, split on spaces and punctuation.
  folded := translate(lower(name), '013457$@!', 'oieastsai');
  folded := translate(folded, 'áàäâéèëêíìïîóòöôúùüû', 'aaaaeeeeiiiioooouuuu');
  foreach stem in array array['fuck','shit','bitch','cunt','nigg','whore','hitler','mierda','pendejo','cabron'] loop
    if position(stem in regexp_replace(folded, '[^a-zñ]', '', 'g')) > 0 then
      return true;
    end if;
  end loop;
  -- Spelled out letter by letter ("p u t a") also counts as the whole word.
  if regexp_replace(folded, '[^a-zñ]', '', 'g') = any (array['fag','slut','rape','nazi','puta','puto','joder','coño','verga','pija','violar']) then
    return true;
  end if;
  foreach word in array regexp_split_to_array(folded, '[\s._-]+') loop
    if regexp_replace(word, '[^a-zñ]', '', 'g') = any (array['fag','slut','rape','nazi','puta','puto','joder','coño','verga','pija','violar']) then
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
create table if not exists public.leaderboard_scores (
  user_id                uuid        not null references auth.users (id) on delete cascade,
  tree_id                text        not null,
  skills                 integer     not null default 0 check (skills between 0 and 500),
  level_step             smallint    not null default 0 check (level_step between 0 and 16),
  best_sprint            numeric(5,2)         check (best_sprint between 3.6 and 15),
  sprint_improved_at     timestamptz,
  level_step_raised_at   timestamptz,
  updated_at             timestamptz not null default now(),
  primary key (user_id, tree_id)
);

alter table public.leaderboard_scores enable row level security;
revoke all on public.leaderboard_scores from anon, authenticated;
-- No policies and no grants: players cannot read or write this table directly. The function below reads it.

-- 3. Keep the score up to date whenever progress changes, with the cheating limits applied.
create or replace function public.update_leaderboard_score() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  levels   text[] := array['beginner', 'intermediate', 'advanced', 'expert'];
  idx      integer;
  wanted   integer;
  sprint   numeric;
  prev     public.leaderboard_scores%rowtype;
  new_step integer;
  new_raised timestamptz;
  new_best numeric;
  new_improved timestamptz;
begin
  -- Only the football tree is ranked at launch.
  if new.tree_id <> 'football' then
    return new;
  end if;

  idx := array_position(levels, new.player_level);
  wanted := case when idx is null then 0 else (idx - 1) * 4 + least(4, greatest(1, new.player_step)) end;

  -- The best 30 m sprint (skill ft2): the lowest value in results.
  -- Impossible times (under 3.6 s or over 15 s) are left out, so one of them can't hide a real time.
  select min(v) into sprint from (
    select case when (r ->> 'value') ~ '^[0-9]+(\.[0-9]+)?$' then (r ->> 'value')::numeric end as v
      from jsonb_array_elements(new.results) r
     where r ->> 'skillId' = 'ft2'
  ) t where v between 3.6 and 15;

  select * into prev from public.leaderboard_scores where user_id = new.user_id and tree_id = new.tree_id;

  if not found then
    insert into public.leaderboard_scores (user_id, tree_id, skills, level_step, best_sprint, sprint_improved_at)
    values (
      new.user_id, new.tree_id, cardinality(new.done), wanted,
      case when sprint between 3.6 and 15 then sprint end,
      case when sprint between 3.6 and 15 then now() end
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

  -- Sprint: ignore impossible times; slower or equal is taken as it is; faster only once per 24 hours.
  new_best := prev.best_sprint;
  new_improved := prev.sprint_improved_at;
  if sprint is null then
    new_best := null;
    new_improved := null;
  elsif sprint between 3.6 and 15 then
    if prev.best_sprint is null then
      new_best := sprint;
      new_improved := now();
    elsif sprint >= prev.best_sprint then
      new_best := sprint;
    elsif prev.sprint_improved_at is null or now() - prev.sprint_improved_at >= interval '24 hours' then
      new_best := sprint;
      new_improved := now();
    end if;
  end if;

  update public.leaderboard_scores
     set skills = cardinality(new.done),
         level_step = new_step,
         level_step_raised_at = new_raised,
         best_sprint = new_best,
         sprint_improved_at = new_improved,
         updated_at = now()
   where user_id = new.user_id and tree_id = new.tree_id;
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
-- scope: global | continent | hemisphere | country | local. test_id: rank by one test alone (ft2, the 30 m sprint,
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
  if scope not in ('global', 'continent', 'hemisphere', 'country', 'local') then
    raise exception 'Unknown scope.' using errcode = '22023';
  end if;
  if test_id is not null and test_id <> 'ft2' then
    raise exception 'Only the 30 m sprint can be ranked on its own.' using errcode = '22023';
  end if;

  select * into me from public.profiles where user_id = auth.uid();

  return query
  with board as (
    select p.user_id, p.display_name, p.country_code, p.city, p.hemisphere,
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
             when 'local' then me.country_code is not null and nullif(btrim(me.city), '') is not null
                               and b.country_code = me.country_code
                               and lower(btrim(regexp_replace(b.city, '\s+', ' ', 'g'))) = lower(btrim(regexp_replace(me.city, '\s+', ' ', 'g')))
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
