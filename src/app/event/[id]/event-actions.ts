"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

// Player requests to join an event (RLS: self-insert, status 'requested').
export async function requestJoin(eventId: number) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to request a place." };
  const { error } = await supabase.from("event_participants").insert({
    event_id: eventId, player_id: user.id, status: "requested",
  });
  if (error) {
    if ((error as any).code === "23505") return { error: "You've already requested to join." };
    return { error: "Could not send the request. Try again." };
  }
  revalidatePath(`/event/${eventId}`);
  revalidatePath("/"); // the home events hub shows membership status too
  return { ok: true };
}

// Organizer/admin decides a pending request (RLS: ep_decide).
export async function decideParticipant(participantId: number, eventId: number, approve: boolean) {
  const supabase = createClient();
  const { error } = await supabase
    .from("event_participants")
    .update({ status: approve ? "approved" : "rejected", decided_at: new Date().toISOString() })
    .eq("id", participantId);
  if (error) return { error: "Could not update that request." };
  revalidatePath(`/event/${eventId}`);
  return { ok: true };
}

// Admin/organizer adds a player directly by handle (SQL RPC enforces authority).
export async function adminAddPlayer(eventId: number, handle: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("admin_add_participant", {
    ev: eventId, player_handle: handle,
  });
  if (error) return { error: error.message.includes("not authorized") ? "Not authorized." : "Could not add that player." };
  if (data === "not_found") return { error: `No soldier with the handle “${handle.trim().toLowerCase()}” is on the rolls.` };
  revalidatePath(`/event/${eventId}`);
  return { ok: true };
}
