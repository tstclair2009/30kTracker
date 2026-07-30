"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function submitBattle(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const faction = String(formData.get("faction") || "").trim();
  const side = String(formData.get("side") || "");
  const score = Number(formData.get("score"));
  const event = String(formData.get("event") || "").trim().slice(0, 80);

  if (!faction) return { error: "Declare your Legion or faction." };
  if (side !== "loyalist" && side !== "traitor")
    return { error: "Declare your allegiance." };
  if (!Number.isInteger(score) || score < 0 || score > 100)
    return { error: "Victory points must be a whole number, 0–100." };

  // Make sure this user has a profile row. The FK battles.player_id -> profiles.id
  // means a missing profile makes every insert fail. The trigger should have
  // created it; this is a safety net so a trigger miss doesn't block play.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    const fallbackHandle =
      (user.email?.split("@")[0]?.toLowerCase().replace(/[^a-z0-9._-]/g, "") || "soldier").slice(0, 20) +
      user.id.replace(/-/g, "").slice(0, 4);
    const { error: profErr } = await supabase
      .from("profiles")
      .insert({ id: user.id, handle: fallbackHandle, email: user.email ?? null });
    if (profErr) {
      console.error("submitBattle: profile self-heal failed:", profErr);
      return { error: `Profile setup incomplete (${profErr.message}). Try signing out and back in.` };
    }
  }

  const { data: season } = await supabase
    .from("seasons").select("id").is("ended_at", null).maybeSingle();
  if (!season) return { error: "No active war. Ask an admin to open a season." };

  // optional event attachment (special events / approved participation);
  // RLS re-checks eligibility, this is just a friendly pre-check
  const eventRaw = String(formData.get("event_id") || "").trim();
  const eventId = eventRaw ? Number(eventRaw) : null;
  if (eventId !== null) {
    if (!Number.isInteger(eventId) || eventId <= 0)
      return { error: "Invalid event selection." };
    const { data: allowed } = await supabase.rpc("may_submit_to_event", {
      uid: user.id,
      ev: eventId,
    });
    if (!allowed)
      return { error: "You cannot report into that event — it may be closed, or you are not an approved participant." };
  }

  // every report is tagged with the active warzone (the current chapter),
  // so monthly narrative tallies accrue automatically
  const { data: wz } = await supabase.rpc("active_warzone_id");
  const warzoneId = wz ?? null;

  const { error } = await supabase.from("battles").insert({
    player_id: user.id,
    season_id: season.id,
    faction,
    side,
    score,
    event: event || null,
    event_id: eventId,
    warzone_id: warzoneId,
  });

  if (error) {
    console.error("submitBattle insert failed:", error);
    // surface the real reason instead of a generic message
    return { error: `Could not record the battle: ${error.message}` };
  }

  revalidatePath("/");
  if (eventId !== null) revalidatePath(`/event/${eventId}`);
  return { ok: true };
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/");
}
