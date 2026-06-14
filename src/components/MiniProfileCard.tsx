import { rankFor } from "@/lib/ranks";

type Standing = {
  handle: string;
  vp: number | string;
  battles: number | string;
  loyalist_vp: number | string | null;
  traitor_vp: number | string | null;
};
type Faction = { faction: string; vp: number | string; side?: string };

// Compact service-record card shown on the home view once signed in.
// Full detail: rank + progress, VP/battle stats, and faction split.
export default function MiniProfileCard({
  standing,
  factions,
}: {
  standing: Standing;
  factions: Faction[];
}) {
  const vp = Number(standing.vp);
  const rank = rankFor(vp);
  const loyalVP = Number(standing.loyalist_vp ?? 0);
  const traitorVP = Number(standing.traitor_vp ?? 0);
  const dominant = loyalVP === traitorVP ? null : loyalVP > traitorVP ? "loyalist" : "traitor";
  const edge = dominant === "traitor" ? "var(--crimson-deep)" : "var(--gold-deep)";
  const topFaction = factions[0] ? Number(factions[0].vp) : 1;

  return (
    <section className="panel" style={{ borderColor: edge }}>
      <div style={{ fontSize: 10, color: "var(--bone-dim)", letterSpacing: "0.2em" }}>
        YOUR SERVICE RECORD · {rank.grade}
      </div>
      <div style={{ fontFamily: "Cinzel, serif", fontWeight: 700, fontSize: 24, color: "var(--bone)", lineHeight: 1.2 }}>
        {rank.title}
      </div>

      {/* rank progress */}
      <div style={{ marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--bone-dim)", marginBottom: 6 }}>
          <span>{vp.toLocaleString()} VP CONTRIBUTED</span>
          <span>{rank.next ? `${rank.toNext} VP → ${rank.next.title}` : "HIGHEST HONOR ATTAINED"}</span>
        </div>
        <div style={{ height: 8, background: "var(--void)", border: "1px solid var(--panel-edge)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(rank.pct * 100).toFixed(1)}%`, background: "linear-gradient(90deg, var(--gold-deep), var(--gold))", boxShadow: "0 0 8px rgba(212,161,74,0.5)" }} />
        </div>
      </div>

      {/* stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(96px,1fr))", gap: 12, marginTop: 18 }}>
        {[
          { label: "BATTLES", value: Number(standing.battles), color: "var(--bone)" },
          { label: "TOTAL VP", value: vp.toLocaleString(), color: "var(--bone)" },
          { label: "LOYALIST VP", value: loyalVP.toLocaleString(), color: "var(--gold)" },
          { label: "TRAITOR VP", value: traitorVP.toLocaleString(), color: "var(--crimson)" },
        ].map((s) => (
          <div key={s.label} style={{ borderLeft: "1px solid var(--panel-edge)", paddingLeft: 10 }}>
            <div style={{ fontSize: 20, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 9, color: "var(--bone-dim)", letterSpacing: "0.12em" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* faction split */}
      {factions.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="label" style={{ marginBottom: 8 }}>Faction breakdown</div>
          {factions.slice(0, 5).map((f) => {
            const c = f.side === "traitor" ? "var(--crimson)" : "var(--gold)";
            const w = topFaction > 0 ? (Number(f.vp) / topFaction) * 100 : 0;
            return (
              <div key={f.faction} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, fontSize: 11 }}>
                <span style={{ color: "var(--bone)", minWidth: 140, flexShrink: 0 }}>{f.faction}</span>
                <div style={{ flexGrow: 1, height: 6, background: "var(--void)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${w}%`, background: c, opacity: 0.8 }} />
                </div>
                <span style={{ color: c, minWidth: 56, textAlign: "right" }}>{Number(f.vp).toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
