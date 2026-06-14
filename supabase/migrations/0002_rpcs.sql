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
