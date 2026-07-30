"use client";

import { useState } from "react";
import Link from "next/link";
import { requestJoin } from "@/app/event/[id]/event-actions";

type Membership = { eventId: number; name: string; eventStatus: string; myStatus: "requested" | "approved" | "rejected" };
type EventReport = { id: number; faction: string; side: "loyalist" | "traitor"; score: number; created_at: string; eventId: number; eventName: string };
type Joinable = { id: number; name: string; status: string; open_participation: boolean; roster_count: number };

// The events section of the war page: the player's own events with their
// submitted games, plus public events they can request to join.
export default function EventsHub({
  memberships,
  reports,
  joinable,
}: {
  memberships: Membership[];
  reports: EventReport[];
  joinable: Joinable[];
}) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [requested, setRequested] = useState<Set<number>>(new Set());
  const [err, setErr] = useState("");

  async function onJoin(id: number) {
    setBusyId(id);
    setErr("");
    const res = await requestJoin(id);
    setBusyId(null);
    if (res.error) return setErr(res.error);
    setRequested((s) => new Set(s).add(id));
  }

  const reportCount = (eventId: number) => reports.filter((r) => r.eventId === eventId).length;

  if (memberships.length === 0 && reports.length === 0 && joinable.length === 0) return null;

  return (
    <section className="panel">
      <div className="eyebrow eyebrow-gold" style={{ marginBottom: 6 }}>SANCTIONED ENGAGEMENTS</div>
      <h2 className="section-title">EVENTS</h2>

      {/* the player's events */}
      {memberships.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>YOUR EVENTS</div>
          {memberships.map((m) => {
            const c =
              m.myStatus === "approved" ? "var(--gold-bright)"
              : m.myStatus === "requested" ? "var(--bone-dim)"
              : "var(--crimson-bright)";
            const tag =
              m.myStatus === "approved" ? "✓ ON THE ROSTER"
              : m.myStatus === "requested" ? "⧗ AWAITING APPROVAL"
              : "NOT ACCEPTED";
            const n = reportCount(m.eventId);
            return (
              <Link key={m.eventId} href={`/event/${m.eventId}`}
                className="data"
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 2px", borderBottom: "1px solid var(--panel-edge-soft)", fontSize: 12, textDecoration: "none", flexWrap: "wrap" }}>
                <span style={{ color: "var(--bone)", flexGrow: 1 }}>{m.name}</span>
                {n > 0 && (
                  <span style={{ color: "var(--bone-dim)", fontSize: 10, letterSpacing: "0.12em" }}>
                    {n} GAME{n === 1 ? "" : "S"} SUBMITTED
                  </span>
                )}
                <span style={{ color: c, fontSize: 10, letterSpacing: "0.14em" }}>{tag}</span>
                <span style={{ color: "var(--neutral)", fontSize: 10 }}>{String(m.eventStatus).toUpperCase()}</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* the player's submitted event games */}
      {reports.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>YOUR SUBMITTED GAMES</div>
          {reports.slice(0, 10).map((r) => (
            <div key={r.id} className="data"
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 2px", borderBottom: "1px solid var(--panel-edge-soft)", fontSize: 12 }}>
              <span className="side-dot" style={{ background: r.side === "loyalist" ? "var(--gold)" : "var(--crimson)" }} />
              <Link href={`/event/${r.eventId}`} style={{ color: "var(--bone-dim)", fontSize: 11, minWidth: 120 }}>
                {r.eventName}
              </Link>
              <span style={{ flexGrow: 1, color: "var(--bone)" }}>{r.faction}</span>
              <span style={{ color: r.side === "loyalist" ? "var(--gold-bright)" : "var(--crimson-bright)" }}>+{r.score} VP</span>
              <span style={{ color: "var(--neutral)", fontSize: 10, minWidth: 74, textAlign: "right" }}>
                {new Date(r.created_at).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* public events open to request */}
      {joinable.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>OPEN FOR ENLISTMENT</div>
          {joinable.map((e) => (
            <div key={e.id} className="data"
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 2px", borderBottom: "1px solid var(--panel-edge-soft)", fontSize: 12, flexWrap: "wrap" }}>
              <Link href={`/event/${e.id}`} style={{ color: "var(--bone)", flexGrow: 1 }}>{e.name}</Link>
              {e.open_participation ? (
                <span style={{ color: "var(--gold-bright)", fontSize: 10, letterSpacing: "0.14em" }}>
                  OPEN TO ALL — REPORT ANY TIME
                </span>
              ) : requested.has(e.id) ? (
                <span style={{ color: "var(--bone-dim)", fontSize: 10, letterSpacing: "0.14em" }}>⧗ REQUEST SENT</span>
              ) : (
                <>
                  {e.roster_count > 0 && (
                    <span style={{ color: "var(--neutral)", fontSize: 10 }}>{e.roster_count} ON THE ROSTER</span>
                  )}
                  <button className="btn-ghost" style={{ fontSize: 9 }} disabled={busyId === e.id} onClick={() => onJoin(e.id)}>
                    {busyId === e.id ? "…" : "REQUEST TO JOIN"}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {err && <p className="data" style={{ color: "var(--crimson-bright)", fontSize: 12, marginTop: 12 }}>⚠ {err}</p>}

      <p className="data" style={{ fontSize: 11, marginTop: 16, marginBottom: 0 }}>
        <Link href="/events">Browse all events →</Link>
      </p>
    </section>
  );
}
