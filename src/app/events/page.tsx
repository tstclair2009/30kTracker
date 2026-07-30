import { getSeasonEventsPublic, getCurrentProfile } from "@/lib/data";
import Link from "next/link";

export const dynamic = "force-dynamic";

function fmtDate(ts: string) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function EventsPage() {
  const profile = await getCurrentProfile();
  const events = await getSeasonEventsPublic(profile?.id ?? null);

  return (
    <main className="wrap">
      <p className="data" style={{ fontSize: 12 }}>
        <Link href="/">← Back to the war</Link>
      </p>
      <div className="eyebrow eyebrow-gold" style={{ marginBottom: 6 }}>SANCTIONED ENGAGEMENTS</div>
      <h1 className="display-xl" style={{ fontSize: "clamp(26px, 5vw, 38px)" }}>EVENTS</h1>

      {events.length === 0 ? (
        <p className="prose" style={{ marginTop: 16 }}>
          No events have been declared this season. When an organizer opens one, it will be listed here.
        </p>
      ) : (
        <div style={{ marginTop: 8 }}>
          {events.map((e: any) => (
            <Link key={e.id} href={`/event/${e.id}`} style={{ textDecoration: "none", display: "block" }}>
              <section className="panel" style={{ marginTop: 22, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 300px" }}>
                    <div className="eyebrow" style={{ marginBottom: 4 }}>
                      {e.is_special ? "SPECIAL EVENT" : "EVENT"}
                      {e.open_participation ? " · OPEN TO ALL" : " · ROSTER BY APPROVAL"}
                      {!e.rolls_up ? " · SELF-CONTAINED" : ""}
                    </div>
                    <div className="display" style={{ fontSize: 20, letterSpacing: "0.08em" }}>{e.name}</div>
                    {e.description && (
                      <p className="prose" style={{ marginTop: 6, marginBottom: 0 }}>{e.description}</p>
                    )}
                    <div className="data" style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8, fontSize: 10, letterSpacing: "0.14em", color: "var(--bone-dim)" }}>
                      {e.starts_at && (
                        <span>{fmtDate(e.starts_at)}{e.ends_at ? ` – ${fmtDate(e.ends_at)}` : ""}</span>
                      )}
                      {!e.open_participation && (
                        <span>{e.roster_count} ON THE ROSTER</span>
                      )}
                      {e.my_status === "approved" && (
                        <span style={{ color: "var(--gold-bright)" }}>✓ YOU'RE ON THE ROSTER</span>
                      )}
                      {e.my_status === "requested" && (
                        <span>⧗ YOUR REQUEST IS PENDING</span>
                      )}
                    </div>
                  </div>
                  <span className="data" style={{
                    fontSize: 10, letterSpacing: "0.2em", padding: "6px 10px",
                    border: "1px solid var(--panel-edge)", borderRadius: 2,
                    color: e.status === "finalized" ? "var(--neutral)" : "var(--gold-bright)",
                  }}>
                    {String(e.status).toUpperCase()}
                  </span>
                </div>
              </section>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
