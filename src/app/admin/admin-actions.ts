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
