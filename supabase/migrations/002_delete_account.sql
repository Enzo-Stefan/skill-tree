-- Lets a signed-in player delete their own account from inside the app.
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run. Running it twice is safe.
--
-- Deleting the auth user also deletes their progress rows (progress.user_id has on delete cascade)
-- and Supabase's own records for that user (Google identity, sessions).
--
-- The app calls it with supabase.rpc("delete_my_account"). It runs with the rights of the function's
-- owner (security definer), because players can't touch auth.users themselves. That is safe only
-- because it takes no arguments and deletes nothing but the caller's own user, found from their
-- signed-in token with auth.uid().

create or replace function public.delete_my_account() returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = me;
end;
$$;

-- Only signed-in players may call it. Supabase lets everyone (including signed-out visitors)
-- call new functions by default, so take that away first.
revoke all on function public.delete_my_account() from public, anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;
