import { getLeaderboard } from "@/lib/data";
import { rankFor } from "@/lib/ranks";
import { sideForFaction } from "@/lib/factions";
import LeaderboardFilters from "@/components/LeaderboardFilters";
import { Suspense } from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: { faction?: string; side?: string };
}) {
  const faction = searchParams.faction || undefined;
  const side = searchParams.side === "loyalist" || searchParams.side === "traitor"
    ? searchParams.side
    : undefined;

  const rows = await getLeaderboard({ faction, side });

  const filterLabel = [
    side ? side.toUpperCase() : null,
    faction ? faction.toUpperCase() : null,
  ].filter(Boolean).join(" · ");

  return (
    <main className="wrap">
      <p><Link href="/">← Back to the war</Link></p>
      <h1 style={{ fontSize: 22, color: "var(--bone)" }}>LEADERBOARD</h1>

      <section className="panel">
        <Suspense fallback={<div style={{ fontSize: 11, color: "var(--bone-dim)" }}>Loading filters…</div>}>
          <LeaderboardFilters />
        </Suspense>
      </section>

      <section style={{ marginTop: 28 }}>
        <div style={{ fontSize: 10, color: "var(--bone-dim)", letterSpacing: "0.12em", marginBottom: 12 }}>
          {rows.length} SOLDIER{rows.length === 1 ? "" : "S"} · RANKED BY VP
          {filterLabel ? ` · ${filterLabel}` : ""}
        </div>

        {rows.length === 0 ? (
          <p style={{ color: "var(--bone-dim)", fontSize: 12 }}>
            No soldiers match this filter yet.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>
              <thead>
                <tr style={{ color: "var(--bone-dim)", textAlign: "left" }}>
                  {["#", "Soldier", "Rank", "Top Faction", "Battles", "VP"].map((h, i) => (
                    <th key={h} style={{ padding: "8px 10px", borderBottom: "1px solid var(--panel-edge)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", textAlign: i >= 4 ? "right" : "left" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const rank = rankFor(r.vp);
                  const facColor = r.topFaction
                    ? (sideForFaction(r.topFaction) === "traitor" ? "var(--crimson)" : "var(--gold)")
                    : "var(--bone-dim)";
                  return (
                    <tr key={r.handle}>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--panel-edge)", color: "var(--bone-dim)" }}>{i + 1}</td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--panel-edge)" }}>
                        <Link href={`/profile/${r.handle}`} style={{ color: "var(--bone)" }}>{r.handle}</Link>
                      </td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--panel-edge)", color: "var(--gold)", fontFamily: "'Cinzel', serif", fontSize: 11 }}>{rank.title}</td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--panel-edge)", color: facColor }}>{r.topFaction ?? "—"}</td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--panel-edge)", color: "var(--bone-dim)", textAlign: "right" }}>{r.battles}</td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--panel-edge)", color: "var(--bone)", textAlign: "right" }}>{r.vp.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
