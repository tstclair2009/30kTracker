-- ============================================================================
-- FIX: infinite recursion in profiles RLS policies.
--
-- The original policies on `profiles` referenced `profiles` again inside their
-- USING clause (to check is_admin), which Postgres rejects as infinite
-- recursion. Every read of profiles then errored, so getCurrentProfile()
-- returned null and signed-in users appeared logged out.
--
-- Fix: check admin status via a SECURITY DEFINER function that bypasses RLS,
-- so the policy no longer reads the same table it protects. Run this in the
-- Supabase SQL editor (it is safe to run on an existing project).
-- ============================================================================

-- 1. Admin check that does NOT trigger RLS on profiles.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = uid),
    false
  );
$$;

-- 2. Replace the recursive policies on profiles.
drop policy if exists profiles_self_read on public.profiles;
drop policy if exists profiles_self_write on public.profiles;
drop policy if exists profiles_self_update on public.profiles;

-- read: your own row, OR you're an admin (checked via the SECURITY DEFINER fn)
create policy profiles_self_read on public.profiles
  for select using (
    auth.uid() = id
    or public.is_admin(auth.uid())
  );

create policy profiles_self_write on public.profiles
  for insert with check (auth.uid() = id);

create policy profiles_self_update on public.profiles
  for update using (auth.uid() = id);

-- 3. Same recursion existed wherever else we checked is_admin via a subquery
--    on profiles. Repoint those at the function too.
drop policy if exists seasons_admin_write on public.seasons;
create policy seasons_admin_write on public.seasons
  for all using (public.is_admin(auth.uid()));

drop policy if exists battles_admin_modify on public.battles;
create policy battles_admin_modify on public.battles
  for update using (public.is_admin(auth.uid()));

drop policy if exists battles_admin_delete on public.battles;
create policy battles_admin_delete on public.battles
  for delete using (public.is_admin(auth.uid()));
