-- ============================================================================
-- 0009 — Let players withdraw their own battle report within 15 minutes.
--
-- Mistyped scores were previously permanent (only admins could delete).
-- This adds a narrow self-service window: a player may DELETE their own
-- battle for 15 minutes after reporting it. History older than that stays
-- immutable; admins keep their existing moderation powers.
--
-- Safe to run on the existing project. Run in the Supabase SQL editor.
-- ============================================================================

drop policy if exists battles_self_withdraw on public.battles;
create policy battles_self_withdraw on public.battles
  for delete using (
    auth.uid() = player_id
    and created_at > now() - interval '15 minutes'
  );
