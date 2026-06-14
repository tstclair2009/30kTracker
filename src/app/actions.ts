"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const FACTION_SIDES: Record<string, "loyalist" | "traitor"> = {};

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

  const { data: season } = await supabase
    .from("seasons").select("id").is("ended_at", null).single();
  if (!season) return { error: "No active war. Ask an admin to open a season." };

  // RLS guarantees player_id must equal auth.uid() and season must be open,
  // so even a forged request can't insert for someone else.
  const { error } = await supabase.from("battles").insert({
    player_id: user.id,
    season_id: season.id,
    faction,
    side,
    score,
    event: event || null,
  });

  if (error) return { error: "Could not record the battle. Try again." };

  revalidatePath("/");
  return { ok: true };
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/");
}
