-- 006: admins can read leaderboard reports and hide a row (#104, plan/admin-page-plan.md).
--
--   * public.admins: who counts as an admin. No policies and no grants. Add the two rows by hand in the
--     SQL editor (the user ids are not in the repo):
--       insert into public.admins (user_id) values ('<enzo uuid>'), ('<stefan uuid>');
--   * Reports get a status (open, dismissed, actioned). A resolved report no longer stops the same player
--     reporting the same row again: one OPEN report per reporter and reported player.
--   * public.leaderboard_hidden: rows an admin hid. It is keyed on the account, not the profile, and players
--     have no access to it, so deleting the profile and joining again does not bring a hidden row back.
--     leaderboard() skips hidden players.
--   * Admin functions (security definer, each checks is_admin()): admin_list_reports, admin_resolve_report,
--     admin_unhide. They never return a user id: a player is addressed by the row key leaderboard() uses.
-- Run this on the live project before the app version that uses it ships, because main deploys itself.

-- 1. Admins.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 2. Report status.
alter table public.leaderboard_reports
  add column if not exists status      text        not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  add column if not exists resolved_by uuid        references auth.users (id) on delete set null,
  add column if not exists resolved_at timestamptz;

alter table public.leaderboard_reports drop constraint if exists leaderboard_reports_reporter_id_reported_id_key;
create unique index if not exists leaderboard_reports_one_open_idx
  on public.leaderboard_reports (reporter_id, reported_id) where status = 'open';
create index if not exists leaderboard_reports_status_idx on public.leaderboard_reports (status, created_at);

-- Same as 005, but one OPEN report per player and reported player.
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
  on conflict (reporter_id, reported_id) where status = 'open' do nothing;
end;
$$;

revoke all on function public.report_row(uuid, text) from public, anon;
grant execute on function public.report_row(uuid, text) to authenticated;

-- 3. Hidden rows.
create table if not exists public.leaderboard_hidden (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  hidden_by  uuid        references auth.users (id) on delete set null,
  hidden_at  timestamptz not null default now()
);
alter table public.leaderboard_hidden enable row level security;
revoke all on public.leaderboard_hidden from anon, authenticated;
-- No policies and no grants: only leaderboard() and the admin functions read or write this table.

-- The ranking, as in 005, without hidden players. Same columns, so "create or replace" works.
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
       and not exists (select 1 from public.leaderboard_hidden h where h.user_id = p.user_id)
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

-- 4. Admin functions. A non-admin gets the same error as for a function that does not exist.
create or replace function public.admin_list_reports(which text default 'open')
returns table (row_key uuid, display_name text, country_code text, hidden boolean, open_count integer, last_reported_at timestamptz, reports jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not found.' using errcode = '42883';
  end if;
  if which not in ('open', 'resolved') then
    raise exception 'Unknown list.' using errcode = '22023';
  end if;
  return query
  select k.row_key,
         coalesce(p.display_name, '(left the board)'),
         p.country_code,
         exists (select 1 from public.leaderboard_hidden h where h.user_id = r.reported_id),
         (count(*) filter (where r.status = 'open'))::integer,
         max(r.created_at),
         jsonb_agg(jsonb_build_object(
           'id', r.id, 'reason', r.reason, 'reported_at', r.created_at, 'status', r.status,
           'reporter', coalesce(rp.display_name, '(no profile)')) order by r.created_at desc)
    from public.leaderboard_reports r
    left join public.leaderboard_keys k on k.user_id = r.reported_id
    left join public.profiles p on p.user_id = r.reported_id
    left join public.profiles rp on rp.user_id = r.reporter_id
   where (which = 'open' and r.status = 'open') or (which = 'resolved' and r.status <> 'open')
   group by r.reported_id, k.row_key, p.display_name, p.country_code
   order by max(r.created_at) desc;
end;
$$;

-- action: 'dismiss' closes this report; 'hide' hides the reported player and closes all their open reports.
create or replace function public.admin_resolve_report(report_id bigint, action text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if not public.is_admin() then
    raise exception 'Not found.' using errcode = '42883';
  end if;
  if action not in ('dismiss', 'hide') then
    raise exception 'Unknown action.' using errcode = '22023';
  end if;
  select r.reported_id into target from public.leaderboard_reports r where r.id = admin_resolve_report.report_id;
  if target is null then
    raise exception 'No such report.' using errcode = 'P0002';
  end if;
  if action = 'dismiss' then
    update public.leaderboard_reports r
       set status = 'dismissed', resolved_by = auth.uid(), resolved_at = now()
     where r.id = admin_resolve_report.report_id and r.status = 'open';
  else
    insert into public.leaderboard_hidden (user_id, hidden_by) values (target, auth.uid()) on conflict do nothing;
    update public.leaderboard_reports r
       set status = 'actioned', resolved_by = auth.uid(), resolved_at = now()
     where r.reported_id = target and r.status = 'open';
  end if;
end;
$$;

-- Brings a hidden row back (the player's own opt-in still decides whether it shows). Takes the row key from
-- admin_list_reports, so it works after every report on the player is resolved.
create or replace function public.admin_unhide(row_key uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not found.' using errcode = '42883';
  end if;
  delete from public.leaderboard_hidden h
   where h.user_id = (select k.user_id from public.leaderboard_keys k where k.row_key = admin_unhide.row_key);
end;
$$;

revoke all on function public.admin_list_reports(text) from public, anon;
revoke all on function public.admin_resolve_report(bigint, text) from public, anon;
revoke all on function public.admin_unhide(uuid) from public, anon;
grant execute on function public.admin_list_reports(text) to authenticated;
grant execute on function public.admin_resolve_report(bigint, text) to authenticated;
grant execute on function public.admin_unhide(uuid) to authenticated;
