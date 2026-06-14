"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FACTIONS } from "@/lib/factions";

export default function LeaderboardFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const faction = params.get("faction") ?? "";
  const side = params.get("side") ?? "";

  function update(next: { faction?: string; side?: string }) {
    const p = new URLSearchParams(params.toString());
    if (next.faction !== undefined) {
      next.faction ? p.set("faction", next.faction) : p.delete("faction");
    }
    if (next.side !== undefined) {
      next.side ? p.set("side", next.side) : p.delete("side");
    }
    router.push(`/leaderboard?${p.toString()}`);
  }

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div style={{ flex: "1 1 200px" }}>
        <label className="label">Allegiance</label>
        <select className="input" value={side} onChange={(e) => update({ side: e.target.value })}>
          <option value="">All allegiances</option>
          <option value="loyalist">Loyalist</option>
          <option value="traitor">Traitor</option>
        </select>
      </div>
      <div style={{ flex: "1 1 200px" }}>
        <label className="label">Faction</label>
        <select className="input" value={faction} onChange={(e) => update({ faction: e.target.value })}>
          <option value="">All factions</option>
          {FACTIONS.map((f) => (
            <option key={f.name} value={f.name}>{f.name}</option>
          ))}
        </select>
      </div>
      {(faction || side) && (
        <button className="btn-ghost" onClick={() => router.push("/leaderboard")} style={{ flex: "0 0 auto" }}>
          CLEAR
        </button>
      )}
    </div>
  );
}
