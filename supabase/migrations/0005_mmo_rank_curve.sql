-- ============================================================================
-- Update rank_title() to the MMO-scaled VP curve (Primarch caps at 13,000).
-- Run in the Supabase SQL editor to update the live database. Keeps the SQL
-- function in sync with src/lib/ranks.ts.
-- ============================================================================
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
