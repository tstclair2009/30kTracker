"use client";

import { useState } from "react";
import { resetWar, fetchReport, listSeasons, viewSeasonBattles } from "@/app/admin/admin-actions";

export default function AdminPanels() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState("");
  const [seasons, setSeasons] = useState<any[] | null>(null);
  const [battles, setBattles] = useState<{ label: string; list: any[] } | null>(null);

  async function onReport() {
    setReportBusy(true);
    const res = await fetchReport();
    setRows(res.rows);
    setReportBusy(false);
  }

  async function onReset() {
    setResetBusy(true);
    const res = await resetWar();
    setResetBusy(false);
    setArmed(false);
    setResetMsg(res.ok ? "Ledger reset. The previous war is sealed; a new one begins." : `Failed: ${res.error}`);
  }

  async function onSeasons() {
    setSeasons(await listSeasons());
  }

  async function onViewSeason(id: number, label: string) {
    const list = await viewSeasonBattles(id);
    setBattles({ label, list });
  }

  return (
    <>
      {/* accounts report */}
      <section className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ fontSize: 16, margin: 0, color: "var(--bone)" }}>ACCOUNTS REPORT</h2>
          <button className="btn" style={{ background: "var(--gold)" }} onClick={onReport} disabled={reportBusy}>
            {reportBusy ? "ASSEMBLING…" : rows ? "↻ REFRESH" : "RUN REPORT"}
          </button>
        </div>
        {rows && (
          <div style={{ overflowX: "auto", marginTop: 18 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ color: "var(--bone-dim)", textAlign: "left" }}>
                  {["Handle", "Email", "Enlisted", "Battles", "VP"].map((h, i) => (
                    <th key={h} style={{ padding: "8px 10px", borderBottom: "1px solid var(--panel-edge)", fontSize: 9, letterSpacing: "0.15em", textAlign: i >= 3 ? "right" : "left" }}>
                      {h.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.handle}>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--panel-edge)", color: "var(--bone)" }}>{r.handle}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--panel-edge)", color: "var(--bone)" }}>{r.email}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--panel-edge)", color: "var(--bone-dim)" }}>{new Date(r.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--panel-edge)", color: "var(--bone-dim)", textAlign: "right" }}>{r.battles}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--panel-edge)", color: "var(--gold)", textAlign: "right" }}>{Number(r.vp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* reset */}
      <section className="panel" style={{ borderColor: "var(--crimson-deep)" }}>
        <h2 style={{ fontSize: 16, margin: 0, color: "var(--bone)" }}>RESET THE WAR LEDGER</h2>
        <p style={{ fontSize: 11, color: "var(--bone-dim)", lineHeight: 1.7 }}>
          Seals the current war as a past season and opens a fresh one. History is preserved automatically.
          Accounts are kept; live VP and ranks return to zero.
        </p>
        {resetMsg && <p style={{ color: "var(--gold)", fontSize: 12 }}>✓ {resetMsg}</p>}
        {!armed ? (
          <button className="btn-ghost" style={{ color: "var(--crimson)", borderColor: "var(--crimson)" }} onClick={() => { setArmed(true); setResetMsg(""); }}>
            ARM RESET
          </button>
        ) : (
          <div style={{ border: "1px solid var(--crimson)", borderRadius: 2, padding: 16, background: "rgba(192,57,43,0.07)" }}>
            <p style={{ fontSize: 12, color: "var(--bone)", marginTop: 0 }}>Confirm to seal the current war and open a new one.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn" style={{ flex: "1 1 200px", background: "var(--crimson)" }} onClick={onReset} disabled={resetBusy}>
                {resetBusy ? "RESETTING…" : "CONFIRM RESET"}
              </button>
              <button className="btn-ghost" style={{ flex: "1 1 120px" }} onClick={() => setArmed(false)} disabled={resetBusy}>CANCEL</button>
            </div>
          </div>
        )}
      </section>

      {/* seasons / archives */}
      <section className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 16, margin: 0, color: "var(--bone)" }}>PAST WARS</h2>
          <button className="btn-ghost" onClick={onSeasons}>LOAD SEASONS</button>
        </div>
        {seasons && seasons.map((s) => (
          <button key={s.id} onClick={() => onViewSeason(s.id, s.label)}
            style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", borderBottom: "1px solid var(--panel-edge)", padding: "8px 0", cursor: "pointer", display: "flex", gap: 12, alignItems: "center", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
            <span style={{ color: s.ended_at ? "var(--gold)" : "var(--bone)", flexGrow: 1, textDecoration: "underline dotted" }}>
              War of {s.label} {s.ended_at ? "" : "(LIVE)"}
            </span>
            <span style={{ color: "var(--neutral)", fontSize: 10 }}>
              {s.ended_at ? new Date(s.ended_at).toLocaleDateString() : "ongoing"}
            </span>
          </button>
        ))}
        {battles && (
          <div style={{ marginTop: 18 }}>
            <div className="label">War of {battles.label} · {battles.list.length} battles (max 500 shown)</div>
            <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
              {battles.list.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--panel-edge)", fontSize: 11 }}>
                  <span style={{ width: 7, height: 7, transform: "rotate(45deg)", background: s.side === "loyalist" ? "var(--gold)" : "var(--crimson)" }} />
                  <span style={{ color: "var(--bone-dim)", minWidth: 100 }}>{s.handle}</span>
                  <span style={{ flexGrow: 1, color: "var(--bone)" }}>{s.faction}{s.event ? ` · ${s.event}` : ""}</span>
                  <span style={{ color: "var(--bone)" }}>+{s.score} VP</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
