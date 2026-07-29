-- ============================================================================
-- 0007 — WARZONES (monthly narrative battles) + ADMIN SPECIAL EVENTS
--
-- Warzones: the war advances world by world. One warzone is active at a time
-- (a ~1 month narrative chapter, e.g. "The Battle for Isstvan III"). Every
-- game report is auto-tagged with the active warzone. When the admin concludes
-- it, the tallies freeze into history and the war moves to the next world.
--
-- Special events: admin-created events with open participation — any signed-in
-- player may report scores into them, no join-approval needed. Reuses the
-- Phase-1 events table. Admins may create events without the subscriber gate.
--
-- Safe to run on an existing database (staging or, later, production).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Warzones
-- ---------------------------------------------------------------------------
create table if not exists public.warzones (
  id          bigint generated always as identity primary key,
  season_id   bigint not null references public.seasons(id),
  name        text not null check (length(name) between 2 and 120),  -- world/system
  narrative   text,                                                   -- the story of this chapter
  sequence    int not null default 1,                                 -- order within the season
  status      text not null default 'upcoming'
              check (status in ('upcoming','active','concluded')),
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists warzones_season_idx on public.warzones (season_id, sequence);

-- at most one ACTIVE warzone per season
create unique index if not exists one_active_warzone
  on public.warzones (season_id) where status = 'active';

-- tag game reports with their warzone
alter table public.battles
  add column if not exists warzone_id bigint references public.warzones(id);
create index if not exists battles_warzone_idx on public.battles (warzone_id);

-- helper: the currently active warzone of the open season
create or replace function public.active_warzone_id()
returns bigint
language sql stable
as $$
  select wz.id from public.warzones wz
  join public.seasons s on s.id = wz.season_id and s.ended_at is null
  where wz.status = 'active'
  limit 1;
$$;

-- per-warzone tallies (works for active and concluded alike)
create or replace view public.v_warzone_balance as
select
  wz.id as warzone_id,
  wz.season_id,
  wz.name,
  wz.narrative,
  wz.sequence,
  wz.status,
  wz.starts_at,
  wz.ends_at,
  coalesce(sum(b.score) filter (where b.side = 'loyalist'), 0) as loyalist_vp,
  coalesce(sum(b.score) filter (where b.side = 'traitor'),  0) as traitor_vp,
  count(b.id) as battle_count
from public.warzones wz
left join public.battles b on b.warzone_id = wz.id
group by wz.id;

-- RLS: world-readable; admin-managed
alter table public.warzones enable row level security;
create policy warzones_read on public.warzones for select using (true);
create policy warzones_admin_all on public.warzones
  for all using (public.is_admin(auth.uid()));

-- Admin RPC: conclude the active warzone (if any) and activate the next chapter.
-- Creates the next warzone in one atomic step.
create or replace function public.advance_warzone(
  next_name text,
  next_narrative text default null
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

  update public.warzones
    set status = 'concluded', ends_at = now()
    where season_id = season and status = 'active';

  select coalesce(max(sequence), 0) + 1 into seq
    from public.warzones where season_id = season;

  insert into public.warzones (season_id, name, narrative, sequence, status, starts_at)
    values (season, next_name, next_narrative, seq, 'active', now())
    returning id into new_id;
  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Special events (admin-created, open participation)
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists is_special boolean not null default false,
  add column if not exists open_participation boolean not null default false;

-- admins may create events too (bypassing the subscriber+organizer gate)
drop policy if exists events_create on public.events;
create policy events_create on public.events
  for insert with check (
    (
      public.can_run_events(auth.uid())
      or public.is_admin(auth.uid())
    )
    and organizer_id = auth.uid()
    and season_id = (select id from public.seasons where ended_at is null limit 1)
  );

-- open-participation helper: may this user submit into this event?
create or replace function public.may_submit_to_event(uid uuid, ev bigint)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.events e
    where e.id = ev
      and e.status in ('open','active')
      and (
        e.open_participation
        or exists (
          select 1 from public.event_participants ep
          where ep.event_id = ev and ep.player_id = uid and ep.status = 'approved'
        )
      )
  );
$$;

-- battle insert: standalone OR (event allowed for this user). Also stamps must
-- match season; warzone tagging is done by the app at insert time.
drop policy if exists battles_self_insert on public.battles;
create policy battles_self_insert on public.battles
  for insert with check (
    auth.uid() = player_id
    and season_id = (select id from public.seasons where ended_at is null limit 1)
    and (
      event_id is null
      or public.may_submit_to_event(auth.uid(), event_id)
    )
  );
