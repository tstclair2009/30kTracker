import { getPlayerProfile } from "@/lib/data";
import { rankFor } from "@/lib/ranks";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function ProfilePage({ params }: { params: { handle: string } }) {
  const data = await getPlayerProfile(params.handle);
  if (!data) notFound();

  const { standing, factions, recent } = data;
  const vp = Number(standing.vp);
  const rank = rankFor(vp);
  const topFaction = factions[0]?.vp ?? 1;

  return (
    <main className="wrap">
      <p><Link href="/ledger">← Back to the ledger</Link></p>

      <section className="panel">
        <div style={{ fontSize: 10, color: "var(--bone-dim)", letterSpacing: "0.2em" }}>
          SERVICE RECORD · {rank.grade}
        </div>
        <div style={{ fontFamily: "Cinzel, serif", fontWeight: 700, fontSize: 26, color: "var(--bone)" }}>
          {rank.title}
        </div>
        <div style={{ fontSize: 12, color: "var(--bone-dim)" }}>{standing.handle}</div>

        {/* rank progress */}
        <div style={{ marginTop: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--bone-dim)", marginBottom: 6 }}>
            <span>{vp.toLocaleString()} VP CONTRIBUTED</span>
            <span>{rank.next ? `${rank.toNext} VP → ${rank.next.title}` : "HIGHEST HONOR ATTAINED"}</span>
          </div>
          <div style={{ height: 8, background: "var(--void)", border: "1px solid var(--panel-edge)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(rank.pct * 100).toFixed(1)}%`, background: "linear-gradient(90deg, var(--gold-deep), var(--gold))" }} />
          </div>
        </div>

        {/* stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 14, marginTop: 20 }}>
          {[
            { label: "BATTLES", value: standing.battles, color: "var(--bone)" },
            { label: "TOTAL VP", value: vp.toLocaleString(), color: "var(--bone)" },
            { label: "LOYALIST VP", value: Number(standing.loyalist_vp ?? 0).toLocaleString(), color: "var(--gold)" },
            { label: "TRAITOR VP", value: Number(standing.traitor_vp ?? 0).toLocaleString(), color: "var(--crimson)" },
          ].map((s) => (
            <div key={s.label} style={{ borderLeft: "1px solid var(--panel-edge)", paddingLeft: 12 }}>
              <div style={{ fontSize: 22, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 9, color: "var(--bone-dim)", letterSpacing: "0.12em" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* faction breakdown */}
        {factions.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <div className="label">Faction breakdown</div>
            {factions.map((f: any) => {
              const c = f.side === "traitor" ? "var(--crimson)" : "var(--gold)";
              const w = (Number(f.vp) / Number(topFaction)) * 100;
              return (
                <div key={f.faction} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7, fontSize: 11 }}>
                  <span style={{ color: "var(--bone)", minWidth: 150 }}>{f.faction}</span>
                  <div style={{ flexGrow: 1, height: 6, background: "var(--void)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${w}%`, background: c, opacity: 0.8 }} />
                  </div>
                  <span style={{ color: "var(--gold)", minWidth: 60, textAlign: "right" }}>{Number(f.vp).toLocaleString()} VP</span>
                </div>
              );
            })}
          </div>
        )}

        {/* recent battles */}
        {recent.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <div className="label">Recent battles</div>
            {recent.map((s: any) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--panel-edge)", fontSize: 11 }}>
                <span style={{ width: 7, height: 7, transform: "rotate(45deg)", background: s.side === "loyalist" ? "var(--gold)" : "var(--crimson)" }} />
                <span style={{ flexGrow: 1, color: "var(--bone)" }}>
                  {s.faction}{s.event ? <span style={{ color: "var(--bone-dim)" }}> · {s.event}</span> : null}
                </span>
                <span style={{ color: "var(--bone)" }}>+{s.score} VP</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
