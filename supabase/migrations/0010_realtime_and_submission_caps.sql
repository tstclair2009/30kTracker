-- ============================================================================
-- 0010 — Live war gauge + submission abuse guards.
--
-- 1. Realtime: add battles to the supabase_realtime publication so connected
--    clients hear about new reports and the home-page gauge moves live.
--    (battles_read is world-readable, so anon subscribers receive events.)
--
-- 2. Submission cap: the war is a narrative driver, not a grind ladder — a
--    player may file at most 10 reports per rolling 24 hours. Enforced in RLS
--    so it cannot be bypassed by calling the API directly.
--
-- Safe to run on the existing project. Run in the Supabase SQL editor.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Stream battle reports
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.battles;
exception
  when duplicate_object then null;  -- already in the publication
  when undefined_object then null;  -- publication missing (non-hosted setups)
end $$;

-- ---------------------------------------------------------------------------
-- 2. Daily report cap
-- ---------------------------------------------------------------------------
create or replace function public.battles_in_last_day(uid uuid)
returns integer
language sql security definer set search_path = public stable as $$
  select count(*)::int from public.battles
  where player_id = uid and created_at > now() - interval '24 hours';
$$;

drop policy if exists battles_self_insert on public.battles;
create policy battles_self_insert on public.battles
  for insert with check (
    auth.uid() = player_id
    and season_id = (select id from public.seasons where ended_at is null limit 1)
    and (
      event_id is null
      or public.may_submit_to_event(auth.uid(), event_id)
    )
    and public.battles_in_last_day(auth.uid()) < 10
  );
