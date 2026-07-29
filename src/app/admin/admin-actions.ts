"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not signed in");
  const { data } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!data?.is_admin) throw new Error("not authorized");
  return supabase;
}

export async function resetWar() {
  const supabase = await requireAdmin();
  const { error } = await supabase.rpc("reset_war"); // atomic, admin-checked in SQL too
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true };
}

export async function fetchReport() {
  const supabase = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_accounts_report");
  if (error) return { error: error.message, rows: [] };
  return { rows: data ?? [] };
}

export async function listSeasons() {
  const supabase = await requireAdmin();
  const { data } = await supabase
    .from("seasons")
    .select("id, label, started_at, ended_at")
    .order("started_at", { ascending: false });
  return data ?? [];
}

export async function viewSeasonBattles(seasonId: number) {
  const supabase = await requireAdmin();
  const { data } = await supabase
    .from("battles")
    .select("id, faction, side, score, event, created_at, profiles(handle)")
    .eq("season_id", seasonId)
    .order("created_at", { ascending: false })
    .limit(500);
  return (data ?? []).map((b: any) => ({
    id: b.id, handle: b.profiles?.handle ?? "unknown",
    faction: b.faction, side: b.side, score: b.score, event: b.event, created_at: b.created_at,
  }));
}

// ————— Warzones (monthly narrative battles) —————

// Conclude the active warzone (if any) and open the next chapter, atomically.
export async function advanceWarzone(name: string, narrative: string) {
  const supabase = await requireAdmin();
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 120)
    return { error: "Warzone name must be 2–120 characters." };
  const { data, error } = await supabase.rpc("advance_warzone", {
    next_name: trimmed,
    next_narrative: narrative.trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true, id: data as number };
}

// Conclude the active warzone without opening a new one (end of campaign arc).
export async function concludeWarzone() {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("warzones")
    .update({ status: "concluded", ends_at: new Date().toISOString() })
    .eq("status", "active");
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true };
}

// ————— Special events (admin-created, open participation) —————
export async function createSpecialEvent(input: {
  name: string;
  description: string;
  rollsUp: boolean;
  openParticipation: boolean;
}) {
  const supabase = await requireAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  const { data: season } = await supabase
    .from("seasons").select("id").is("ended_at", null).single();
  if (!season) return { error: "No open season." };

  const name = input.name.trim();
  if (name.length < 2 || name.length > 120)
    return { error: "Event name must be 2–120 characters." };

  const { error } = await supabase.from("events").insert({
    season_id: season.id,
    organizer_id: user.id,
    name,
    description: input.description.trim() || null,
    rolls_up: input.rollsUp,
    is_special: true,
    open_participation: input.openParticipation,
    status: "open",
  });
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true };
}

export async function listSeasonEvents() {
  const supabase = await requireAdmin();
  const { data: season } = await supabase
    .from("seasons").select("id").is("ended_at", null).single();
  if (!season) return [];
  const { data } = await supabase
    .from("events")
    .select("id, name, status, is_special, open_participation, rolls_up, created_at")
    .eq("season_id", season.id)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function setEventStatus(id: number, status: "open" | "active" | "finalized") {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("events").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}
