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
    when vp >= 10000 then 'Primarch'
    when vp >= 9000  then 'Master of the Legion'
    when vp >= 7200  then 'Praetor'
    when vp >= 5600  then 'Lord Commander'
    when vp >= 4200  then 'Captain'
    when vp >= 3000  then 'Centurion'
    when vp >= 2000  then 'Sergeant'
    when vp >= 1200  then 'Veteran'
    when vp >= 600   then 'Legionary'
    when vp >= 200   then 'Neophyte'
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

-- PROFILES: everyone can read handles (public ledger), but not emails.
-- We expose a public view without email and lock the base table down.
create or replace view public.v_public_profiles as
  select id, handle, is_admin, created_at from public.profiles;

-- a player can read their own full row (including email); admins can read all
create policy profiles_self_read on public.profiles
  for select using (
    auth.uid() = id
    or exists (select 1 from public.profiles me where me.id = auth.uid() and me.is_admin)
  );

-- a player can insert/update only their own profile
create policy profiles_self_write on public.profiles
  for insert with check (auth.uid() = id);
create policy profiles_self_update on public.profiles
  for update using (auth.uid() = id);

-- SEASONS: world-readable; only admins may create/close.
create policy seasons_read on public.seasons for select using (true);
create policy seasons_admin_write on public.seasons
  for all using (
    exists (select 1 from public.profiles me where me.id = auth.uid() and me.is_admin)
  );

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
  for update using (
    exists (select 1 from public.profiles me where me.id = auth.uid() and me.is_admin)
  );
create policy battles_admin_delete on public.battles
  for delete using (
    exists (select 1 from public.profiles me where me.id = auth.uid() and me.is_admin)
  );

-- ---------------------------------------------------------------------------
-- AUTO-PROFILE: when a new auth user appears, seed a profile row.
-- Handle defaults to a slug of their email local-part; they can change it once.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  base_handle text;
  final_handle text;
  suffix int := 0;
begin
  base_handle := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9._-]', '', 'g'));
  if length(base_handle) < 3 then base_handle := 'soldier'; end if;
  base_handle := left(base_handle, 24);
  final_handle := base_handle;
  while exists (select 1 from public.profiles where handle = final_handle) loop
    suffix := suffix + 1;
    final_handle := left(base_handle, 20) || suffix::text;
  end loop;

  insert into public.profiles (id, handle, email)
  values (new.id, final_handle, new.email);
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
