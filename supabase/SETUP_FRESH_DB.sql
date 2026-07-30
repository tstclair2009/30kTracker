-- ============================================================================
-- THE GALACTIC WAR — COMPLETE FRESH DATABASE SETUP
--
-- Run this ONCE in the Supabase SQL Editor of a NEW (empty) project to build
-- the entire schema in one shot: core war ledger + events/monetization (Phase 1).
--
-- This consolidates migrations 0001, 0002, and 0006. (Patch migrations
-- 0003/0004/0005 are already folded into 0001 and are NOT needed for a fresh
-- database — they exist only to upgrade an older existing database.)
--
-- For an EXISTING database, do NOT run this — run the individual numbered
-- migrations you haven't applied yet instead.
-- ============================================================================


-- ========================== 0001_init.sql ==========================
-- ============================================================================
-- The Galactic War — initial schema
-- One row per battle. Aggregates are SQL, not in-browser reduces.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PROFILES
-- One row per player, linked 1:1 to a Supabase auth user.
-- The handle is the public identity; email stays private (see RLS below).
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  handle      text unique not null
              check (handle ~ '^[a-z0-9._-]{3,24}$'),
  email       text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- SEASONS
-- The live war is the season with ended_at IS NULL. "Resetting" the ledger
-- = ending the current season and opening a new one. Battles keep their
-- season_id, so history is preserved automatically — no archive blobs.
-- ---------------------------------------------------------------------------
create table if not exists public.seasons (
  id          bigint generated always as identity primary key,
  label       text not null,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);

-- exactly one open season at a time
create unique index if not exists one_open_season
  on public.seasons ((ended_at is null)) where ended_at is null;

-- ---------------------------------------------------------------------------
-- BATTLES
-- The core fact table. This is what grows to millions of rows and stays fast
-- because every query below is index-backed.
-- ---------------------------------------------------------------------------
create table if not exists public.battles (
  id          bigint generated always as identity primary key,
  player_id   uuid not null references public.profiles(id) on delete cascade,
  season_id   bigint not null references public.seasons(id),
  faction     text not null,
  side        text not null check (side in ('loyalist','traitor')),
  score       int  not null check (score >= 0 and score <= 100),
  event       text,
  created_at  timestamptz not null default now()
);

