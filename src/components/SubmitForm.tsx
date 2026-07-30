"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { submitBattle } from "@/app/actions";
import { FACTIONS, sideForFaction } from "@/lib/factions";

const LAST_FACTION_KEY = "gw:lastFaction";

export default function SubmitForm({
  events = [],
  fixedEvent,
}: {
  events?: { id: number; name: string }[];
  // When set, every battle from this form reports into that event: the event
  // is locked (hidden input) instead of offered as a dropdown choice.
  fixedEvent?: { id: number; name: string };
}) {
  const [faction, setFaction] = useState("");
  const [side, setSide] = useState("");
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // set after a successful event report so we can offer a standings link
  const [reportedEventId, setReportedEventId] = useState<number | null>(null);

  // most players field the same army every game — start from their last choice
  useEffect(() => {
    const last = localStorage.getItem(LAST_FACTION_KEY);
    if (last && FACTIONS.some((f) => f.name === last)) {
      setFaction(last);
      setSide(sideForFaction(last));
    }
  }, []);

  function onFactionChange(name: string) {
    setFaction(name);
    // allegiance follows the faction's canonical side; still overridable below
    if (name) setSide(sideForFaction(name));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setReportedEventId(null);
    const fd = new FormData(e.currentTarget);
    fd.set("faction", faction);
    fd.set("side", side);
    const evId = fixedEvent?.id ?? (Number(fd.get("event_id")) || null);
    const res = await submitBattle(fd);
    setMsg(res);
    setBusy(false);
    if (res.ok) {
      (e.target as HTMLFormElement).reset();
      // keep faction + allegiance selected for the next report
      if (faction) localStorage.setItem(LAST_FACTION_KEY, faction);
      if (!fixedEvent && evId) setReportedEventId(evId);
    }
  }

  return (
    <section className="panel">
      <div className="eyebrow eyebrow-gold" style={{ marginBottom: 6 }}>FIELD REPORT</div>
      <h2 className="section-title" style={{ marginBottom: fixedEvent ? 8 : 20 }}>
        SUBMIT BATTLE RESULT
      </h2>
      {fixedEvent && (
        <p className="data" style={{ color: "var(--bone-dim)", fontSize: 11, letterSpacing: "0.14em", marginBottom: 20 }}>
          REPORTING INTO: <span style={{ color: "var(--gold-bright)" }}>{fixedEvent.name.toUpperCase()}</span>
        </p>
      )}
      <form onSubmit={onSubmit}>
        {fixedEvent && <input type="hidden" name="event_id" value={fixedEvent.id} />}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
          <div>
            <label className="label">Faction</label>
            <select className="input" name="faction" value={faction} onChange={(e) => onFactionChange(e.target.value)}>
              <option value="">— declare your Legion —</option>
              {FACTIONS.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Victory points (VP)</label>
            <input className="input" type="number" name="score" min={0} max={100} step={1} placeholder="0–100" />
          </div>
          <div>
            <label className="label">Occasion / notes (optional)</label>
            <input className="input" type="text" name="event" maxLength={80} placeholder="e.g. The Crucible · Reforged" />
          </div>
        </div>

        {!fixedEvent && events.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <label className="label">Report to event (optional)</label>
            <select className="input" name="event_id" defaultValue="">
              <option value="">— none · the global war —</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
            </select>
            <p style={{ color: "var(--neutral)", fontSize: 11, marginTop: 6 }}>
              Battles reported to an event count on that event&apos;s standings. Only events you may
              submit to are listed.
            </p>
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <label className="label">Allegiance (changeable each battle)</label>
          <div style={{ display: "flex", gap: 10 }}>
            {[
              { id: "loyalist", label: "LOYALIST", color: "var(--gold)" },
              { id: "traitor", label: "TRAITOR", color: "var(--crimson)" },
            ].map((o) => (
              <button
                type="button"
                key={o.id}
                onClick={() => setSide(o.id)}
                style={{
                  flex: 1, padding: 12, cursor: "pointer", fontFamily: "Cinzel, serif",
                  fontWeight: 600, fontSize: 14, letterSpacing: "0.24em", borderRadius: 2,
                  background: side === o.id ? o.color + "22" : "var(--void)",
                  color: side === o.id ? o.color : "var(--bone-dim)",
                  border: `1px solid ${side === o.id ? o.color : "var(--panel-edge)"}`,
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {msg?.error && <p style={{ color: "var(--crimson)", fontSize: 12, marginTop: 14 }}>⚠ {msg.error}</p>}
        {msg?.ok && (
          <p style={{ color: "var(--gold)", fontSize: 12, marginTop: 14 }}>
            ✓ Victory recorded.
            {reportedEventId && (
              <>
                {" "}
                <Link href={`/event/${reportedEventId}`} style={{ color: "var(--gold-bright)" }}>
                  View event standings →
                </Link>
              </>
            )}
            {" "}Misreported? You can withdraw it below for 15 minutes.
          </p>
        )}

        <button className="btn" type="submit" disabled={busy} style={{ width: "100%", marginTop: 20 }}>
          {busy ? "TRANSMITTING…" : "COMMIT TO THE WAR LEDGER"}
        </button>
      </form>
    </section>
  );
}
