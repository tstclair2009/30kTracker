import { createClient } from "@/lib/supabase-server";

export type Battle = {
  id: number;
  handle: string;
  faction: string;
  side: "loyalist" | "traitor";
  score: number;
  event: string | null;
  created_at: string;
};

// Live warfront totals for the open season.
export async function getWarBalance() {
  const supabase = createClient();
  const { data: season } = await supabase
    .from("seasons")
    .select("id, label")
    .is("ended_at", null)
    .single();

  if (!season) return { loyalist_vp: 0, traitor_vp: 0, season: null };

  const { data } = await supabase
    .from("v_war_balance")
    .select("loyalist_vp, traitor_vp, loyalist_battles, traitor_battles")
    .eq("season_id", season.id)
    .maybeSingle();

  return {
    season,
    loyalist_vp: data?.loyalist_vp ?? 0,
    traitor_vp: data?.traitor_vp ?? 0,
    loyalist_battles: data?.loyalist_battles ?? 0,
    traitor_battles: data?.traitor_battles ?? 0,
  };
}

// Most recent battles (the "dispatches" feed). Paginated — never loads all.
export async function getRecentBattles(limit = 20, before?: string) {
  const supabase = createClient();
  let query = supabase
    .from("battles")
    .select("id, faction, side, score, event, created_at, profiles(handle)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) query = query.lt("created_at", before);
  const { data } = await query;
  return (data ?? []).map((b: any) => ({
    id: b.id,
    handle: b.profiles?.handle ?? "unknown",
    faction: b.faction,
    side: b.side,
    score: b.score,
    event: b.event,
    created_at: b.created_at,
  })) as Battle[];
}

// Browsable roster for the open season, ranked by VP. Paginated.
export async function getStandings(limit = 50, offset = 0) {
  const supabase = createClient();
  const { data: season } = await supabase
    .from("seasons").select("id").is("ended_at", null).single();
  if (!season) return [];
  const { data } = await supabase
    .from("v_player_standings")
    .select("handle, vp, battles, loyalist_vp, traitor_vp")
    .eq("season_id", season.id)
    .order("vp", { ascending: false })
    .range(offset, offset + limit - 1);
  return data ?? [];
}

// A single player's full profile within the open season.
export async function getPlayerProfile(handle: string) {
  const supabase = createClient();
  const { data: season } = await supabase
    .from("seasons").select("id").is("ended_at", null).single();
  if (!season) return null;

  const { data: standing } = await supabase
    .from("v_player_standings")
    .select("player_id, handle, vp, battles, loyalist_vp, traitor_vp")
    .eq("season_id", season.id)
    .eq("handle", handle)
    .maybeSingle();
  if (!standing) return null;

  const { data: factions } = await supabase
    .from("v_player_factions")
    .select("faction, vp, battles")
    .eq("season_id", season.id)
    .eq("player_id", standing.player_id)
    .order("vp", { ascending: false });

  const { data: recent } = await supabase
    .from("battles")
    .select("id, faction, side, score, event, created_at")
    .eq("season_id", season.id)
    .eq("player_id", standing.player_id)
    .order("created_at", { ascending: false })
    .limit(8);

  return { standing, factions: factions ?? [], recent: recent ?? [] };
}

// Search the ledger (handle / event / faction) via the SQL RPC.
export async function searchLedger(q: string) {
  const supabase = createClient();
  const { data } = await supabase.rpc("search_ledger", { q });
  return (data ?? []) as Battle[];
}

// Is the current user signed in, and what's their profile?
// Falls back to session-derived data if the profile row isn't readable yet,
// so a transient profile-read issue never makes a signed-in user look logged out.
export async function getCurrentProfile() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, handle, email, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (data) return data;

  // Signed in but no readable profile row. Surface it in logs, but keep the
  // user logged in using what we know from the session.
  if (error) console.error("getCurrentProfile: profile read failed:", error.message);
  return {
    id: user.id,
    handle: (user.email?.split("@")[0] ?? "soldier").toLowerCase(),
    email: user.email ?? null,
    is_admin: false,
  };
}
