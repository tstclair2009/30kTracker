"use client";

import { useState } from "react";
import { withdrawBattle } from "@/app/actions";

type Report = {
  id: number;
  faction: string;
  side: "loyalist" | "traitor";
  score: number;
  event_id: number | null;
  created_at: string;
};

// The player's own reports still inside the 15-minute withdraw window, each
// with a WITHDRAW button — the self-service fix for a mistyped score.
export default function MyRecentReports({ reports }: { reports: Report[] }) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [gone, setGone] = useState<Set<number>>(new Set());

  const visible = reports.filter((r) => !gone.has(r.id));
  if (visible.length === 0) return null;

  async function onWithdraw(id: number) {
    setBusyId(id);
    setErr("");
    const res = await withdrawBattle(id);
    setBusyId(null);
    if (res.error) return setErr(res.error);
    setGone((s) => new Set(s).add(id));
  }

  function minutesLeft(created: string) {
    return Math.max(0, Math.ceil(15 - (Date.now() - new Date(created).getTime()) / 60000));
  }

  return (
    <section className="panel">
      <div className="eyebrow" style={{ marginBottom: 4 }}>YOUR LATEST REPORTS</div>
      <p className="prose" style={{ fontSize: 12, marginTop: 0, marginBottom: 6 }}>
        Misreported a result? You may withdraw a report within 15 minutes, then submit it again correctly.
      </p>
      {visible.map((r) => (
        <div
          key={r.id}
          className="data"
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 2px", borderBottom: "1px solid var(--panel-edge-soft)", fontSize: 12 }}
        >
          <span className="side-dot" style={{ background: r.side === "loyalist" ? "var(--gold)" : "var(--crimson)" }} />
          <span style={{ flexGrow: 1, color: "var(--bone)" }}>{r.faction}</span>
          <span style={{ color: r.side === "loyalist" ? "var(--gold-bright)" : "var(--crimson-bright)" }}>+{r.score} VP</span>
          <span style={{ color: "var(--neutral)", fontSize: 10 }}>{minutesLeft(r.created_at)}m left</span>
          <button
            className="btn-ghost"
            style={{ fontSize: 9 }}
            disabled={busyId === r.id}
            onClick={() => onWithdraw(r.id)}
          >
            {busyId === r.id ? "…" : "WITHDRAW"}
          </button>
        </div>
      ))}
      {err && <p className="data" style={{ color: "var(--crimson-bright)", fontSize: 12, marginTop: 10 }}>⚠ {err}</p>}
    </section>
  );
}
