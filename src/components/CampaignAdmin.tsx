"use client";

import { useState } from "react";
import {
  advanceWarzone, concludeWarzone, openWarzone, concludeWarzoneById,
  createSpecialEvent, listSeasonEvents, setEventStatus,
} from "@/app/admin/admin-actions";

type ActiveFront = { id: number; name: string; sequence: number };

export default function CampaignAdmin({ activeWarzones }: { activeWarzones: ActiveFront[] }) {
  // — warzone form —
  const [wzName, setWzName] = useState("");
  const [wzNarrative, setWzNarrative] = useState("");
  const [wzBusy, setWzBusy] = useState(false);
  const [wzMsg, setWzMsg] = useState("");
  const [wzErr, setWzErr] = useState("");

  // — special event form —
  const [evName, setEvName] = useState("");
  const [evDesc, setEvDesc] = useState("");
  const [evRollsUp, setEvRollsUp] = useState(true);
  const [evOpen, setEvOpen] = useState(true);
  const [evBusy, setEvBusy] = useState(false);
  const [evMsg, setEvMsg] = useState("");
  const [evErr, setEvErr] = useState("");
  const [events, setEvents] = useState<any[] | null>(null);

  const hasActive = activeWarzones.length > 0;

  async function onAdvance() {
    setWzBusy(true); setWzMsg(""); setWzErr("");
    const res = await advanceWarzone(wzName, wzNarrative);
    setWzBusy(false);
    if (res.error) return setWzErr(res.error);
    setWzMsg(
      hasActive
        ? `All open fronts concluded. The war moves to “${wzName.trim()}”.`
        : `The war opens at “${wzName.trim()}”.`
    );
    setWzName(""); setWzNarrative("");
  }

  async function onOpenFront() {
    setWzBusy(true); setWzMsg(""); setWzErr("");
    const res = await openWarzone(wzName, wzNarrative);
    setWzBusy(false);
    if (res.error) return setWzErr(res.error);
    setWzMsg(`A new front opens at “${wzName.trim()}” — the others still rage.`);
    setWzName(""); setWzNarrative("");
  }

  async function onConcludeOnly() {
    setWzBusy(true); setWzMsg(""); setWzErr("");
    const res = await concludeWarzone();
    setWzBusy(false);
    if (res.error) return setWzErr(res.error);
    setWzMsg("All open fronts concluded. No new chapter opened.");
  }

  async function onConcludeOne(id: number, name: string) {
    setWzBusy(true); setWzMsg(""); setWzErr("");
    const res = await concludeWarzoneById(id);
    setWzBusy(false);
    if (res.error) return setWzErr(res.error);
    setWzMsg(`The battle for “${name}” is concluded; its tally is sealed into history.`);
  }

  async function onCreateEvent() {
    setEvBusy(true); setEvMsg(""); setEvErr("");
    const res = await createSpecialEvent({
      name: evName, description: evDesc, rollsUp: evRollsUp, openParticipation: evOpen,
    });
    setEvBusy(false);
    if (res.error) return setEvErr(res.error);
    setEvMsg(`Special event “${evName.trim()}” is live.`);
    setEvName(""); setEvDesc("");
    setEvents(await listSeasonEvents());
  }

  async function onLoadEvents() {
    setEvents(await listSeasonEvents());
  }

  async function onSetStatus(id: number, status: "open" | "active" | "finalized") {
    await setEventStatus(id, status);
    setEvents(await listSeasonEvents());
  }

  return (
    <>
      {/* ——— warzones ——— */}
      <section className="panel">
        <div className="eyebrow eyebrow-gold" style={{ marginBottom: 6 }}>CAMPAIGN CONTROL</div>
        <h2 className="section-title">ADVANCE THE WAR</h2>
        <p className="prose" style={{ marginTop: 8 }}>
          {hasActive
            ? <>The war rages on <strong style={{ color: "var(--bone)" }}>{activeWarzones.length}</strong> front{activeWarzones.length === 1 ? "" : "s"}. Players choose which front their battles are fought on. <em>Conclude &amp; advance</em> seals every open front and moves the whole war to the next world; <em>open additional front</em> adds another theater alongside the others.</>
            : <>No warzone is active. Open the first chapter to begin the campaign — every game reported will count toward it.</>}
        </p>

        {hasActive && (
          <div style={{ marginTop: 14 }}>
            {activeWarzones.map((wz) => (
              <div key={wz.id} className="data" style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--panel-edge-soft)", fontSize: 12 }}>
                <span style={{ color: "var(--bone)", flexGrow: 1 }}>
                  Chapter {wz.sequence} · {wz.name}
                </span>
                <button className="btn-ghost" style={{ fontSize: 9 }} disabled={wzBusy} onClick={() => onConcludeOne(wz.id, wz.name)}>
                  CONCLUDE THIS FRONT
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <label className="label">Next world / system</label>
          <input className="input" value={wzName} maxLength={120}
            placeholder="e.g. Isstvan III" onChange={(e) => setWzName(e.target.value)} />
        </div>
        <div style={{ marginTop: 12 }}>
          <label className="label">Narrative (the story of this chapter)</label>
          <textarea className="input" rows={3} value={wzNarrative}
            placeholder="The Warmaster's fleet descends upon the Choral City…"
            onChange={(e) => setWzNarrative(e.target.value)}
            style={{ resize: "vertical", fontFamily: "Cormorant, serif", fontSize: 15 }} />
        </div>

        {wzErr && <p className="data" style={{ color: "var(--crimson-bright)", fontSize: 12, marginTop: 12 }}>⚠ {wzErr}</p>}
        {wzMsg && <p className="data" style={{ color: "var(--gold-bright)", fontSize: 12, marginTop: 12 }}>✓ {wzMsg}</p>}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <button className="btn" onClick={onAdvance} disabled={wzBusy || !wzName.trim()} style={{ flex: "1 1 240px" }}>
            {wzBusy ? "…" : hasActive ? "CONCLUDE ALL & ADVANCE" : "OPEN FIRST WARZONE"}
          </button>
          {hasActive && (
            <button className="btn-ghost" onClick={onOpenFront} disabled={wzBusy || !wzName.trim()} style={{ flex: "1 1 200px" }}>
              OPEN ADDITIONAL FRONT
            </button>
          )}
          {hasActive && (
            <button className="btn-ghost" onClick={onConcludeOnly} disabled={wzBusy}>
              CONCLUDE ALL
            </button>
          )}
        </div>
      </section>

      {/* ——— special events ——— */}
      <section className="panel">
        <div className="eyebrow eyebrow-gold" style={{ marginBottom: 6 }}>BY ORDER OF THE ADMINISTRATUM</div>
        <h2 className="section-title">SPECIAL EVENTS</h2>
        <p className="prose" style={{ marginTop: 8 }}>
          Admin-run events any player can report into — no sign-up approval needed when open participation is on.
        </p>

        <div style={{ marginTop: 16 }}>
          <label className="label">Event name</label>
          <input className="input" value={evName} maxLength={120}
            placeholder="e.g. The Siege Week" onChange={(e) => setEvName(e.target.value)} />
        </div>
        <div style={{ marginTop: 12 }}>
          <label className="label">Description</label>
          <textarea className="input" rows={2} value={evDesc}
            onChange={(e) => setEvDesc(e.target.value)}
            style={{ resize: "vertical", fontFamily: "Cormorant, serif", fontSize: 15 }} />
        </div>
        <div className="data" style={{ display: "flex", gap: 22, flexWrap: "wrap", marginTop: 14, fontSize: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={evRollsUp} onChange={(e) => setEvRollsUp(e.target.checked)} />
            Counts toward the global war
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={evOpen} onChange={(e) => setEvOpen(e.target.checked)} />
            Open participation (anyone can report)
          </label>
        </div>

        {evErr && <p className="data" style={{ color: "var(--crimson-bright)", fontSize: 12, marginTop: 12 }}>⚠ {evErr}</p>}
        {evMsg && <p className="data" style={{ color: "var(--gold-bright)", fontSize: 12, marginTop: 12 }}>✓ {evMsg}</p>}

        <button className="btn" onClick={onCreateEvent} disabled={evBusy || !evName.trim()} style={{ width: "100%", marginTop: 16 }}>
          {evBusy ? "…" : "CREATE SPECIAL EVENT"}
        </button>

        <div style={{ marginTop: 20 }}>
          <button className="btn-ghost" onClick={onLoadEvents}>LOAD SEASON EVENTS</button>
          {events && events.length === 0 && (
            <p className="prose" style={{ marginTop: 10 }}>No events this season yet.</p>
          )}
          {events && events.length > 0 && events.map((e) => (
            <div key={e.id} className="data" style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--panel-edge-soft)", fontSize: 12, flexWrap: "wrap" }}>
              <span style={{ color: "var(--bone)", flexGrow: 1 }}>
                {e.name}
                {e.is_special ? <span style={{ color: "var(--gold)" }}> · special</span> : null}
                {e.open_participation ? <span style={{ color: "var(--bone-dim)" }}> · open</span> : null}
                {!e.rolls_up ? <span style={{ color: "var(--bone-dim)" }}> · no roll-up</span> : null}
              </span>
              <span style={{ color: "var(--bone-dim)", fontSize: 10, letterSpacing: "0.15em" }}>{String(e.status).toUpperCase()}</span>
              {e.status !== "finalized" && (
                <button className="btn-ghost" style={{ fontSize: 9 }} onClick={() => onSetStatus(e.id, "finalized")}>FINALIZE</button>
              )}
              {e.status === "finalized" && (
                <button className="btn-ghost" style={{ fontSize: 9 }} onClick={() => onSetStatus(e.id, "open")}>REOPEN</button>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
