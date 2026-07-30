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
