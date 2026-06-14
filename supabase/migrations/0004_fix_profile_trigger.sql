-- ============================================================================
-- FIX: new users not getting a profiles row (which also blocks battle inserts,
-- since battles.player_id references profiles.id).
--
-- Causes addressed:
--   1. SECURITY DEFINER function without a fixed search_path can fail to
--      resolve public.profiles when fired from the auth schema.
--   2. Trigger may not have installed on auth.users at all.
--   3. Existing users who signed up before this fix have NO profile row.
--
-- Safe to run on an existing project. Run in the Supabase SQL editor.
-- ============================================================================

-- 1. Recreate the function, hardened: explicit search_path, exception-safe so a
--    failure here can never block the signup itself.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_handle text;
  final_handle text;
  suffix int := 0;
begin
  base_handle := lower(regexp_replace(split_part(coalesce(new.email, ''), '@', 1), '[^a-z0-9._-]', '', 'g'));
  if base_handle is null or length(base_handle) < 3 then
    base_handle := 'soldier';
  end if;
  base_handle := left(base_handle, 24);
  final_handle := base_handle;

  while exists (select 1 from public.profiles where handle = final_handle) loop
    suffix := suffix + 1;
    final_handle := left(base_handle, 20) || suffix::text;
  end loop;

  insert into public.profiles (id, handle, email)
  values (new.id, final_handle, new.email)
  on conflict (id) do nothing;

  return new;
exception when others then
  -- never let a profile-seed error block auth signup; log and continue
  raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  return new;
end;
$$;

-- 2. Reinstall the trigger.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. BACKFILL: create profile rows for any existing auth users that lack one.
--    This is what unblocks accounts that already signed up (and lets them
--    submit battles, since the FK target will finally exist).
insert into public.profiles (id, handle, email)
select
  u.id,
  -- generate a unique handle per user; fall back to a uuid fragment on collision
  case
    when not exists (
      select 1 from public.profiles p
      where p.handle = left(lower(regexp_replace(split_part(coalesce(u.email,''), '@', 1), '[^a-z0-9._-]', '', 'g')), 24)
    )
    and length(lower(regexp_replace(split_part(coalesce(u.email,''), '@', 1), '[^a-z0-9._-]', '', 'g'))) >= 3
    then left(lower(regexp_replace(split_part(coalesce(u.email,''), '@', 1), '[^a-z0-9._-]', '', 'g')), 24)
    else 'soldier-' || left(replace(u.id::text, '-', ''), 8)
  end,
  u.email
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;
