"use client";

import { useState } from "react";
import { requestJoin, decideParticipant, adminAddPlayer } from "@/app/event/[id]/event-actions";

type RosterRow = { id: number; playerId: string; handle: string; status: "requested" | "approved" | "rejected" };

export default function EventActions({
  eventId,
  signedIn,
  myStatus,
  canManage,
  openParticipation,
  roster,
}: {
  eventId: number;
  signedIn: boolean;
  myStatus: "requested" | "approved" | "rejected" | null;
  canManage: boolean;
  openParticipation: boolean;
  roster: RosterRow[];
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [addHandle, setAddHandle] = useState("");

  async function onJoin() {
    setBusy(true); setErr(""); setMsg("");
    const res = await requestJoin(eventId);
    setBusy(false);
    if (res.error) return setErr(res.error);
    setMsg("Request sent. The organizer will review it.");
  }

  async function onDecide(pid: number, approve: boolean) {
    setErr(""); setMsg("");
    const res = await decideParticipant(pid, eventId, approve);
    if (res.error) setErr(res.error);
  }

  async function onAdd() {
    if (!addHandle.trim()) return;
    setBusy(true); setErr(""); setMsg("");
    const res = await adminAddPlayer(eventId, addHandle);
    setBusy(false);
    if (res.error) return setErr(res.error);
    setMsg(`“${addHandle.trim().toLowerCase()}” added to the roster.`);
    setAddHandle("");
  }

  const pending = roster.filter((r) => r.status === "requested");

  return (
    <div>
      {/* ——— join controls (players) ——— */}
      {!canManage && (
        <div style={{ marginTop: 16 }}>
          {openParticipation ? (
            <p className="prose" style={{ margin: 0 }}>
              Open participation — every soldier may report into this event from the submission form. No sign-up needed.
            </p>
          ) : myStatus === "approved" ? (
            <p className="data" style={{ color: "var(--gold-bright)", fontSize: 12, margin: 0 }}>
              ✓ You are on the roster. Report your games via the submission form.
            </p>
          ) : myStatus === "requested" ? (
            <p className="data" style={{ color: "var(--bone-dim)", fontSize: 12, margin: 0 }}>
              ⧗ Your request is awaiting the organizer's review.
            </p>
          ) : myStatus === "rejected" ? (
            <p className="data" style={{ color: "var(--crimson-bright)", fontSize: 12, margin: 0 }}>
              Your request was not accepted.
            </p>
          ) : signedIn ? (
            <button className="btn" onClick={onJoin} disabled={busy}>
              {busy ? "…" : "REQUEST TO JOIN"}
            </button>
          ) : (
            <p className="prose" style={{ margin: 0 }}>
              <a href="/#enlist" style={{ color: "var(--gold-bright)" }}>Sign in</a> to request a place.
            </p>
          )}
        </div>
      )}

      {err && <p className="data" style={{ color: "var(--crimson-bright)", fontSize: 12, marginTop: 12 }}>⚠ {err}</p>}
      {msg && <p className="data" style={{ color: "var(--gold-bright)", fontSize: 12, marginTop: 12 }}>✓ {msg}</p>}

      {/* ——— management (organizer/admin) ——— */}
      {canManage && (
        <div style={{ marginTop: 20 }}>
          <div className="eyebrow eyebrow-gold" style={{ marginBottom: 10 }}>ROSTER ADMINISTRATION</div>

          {/* add by handle */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              className="input"
              style={{ flex: "1 1 220px" }}
              placeholder="Add player by handle…"
              value={addHandle}
              onChange={(e) => setAddHandle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onAdd(); }}
            />
            <button className="btn" onClick={onAdd} disabled={busy || !addHandle.trim()} style={{ flex: "0 0 auto" }}>
              {busy ? "…" : "ADD TO ROSTER"}
            </button>
          </div>

          {/* pending requests */}
          {pending.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                {pending.length} PENDING REQUEST{pending.length === 1 ? "" : "S"}
              </div>
              {pending.map((r) => (
                <div key={r.id} className="data" style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--panel-edge-soft)", fontSize: 12 }}>
                  <span style={{ color: "var(--bone)", flexGrow: 1 }}>{r.handle}</span>
                  <button className="btn-ghost" style={{ fontSize: 9, color: "var(--gold-bright)", borderColor: "var(--gold-deep)" }} onClick={() => onDecide(r.id, true)}>APPROVE</button>
                  <button className="btn-ghost" style={{ fontSize: 9 }} onClick={() => onDecide(r.id, false)}>REJECT</button>
                </div>
              ))}
            </div>
          )}
          {pending.length === 0 && (
            <p className="prose" style={{ marginTop: 14, marginBottom: 0 }}>No pending join requests.</p>
          )}
        </div>
      )}
    </div>
  );
}
