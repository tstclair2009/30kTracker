"use client";

import { useState } from "react";
import { submitBattle } from "@/app/actions";
import { FACTIONS } from "@/lib/factions";

export default function SubmitForm() {
  const [side, setSide] = useState("");
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    fd.set("side", side);
    const res = await submitBattle(fd);
    setMsg(res);
    setBusy(false);
    if (res.ok) {
      (e.target as HTMLFormElement).reset();
      setSide("");
    }
  }

  return (
    <section className="panel">
      <h2 style={{ fontSize: 16, margin: "0 0 18px", color: "var(--bone)" }}>
        SUBMIT BATTLE RESULT
      </h2>
      <form onSubmit={onSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
          <div>
            <label className="label">Faction</label>
            <select className="input" name="faction" defaultValue="">
              <option value="">— declare your Legion —</option>
              {FACTIONS.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Victory points (VP)</label>
            <input className="input" type="number" name="score" min={0} max={100} step={1} placeholder="0–100" />
          </div>
          <div>
            <label className="label">Event name</label>
            <input className="input" type="text" name="event" maxLength={80} placeholder="e.g. The Crucible · Reforged" />
          </div>
        </div>

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
                  fontWeight: 600, fontSize: 14, letterSpacing: "0.2em", borderRadius: 2,
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
        {msg?.ok && <p style={{ color: "var(--gold)", fontSize: 12, marginTop: 14 }}>✓ Victory recorded.</p>}

        <button className="btn" type="submit" disabled={busy} style={{ width: "100%", marginTop: 20 }}>
          {busy ? "TRANSMITTING…" : "COMMIT TO THE WAR LEDGER"}
        </button>
      </form>
    </section>
  );
}
