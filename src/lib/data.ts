import { createClient } from "@/lib/supabase-server";
import { sideForFaction } from "@/lib/factions";

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
// Event-linked battles show their event's name; standalone ones keep the
// free-text occasion.
export async function getRecentBattles(limit = 20, before?: string) {
  const supabase = createClient();
  let query = supabase
    .from("battles")
    .select("id, faction, side, score, event, created_at, profiles(handle), events(name)")
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
    event: b.events?.name ?? b.event,
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

export type LeaderRow = {
  handle: string;
  vp: number;
  battles: number;
  topFaction: string | null;
  loyalistVP: number;
  traitorVP: number;
};

// Leaderboard for the open season, ranked by total VP, with optional filters.
// - No filter: uses the standings view (fast), enriched with each player's top faction.
// - faction/side filter: re-aggregates from battles so VP reflects only the
//   matching subset, then re-ranks.
export async function getLeaderboard(opts: {
  faction?: string;
  side?: "loyalist" | "traitor";
} = {}): Promise<LeaderRow[]> {
  const supabase = createClient();
  const { data: season } = await supabase
    .from("seasons").select("id").is("ended_at", null).single();
  if (!season) return [];

  const { faction, side } = opts;
  const filtered = Boolean(faction || side);

  if (!filtered) {
    // unfiltered: standings view + each player's dominant faction
    const { data: standings } = await supabase
      .from("v_player_standings")
      .select("player_id, handle, vp, battles, loyalist_vp, traitor_vp")
      .eq("season_id", season.id)
      .order("vp", { ascending: false })
      .limit(200);

    const rows = standings ?? [];
    // top faction per player (one query, then reduce)
    const ids = rows.map((r: any) => r.player_id);
    const topByPlayer: Record<string, { faction: string; vp: number }> = {};
    if (ids.length) {
      const { data: facs } = await supabase
        .from("v_player_factions")
        .select("player_id, faction, vp")
        .eq("season_id", season.id)
        .in("player_id", ids)
        .order("vp", { ascending: false });
      for (const f of facs ?? []) {
        const cur = topByPlayer[(f as any).player_id];
        if (!cur || Number((f as any).vp) > cur.vp) {
          topByPlayer[(f as any).player_id] = { faction: (f as any).faction, vp: Number((f as any).vp) };
        }
      }
    }
    return rows.map((r: any) => ({
      handle: r.handle,
      vp: Number(r.vp),
      battles: Number(r.battles),
      topFaction: topByPlayer[r.player_id]?.faction ?? null,
      loyalistVP: Number(r.loyalist_vp ?? 0),
      traitorVP: Number(r.traitor_vp ?? 0),
    }));
  }

  // filtered: aggregate battles matching the filter, per player
  let q = supabase
    .from("battles")
    .select("score, side, faction, profiles(handle)")
    .eq("season_id", season.id);
  if (faction) q = q.eq("faction", faction);
  if (side) q = q.eq("side", side);

  const { data: battles } = await q.limit(5000);

  const agg: Record<string, LeaderRow> = {};
  for (const b of battles ?? []) {
    const handle = (b as any).profiles?.handle ?? "unknown";
    const row = agg[handle] || { handle, vp: 0, battles: 0, topFaction: faction ?? null, loyalistVP: 0, traitorVP: 0 };
    const sc = Number((b as any).score);
    row.vp += sc;
    row.battles += 1;
    if ((b as any).side === "loyalist") row.loyalistVP += sc; else row.traitorVP += sc;
    if (!faction) row.topFaction = (b as any).faction; // last seen; fine for side-only filter
    agg[handle] = row;
  }
  return Object.values(agg).sort((a, b) => b.vp - a.vp);
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

  // No standing row means no battles this season. If the handle still belongs to
  // a real account, return a zero-stats profile instead of 404ing — so a brand-new
  // user (or someone who just renamed) can still view their profile.
  if (!standing) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, handle")
      .eq("handle", handle)
      .maybeSingle();
    if (!prof) return null; // truly no such handle
    return {
      standing: {
        player_id: prof.id,
        handle: prof.handle,
        vp: 0,
        battles: 0,
        loyalist_vp: 0,
        traitor_vp: 0,
      },
      factions: [],
      recent: [],
    };
  }

  const { data: factions } = await supabase
    .from("v_player_factions")
    .select("faction, vp, battles")
    .eq("season_id", season.id)
    .eq("player_id", standing.player_id)
    .order("vp", { ascending: false });

  const factionsWithSide = (factions ?? []).map((f: any) => ({
    ...f,
    side: sideForFaction(f.faction),
  }));

  const { data: recent } = await supabase
    .from("battles")
    .select("id, faction, side, score, event, created_at, events(name)")
    .eq("season_id", season.id)
    .eq("player_id", standing.player_id)
    .order("created_at", { ascending: false })
    .limit(8);

  return {
    standing,
    factions: factionsWithSide,
    recent: (recent ?? []).map((b: any) => ({ ...b, event: b.events?.name ?? b.event })),
  };
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

// ————— Warzones (monthly narrative battles) —————
export type Warzone = {
  warzone_id: number;
  name: string;
  narrative: string | null;
  sequence: number;
  status: "upcoming" | "active" | "concluded";
  starts_at: string | null;
  ends_at: string | null;
  loyalist_vp: number;
  traitor_vp: number;
  battle_count: number;
};

// All currently active fronts of the war (several may rage at once), with
// live tallies, in campaign order.
export async function getActiveWarzones(): Promise<Warzone[]> {
  const supabase = createClient();
  const { data: season } = await supabase
    .from("seasons").select("id").is("ended_at", null).single();
  if (!season) return [];
  const { data } = await supabase
    .from("v_warzone_balance")
    .select("*")
    .eq("season_id", season.id)
    .eq("status", "active")
    .order("sequence", { ascending: true });
  return (data ?? []).map((w: any) => ({
    ...w,
    loyalist_vp: Number(w.loyalist_vp),
    traitor_vp: Number(w.traitor_vp),
    battle_count: Number(w.battle_count),
  })) as Warzone[];
}

// All warzones of the open season, campaign order (the war so far).
export async function getWarzoneHistory(): Promise<Warzone[]> {
  const supabase = createClient();
  const { data: season } = await supabase
    .from("seasons").select("id").is("ended_at", null).single();
  if (!season) return [];
  const { data } = await supabase
    .from("v_warzone_balance")
    .select("*")
    .eq("season_id", season.id)
    .order("sequence", { ascending: true });
  return (data ?? []).map((w: any) => ({
    ...w,
    loyalist_vp: Number(w.loyalist_vp),
    traitor_vp: Number(w.traitor_vp),
    battle_count: Number(w.battle_count),
  })) as Warzone[];
}

// Events the given user may currently submit into: open-participation special
// events, plus events where they are an approved participant.
export async function getSubmittableEvents(userId: string | null) {
  const supabase = createClient();
  const { data: season } = await supabase
    .from("seasons").select("id").is("ended_at", null).single();
  if (!season) return [];

  const { data: openEvents } = await supabase
    .from("events")
    .select("id, name, is_special, open_participation, status")
    .eq("season_id", season.id)
    .in("status", ["open", "active"]);

  const events = openEvents ?? [];
  if (!userId) return events.filter((e: any) => e.open_participation);

  const { data: mine } = await supabase
    .from("event_participants")
    .select("event_id")
    .eq("player_id", userId)
    .eq("status", "approved");
  const approved = new Set((mine ?? []).map((m: any) => m.event_id));

  return events
    .filter((e: any) => e.open_participation || approved.has(e.id))
    .map((e: any) => ({ ...e, enrolled: approved.has(e.id) }));
}

// The player's own reports filed into events this season, newest first — the
// "submitted games" view of the events section.
export async function getMyEventBattles(userId: string | null) {
  if (!userId) return [];
  const supabase = createClient();
  const { data: season } = await supabase
    .from("seasons").select("id").is("ended_at", null).maybeSingle();
  if (!season) return [];
  const { data } = await supabase
    .from("battles")
    .select("id, faction, side, score, created_at, event_id, events(name)")
    .eq("player_id", userId)
    .eq("season_id", season.id)
    .not("event_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((b: any) => ({
    id: b.id as number,
    faction: b.faction as string,
    side: b.side as "loyalist" | "traitor",
    score: b.score as number,
    created_at: b.created_at as string,
    eventId: b.event_id as number,
    eventName: (b.events?.name ?? "Unknown event") as string,
  }));
}

