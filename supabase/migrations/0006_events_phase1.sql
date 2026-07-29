-- ============================================================================
-- PHASE 1 — Monetization groundwork: events, organizers, subscribers.
--
-- Model:
--   * is_subscriber  : Stripe says this user is paying (flipped by webhook later)
--   * is_organizer   : admin-approved Tournament Organizer
--   -> creating an event requires BOTH (paid AND approved)
--   * events belong to the live season; a TO owns each event
--   * events.rolls_up : TO chooses whether the event's battles count toward the
--     global war total
--   * event_participants: a player joins an event; the TO approves them; only
--     approved participants may self-report battles into that event
--   * battles.event_id (nullable): a battle is either a standalone global-war
--     submission (null) or tied to an event
--
-- Data is never destroyed when a subscription lapses — only the *actions*
-- (create event / score) are gated. Existing events keep working & stay visible.
--
-- Safe to run on the existing project. Run in the Supabase SQL editor.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Profile flags
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_subscriber boolean not null default false,
  add column if not exists is_organizer  boolean not null default false,
  add column if not exists organizer_requested_at timestamptz;

-- helper: may this user run events right now? (paid AND approved)
create or replace function public.can_run_events(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select p.is_subscriber and p.is_organizer from public.profiles p where p.id = uid),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Events
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id          bigint generated always as identity primary key,
  season_id   bigint not null references public.seasons(id),
  organizer_id uuid not null references public.profiles(id),
  name        text not null check (length(name) between 2 and 120),
  description text,
  rolls_up    boolean not null default true,   -- count toward the global war?
  status      text not null default 'draft'    -- draft | open | active | finalized
              check (status in ('draft','open','active','finalized')),
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists events_season_idx on public.events (season_id);
create index if not exists events_organizer_idx on public.events (organizer_id);
create index if not exists events_status_idx on public.events (status);

-- ---------------------------------------------------------------------------
-- 3. Event participants (the join-and-approve roster)
-- ---------------------------------------------------------------------------
create table if not exists public.event_participants (
  id          bigint generated always as identity primary key,
  event_id    bigint not null references public.events(id) on delete cascade,
  player_id   uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'requested'  -- requested | approved | rejected
              check (status in ('requested','approved','rejected')),
  requested_at timestamptz not null default now(),
  decided_at  timestamptz,
  unique (event_id, player_id)
);
create index if not exists ep_event_idx on public.event_participants (event_id);
create index if not exists ep_player_idx on public.event_participants (player_id);

-- helper: is this user an approved participant of this event?
create or replace function public.is_event_participant(uid uuid, ev bigint)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.event_participants
    where player_id = uid and event_id = ev and status = 'approved'
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. Tie battles to events (nullable: null = standalone global-war battle)
-- ---------------------------------------------------------------------------
alter table public.battles
  add column if not exists event_id bigint references public.events(id);
create index if not exists battles_event_id_idx on public.battles (event_id);

-- ---------------------------------------------------------------------------
-- 5. Roll-up: the global war counts standalone battles PLUS event battles whose
--    event has rolls_up = true. Rebuild the balance + standings views to honor it.
-- ---------------------------------------------------------------------------

-- a battle counts toward the global war if it has no event, or its event rolls up
create or replace view public.v_global_battles as
  select b.*
  from public.battles b
  left join public.events e on e.id = b.event_id
  where b.event_id is null or e.rolls_up = true;

create or replace view public.v_war_balance as
select
  b.season_id,
  coalesce(sum(b.score) filter (where b.side = 'loyalist'), 0) as loyalist_vp,
  coalesce(sum(b.score) filter (where b.side = 'traitor'),  0) as traitor_vp,
  count(*) filter (where b.side = 'loyalist') as loyalist_battles,
  count(*) filter (where b.side = 'traitor')  as traitor_battles
from public.v_global_battles b
group by b.season_id;

create or replace view public.v_player_standings as
select
  b.season_id,
  b.player_id,
  p.handle,
  sum(b.score)                                          as vp,
  count(*)                                              as battles,
  sum(b.score) filter (where b.side = 'loyalist')       as loyalist_vp,
  sum(b.score) filter (where b.side = 'traitor')        as traitor_vp
from public.v_global_battles b
join public.profiles p on p.id = b.player_id
group by b.season_id, b.player_id, p.handle;

create or replace view public.v_player_factions as
select
  b.season_id,
  b.player_id,
  b.faction,
  sum(b.score) as vp,
  count(*)     as battles
from public.v_global_battles b
group by b.season_id, b.player_id, b.faction;

-- per-event standings (always counts the event's own battles, roll-up or not)
create or replace view public.v_event_standings as
select
  b.event_id,
  b.player_id,
  p.handle,
  sum(b.score)                                    as vp,
  count(*)                                        as battles,
  sum(b.score) filter (where b.side='loyalist')   as loyalist_vp,
  sum(b.score) filter (where b.side='traitor')    as traitor_vp
from public.battles b
join public.profiles p on p.id = b.player_id
where b.event_id is not null
group by b.event_id, b.player_id, p.handle;

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------
alter table public.events enable row level security;
alter table public.event_participants enable row level security;

-- EVENTS: world-readable (public event pages & standings)
create policy events_read on public.events for select using (true);

-- create: only a paid + approved organizer, and only for the open season,
-- and only as themselves
create policy events_create on public.events
  for insert with check (
    public.can_run_events(auth.uid())
    and organizer_id = auth.uid()
    and season_id = (select id from public.seasons where ended_at is null limit 1)
  );

-- update/score/finalize: the owning organizer (while still allowed to run events)
-- or an admin. Note: editing an EXISTING event does not require an open season,
-- so finalizing still works after a reset.
create policy events_update on public.events
  for update using (
    (organizer_id = auth.uid() and public.can_run_events(auth.uid()))
    or public.is_admin(auth.uid())
  );

create policy events_delete on public.events
  for delete using (
    (organizer_id = auth.uid() and public.can_run_events(auth.uid()))
    or public.is_admin(auth.uid())
  );

-- PARTICIPANTS: readable by all (so rosters & standings are public)
create policy ep_read on public.event_participants for select using (true);

-- a player may request to join an event for themselves
create policy ep_request on public.event_participants
  for insert with check (player_id = auth.uid() and status = 'requested');

-- the owning organizer (or admin) may approve/reject; a player may withdraw their own
create policy ep_decide on public.event_participants
  for update using (
    public.is_admin(auth.uid())
    or player_id = auth.uid()
    or exists (
      select 1 from public.events e
      where e.id = event_participants.event_id and e.organizer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 7. Extend battle-insert policy: a battle tied to an event requires the
--    submitter to be an APPROVED participant of that event. Standalone battles
--    (event_id null) keep the original rule.
-- ---------------------------------------------------------------------------
drop policy if exists battles_self_insert on public.battles;
create policy battles_self_insert on public.battles
  for insert with check (
    auth.uid() = player_id
    and season_id = (select id from public.seasons where ended_at is null limit 1)
    and (
      event_id is null
      or public.is_event_participant(auth.uid(), event_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 8. Organizer request flow (player asks; admin approves via is_organizer)
-- ---------------------------------------------------------------------------
create or replace function public.request_organizer()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
    set organizer_requested_at = now()
    where id = auth.uid();
end;
$$;
