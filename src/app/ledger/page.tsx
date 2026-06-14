import { getStandings } from "@/lib/data";
import { rankFor } from "@/lib/ranks";
import LedgerSearch from "@/components/LedgerSearch";
import Link from "next/link";

export default async function LedgerPage() {
  const standings = await getStandings(100);

  return (
    <main className="wrap">
      <p><Link href="/">← Back to the war</Link></p>
      <h1 style={{ fontSize: 22, color: "var(--bone)" }}>THE PUBLIC LEDGER</h1>

      <section className="panel">
        <LedgerSearch />
      </section>

      <section style={{ marginTop: 36 }}>
        <div style={{ fontSize: 10, color: "var(--bone-dim)", letterSpacing: "0.12em", marginBottom: 10 }}>
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
                  <div style={{ color: "var(--gold)", fontSize: 10, marginTop: 4, fontFamily: "Cinzel, serif" }}>{r.title}</div>
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
