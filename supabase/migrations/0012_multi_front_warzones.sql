-- ============================================================================
-- 0012 — Multi-front warzones: players choose where their battle was fought.
--
-- Previously exactly one warzone could be active and every report was
-- silently tagged with it. Now the war can rage on several fronts at once:
--   * the one-active-warzone unique index is dropped
--   * open_warzone() opens an ADDITIONAL front without concluding others
--     (advance_warzone keeps its meaning: conclude every active front and
--     open the next chapter)
--   * the battle-entry form offers the active fronts and the insert policy
--     verifies the chosen warzone is an active front of the open season
--
-- Safe to run on the existing project. Run in the Supabase SQL editor.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Allow several active fronts per season
-- ---------------------------------------------------------------------------
drop index if exists public.one_active_warzone;

-- ---------------------------------------------------------------------------
-- 2. Open an additional front (does not conclude the others)
-- ---------------------------------------------------------------------------
create or replace function public.open_warzone(
  wz_name text,
  wz_narrative text default null
)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  season bigint;
  seq int;
  new_id bigint;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;
  select id into season from public.seasons where ended_at is null limit 1;
  if season is null then raise exception 'no open season'; end if;

  select coalesce(max(sequence), 0) + 1 into seq
    from public.warzones where season_id = season;

  insert into public.warzones (season_id, name, narrative, sequence, status, starts_at)
    values (season, wz_name, wz_narrative, seq, 'active', now())
    returning id into new_id;
  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Validate the chosen front on battle insert
-- ---------------------------------------------------------------------------
drop policy if exists battles_self_insert on public.battles;
create policy battles_self_insert on public.battles
  for insert with check (
    auth.uid() = player_id
    and season_id = (select id from public.seasons where ended_at is null limit 1)
    and (
      event_id is null
      or public.may_submit_to_event(auth.uid(), event_id)
    )
    and (
      warzone_id is null
      or exists (
        select 1 from public.warzones wz
        where wz.id = battles.warzone_id
          and wz.status = 'active'
          and wz.season_id = battles.season_id
      )
    )
    and public.battles_in_last_day(auth.uid()) < 10
  );
