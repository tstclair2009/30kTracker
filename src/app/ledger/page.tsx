import { getStandings } from "@/lib/data";
import { rankFor } from "@/lib/ranks";
import LedgerSearch from "@/components/LedgerSearch";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const standings = await getStandings(100);

  return (
    <main className="wrap">
      <p><Link href="/">← Back to the war</Link></p>
      <div className="eyebrow eyebrow-gold" style={{ marginBottom: 6 }}>EVERY BATTLE, ON THE RECORD</div>
      <h1 className="display-xl" style={{ fontSize: "clamp(26px, 5vw, 38px)" }}>THE PUBLIC LEDGER</h1>

      <section className="panel">
        <LedgerSearch />
      </section>

      <section style={{ marginTop: 36 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          ALL SOLDIERS · {standings.length} ON THE ROLLS · RANKED BY VP
        </div>
        {standings.length === 0 ? (
          <p style={{ color: "var(--bone-dim)", fontSize: 12 }}>No soldiers have fought yet.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10 }}>
            {standings.map((f: any, i: number) => {
              const r = rankFor(Number(f.vp));
              return (
                <Link key={f.handle} href={`/profile/${f.handle}`}
                  style={{ display: "block", background: "var(--void)", border: "1px solid var(--panel-edge)", borderRadius: 2, padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ color: "var(--bone)", fontSize: 13 }}>{f.handle}</span>
                    <span style={{ color: "var(--bone-dim)", fontSize: 10 }}>#{i + 1}</span>
                  </div>
                  <div style={{ color: "var(--gold-bright)", fontSize: 10, marginTop: 4, fontFamily: "Cinzel, serif", letterSpacing: "0.1em" }}>{r.title}</div>
                  <div style={{ color: "var(--bone-dim)", fontSize: 10, marginTop: 4 }}>
                    {Number(f.vp).toLocaleString()} VP · {f.battles} battle{Number(f.battles) === 1 ? "" : "s"}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