// The signed-in player's own reports still inside the 15-minute withdraw
// window (mirrors the battles_self_withdraw RLS policy).
export async function getMyRecentBattles(userId: string | null) {
  if (!userId) return [];
  const supabase = createClient();
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("battles")
    .select("id, faction, side, score, event_id, created_at")
    .eq("player_id", userId)
    .gt("created_at", cutoff)
    .order("created_at", { ascending: false });
  return (data ?? []) as {
    id: number; faction: string; side: "loyalist" | "traitor";
    score: number; event_id: number | null; created_at: string;
  }[];
}

// The signed-in player's event memberships this season (any status), so the
// home page can show whether join requests were approved without the player
// having to revisit each event page.
export async function getMyEventMemberships(userId: string | null) {
  if (!userId) return [];
  const supabase = createClient();
  const { data: season } = await supabase
    .from("seasons").select("id").is("ended_at", null).maybeSingle();
  if (!season) return [];
  const { data } = await supabase
    .from("event_participants")
    .select("status, events!inner(id, name, status, season_id)")
    .eq("player_id", userId)
    .eq("events.season_id", season.id);
  return (data ?? [])
    .map((m: any) => ({
      eventId: m.events.id as number,
      name: m.events.name as string,
      eventStatus: m.events.status as string,
      myStatus: m.status as "requested" | "approved" | "rejected",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ————— Event pages —————

// Public list of this season's events (for /events discovery), enriched with
// roster size and — when a viewer is given — their own membership status.
export async function getSeasonEventsPublic(viewerId: string | null = null) {
  const supabase = createClient();
  const { data: season } = await supabase
    .from("seasons").select("id").is("ended_at", null).single();
  if (!season) return [];
  const { data } = await supabase
    .from("events")
    .select("id, name, description, status, is_special, open_participation, rolls_up, starts_at, ends_at, created_at")
    .eq("season_id", season.id)
    .order("created_at", { ascending: false });
  const events = data ?? [];
  if (events.length === 0) return [];

  const ids = events.map((e: any) => e.id);
  const [{ data: parts }, mineRes] = await Promise.all([
    supabase
      .from("event_participants")
      .select("event_id")
      .in("event_id", ids)
      .eq("status", "approved"),
    viewerId
      ? supabase
          .from("event_participants")
          .select("event_id, status")
          .in("event_id", ids)
          .eq("player_id", viewerId)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const rosterCount: Record<number, number> = {};
  for (const p of parts ?? []) rosterCount[(p as any).event_id] = (rosterCount[(p as any).event_id] ?? 0) + 1;
  const myStatus: Record<number, string> = {};
  for (const m of mineRes.data ?? []) myStatus[(m as any).event_id] = (m as any).status;

  return events.map((e: any) => ({
    ...e,
    roster_count: rosterCount[e.id] ?? 0,
    my_status: myStatus[e.id] ?? null,
  }));
}

// Full detail for one event: meta, standings, roster, and the viewer's status.
export async function getEventDetail(id: number, viewerId: string | null) {
  const supabase = createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, name, description, status, is_special, open_participation, rolls_up, organizer_id, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!event) return null;

  const [{ data: standings }, { data: parts }] = await Promise.all([
    supabase
      .from("v_event_standings")
      .select("handle, vp, battles, loyalist_vp, traitor_vp")
      .eq("event_id", id)
      .order("vp", { ascending: false }),
    supabase
      .from("event_participants")
      .select("id, player_id, status, requested_at")
      .eq("event_id", id)
      .order("requested_at", { ascending: true }),
  ]);

  // resolve participant handles via the public view
  const ids = (parts ?? []).map((p: any) => p.player_id);
  let handleById: Record<string, string> = {};
  if (ids.length) {
    const { data: profs } = await supabase
      .from("v_public_profiles")
      .select("id, handle")
      .in("id", ids);
    for (const pr of profs ?? []) handleById[(pr as any).id] = (pr as any).handle;
  }
  // organizer handle
  const { data: org } = await supabase
    .from("v_public_profiles")
    .select("handle")
    .eq("id", event.organizer_id)
    .maybeSingle();

  const roster = (parts ?? []).map((p: any) => ({
    id: p.id,
    playerId: p.player_id,
    handle: handleById[p.player_id] ?? "unknown",
    status: p.status as "requested" | "approved" | "rejected",
  }));

  const mine = viewerId ? roster.find((r) => r.playerId === viewerId) ?? null : null;

  return {
    event,
    organizerHandle: org?.handle ?? "unknown",
    isOrganizer: viewerId === event.organizer_id,
    standings: (standings ?? []).map((s: any) => ({
      handle: s.handle,
      vp: Number(s.vp),
      battles: Number(s.battles),
    })),
    roster,
    myStatus: mine?.status ?? null,
  };
}