-- indexes that back the hot paths
create index if not exists battles_season_idx       on public.battles (season_id);
create index if not exists battles_player_idx        on public.battles (player_id);
create index if not exists battles_season_created_idx on public.battles (season_id, created_at desc);
create index if not exists battles_event_idx         on public.battles (season_id, event);
-- trigram index makes ILIKE '%term%' search fast on event/faction
create extension if not exists pg_trgm;
create index if not exists battles_event_trgm  on public.battles using gin (event gin_trgm_ops);
create index if not exists battles_faction_trgm on public.battles using gin (faction gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- VIEWS — the aggregates that used to be browser-side reduces
-- ---------------------------------------------------------------------------

-- Live warfront totals (loyalist vs traitor) for the open season.
create or replace view public.v_war_balance as
select
  b.season_id,
  coalesce(sum(b.score) filter (where b.side = 'loyalist'), 0) as loyalist_vp,
  coalesce(sum(b.score) filter (where b.side = 'traitor'),  0) as traitor_vp,
  count(*) filter (where b.side = 'loyalist') as loyalist_battles,
  count(*) filter (where b.side = 'traitor')  as traitor_battles
from public.battles b
group by b.season_id;

-- Per-player standings within a season: VP, battles, rank input.
create or replace view public.v_player_standings as
select
  b.season_id,
  b.player_id,
  p.handle,
  sum(b.score)                                          as vp,
  count(*)                                              as battles,
  sum(b.score) filter (where b.side = 'loyalist')       as loyalist_vp,
  sum(b.score) filter (where b.side = 'traitor')        as traitor_vp
from public.battles b
join public.profiles p on p.id = b.player_id
group by b.season_id, b.player_id, p.handle;

-- Per-player faction breakdown.
create or replace view public.v_player_factions as
select
  b.season_id,
  b.player_id,
  b.faction,
  sum(b.score) as vp,
  count(*)     as battles
from public.battles b
group by b.season_id, b.player_id, b.faction;

-- ---------------------------------------------------------------------------
-- RANK helper — mirrors the app's ladder, in SQL, so the DB can label players.
-- ---------------------------------------------------------------------------
create or replace function public.rank_title(vp bigint)
returns text language sql immutable as $$
  select case
    when vp >= 13000 then 'Primarch'
    when vp >= 9000  then 'Master of the Legion'
    when vp >= 6200  then 'Praetor'
    when vp >= 4300  then 'Lord Commander'
    when vp >= 2900  then 'Captain'
    when vp >= 1900  then 'Centurion'
    when vp >= 1200  then 'Sergeant'
    when vp >= 750   then 'Veteran'
    when vp >= 410   then 'Legionary'
    when vp >= 170   then 'Neophyte'
    else 'Aspirant'
  end;
$$;

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- This is where the honor system becomes real enforcement.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.seasons  enable row level security;
alter table public.battles  enable row level security;

-- Admin check via SECURITY DEFINER so policies on `profiles` never read
-- `profiles` again inside their own USING clause (that causes infinite
-- recursion and breaks every profile read).
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

-- PROFILES: everyone can read handles (public ledger), but not emails.
-- We expose a public view without email and lock the base table down.
create or replace view public.v_public_profiles as
  select id, handle, is_admin, created_at from public.profiles;

-- a player can read their own full row (including email); admins can read all
create policy profiles_self_read on public.profiles
  for select using (
    auth.uid() = id
    or public.is_admin(auth.uid())
  );

-- a player can insert/update only their own profile
create policy profiles_self_write on public.profiles
  for insert with check (auth.uid() = id);
create policy profiles_self_update on public.profiles
  for update using (auth.uid() = id);

-- SEASONS: world-readable; only admins may create/close.
create policy seasons_read on public.seasons for select using (true);
create policy seasons_admin_write on public.seasons
  for all using (public.is_admin(auth.uid()));

-- BATTLES: world-readable (public ledger).
create policy battles_read on public.battles for select using (true);

-- a player may insert a battle ONLY for themselves, ONLY into the open season.
create policy battles_self_insert on public.battles
  for insert with check (
    auth.uid() = player_id
    and season_id = (select id from public.seasons where ended_at is null limit 1)
  );

-- players may not edit/delete history; admins can (for moderation).
create policy battles_admin_modify on public.battles
  for update using (public.is_admin(auth.uid()));
create policy battles_admin_delete on public.battles
  for delete using (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- AUTO-PROFILE: when a new auth user appears, seed a profile row.
-- Handle defaults to a slug of their email local-part; they can change it once.
-- ---------------------------------------------------------------------------
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
  if base_handle is null or length(base_handle) < 3 then base_handle := 'soldier'; end if;
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
  raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- SEED: open the first season so the app has a live war on day one.
-- ---------------------------------------------------------------------------
insert into public.seasons (label)
select to_char(now(), 'YYYY')
where not exists (select 1 from public.seasons where ended_at is null);

-- ========================== 0002_rpcs.sql ==========================
-- ============================================================================
-- RPCs (callable functions) for admin actions and search.
-- These run server-side with SQL-level checks, so the client can't bypass them.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- RESET THE WAR: close the open season, open a fresh one. Atomic.
-- History is preserved automatically — old battles keep their season_id.
-- Admin-only, enforced inside the function.
-- ---------------------------------------------------------------------------
create or replace function public.reset_war()
returns bigint language plpgsql security definer as $$
declare
  new_year text;
  new_label text;
  n int := 2;
  new_id bigint;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;

  -- close the currently open season
  update public.seasons set ended_at = now() where ended_at is null;

  -- build a unique label for the new season
  new_year := to_char(now(), 'YYYY');
  new_label := new_year;
  while exists (select 1 from public.seasons where label = new_label) loop
    new_label := new_year || '-' || n::text;
    n := n + 1;
  end loop;

  insert into public.seasons (label) values (new_label) returning id into new_id;
  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- LEDGER SEARCH: match on handle, event, or faction within a season.
-- Trigram + btree indexes keep this fast at millions of rows.
-- Returns the newest matches, capped.
-- ---------------------------------------------------------------------------
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
  select b.id, p.handle, b.faction, b.side, b.score, b.event, b.created_at
  from public.battles b
  join public.profiles p on p.id = b.player_id
  where b.season_id = coalesce(in_season, (select id from public.seasons where ended_at is null limit 1))
    and (
      p.handle  ilike '%' || q || '%'
      or b.event   ilike '%' || q || '%'
      or b.faction ilike '%' || q || '%'
    )
  order by b.created_at desc
  limit greatest(1, least(lim, 100));
$$;

-- ---------------------------------------------------------------------------
-- ADMIN REPORT: all accounts with battle counts and VP for a season.
-- One query replaces the artifact's 10,000 sequential storage reads.
-- ---------------------------------------------------------------------------
create or replace function public.admin_accounts_report(in_season bigint default null)
returns table (
  handle text,
  email text,
  created_at timestamptz,
  battles bigint,
  vp bigint
) language sql stable security definer as $$
  select
    p.handle,
    p.email,
    p.created_at,
    count(b.id) as battles,
    coalesce(sum(b.score), 0) as vp
  from public.profiles p
  left join public.battles b
    on b.player_id = p.id
   and b.season_id = coalesce(in_season, (select id from public.seasons where ended_at is null limit 1))
  where exists (select 1 from public.profiles me where me.id = auth.uid() and me.is_admin)
  group by p.handle, p.email, p.created_at
  order by p.created_at desc;
$$;

-- ====================== 0006_events_phase1.sql ======================
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

-- ================== 0007_warzones_special_events.sql ==================
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

-- ================== 0008_event_roster_admin.sql ==================
-- ============================================================================
-- 0008 — Event roster administration
-- Lets an ADMIN (or the event's own organizer) add a player to an event
-- roster directly by handle, as an approved participant. Regular players still
-- go through request → approval; this is the GUI "add player" backdoor.
-- ============================================================================
create or replace function public.admin_add_participant(ev bigint, player_handle text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
  allowed boolean;
begin
  select public.is_admin(auth.uid())
      or exists (select 1 from public.events e where e.id = ev and e.organizer_id = auth.uid())
    into allowed;
  if not allowed then
    raise exception 'not authorized';
  end if;

  select id into pid from public.profiles
    where handle = lower(trim(player_handle));
  if pid is null then
    return 'not_found';
  end if;

  insert into public.event_participants (event_id, player_id, status, decided_at)
    values (ev, pid, 'approved', now())
    on conflict (event_id, player_id)
    do update set status = 'approved', decided_at = now();
  return 'ok';
end;
$$;
