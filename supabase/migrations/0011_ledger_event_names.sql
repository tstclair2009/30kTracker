-- ============================================================================
-- 0011 — Event entries on the public ledger.
--
-- Battles reported into an event carry event_id but leave the free-text
-- `event` column null, so they never showed an event name in ledger search
-- results. Rebuild search_ledger to surface the linked event's name (falling
-- back to the free-text occasion) and to match searches against it.
--
-- Safe to run on the existing project. Run in the Supabase SQL editor.
-- ============================================================================

create or replace function public.search_ledger(
  q text,
  in_season bigint default null,
  lim int default 40
)
returns table (
  id bigint,
  handle text,
  faction text,
  side text,
  score int,
  event text,
  created_at timestamptz
) language sql stable as $$
  select b.id, p.handle, b.faction, b.side, b.score,
         coalesce(e.name, b.event) as event, b.created_at
  from public.battles b
  join public.profiles p on p.id = b.player_id
  left join public.events e on e.id = b.event_id
  where b.season_id = coalesce(in_season, (select id from public.seasons where ended_at is null limit 1))
    and (
      p.handle  ilike '%' || q || '%'
      or b.event   ilike '%' || q || '%'
      or b.faction ilike '%' || q || '%'
      or e.name    ilike '%' || q || '%'
    )
  order by b.created_at desc
  limit greatest(1, least(lim, 100));
$$;
