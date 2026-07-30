"use client";

import { useState } from "react";
import Link from "next/link";
import { loadMoreDispatches } from "@/app/actions";
import type { Battle } from "@/lib/data";

function timeAgo(ts: string) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return "moments ago";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

// The public battle feed, with cursor pagination — LOAD MORE fetches the next
// page of battles older than the last one shown.
export default function Dispatches({ initial, pageSize = 20 }: { initial: Battle[]; pageSize?: number }) {
  const [battles, setBattles] = useState<Battle[]>(initial);
  // a short first page means there's nothing older to fetch
  const [exhausted, setExhausted] = useState(initial.length < pageSize);
  const [busy, setBusy] = useState(false);

  async function onMore() {
    const oldest = battles[battles.length - 1];
    if (!oldest) return;
    setBusy(true);
    const next = await loadMoreDispatches(oldest.created_at);
    setBusy(false);
    setBattles((b) => [...b, ...next]);
    if (next.length < pageSize) setExhausted(true);
  }

  if (battles.length === 0) {
    return (
      <p className="prose">
        The vox is silent. No battles have been recorded — be the first to commit a result.
      </p>
    );
  }

  return (
    <>
      {battles.map((b) => (
        <div key={b.id} className="data" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 2px", borderBottom: "1px solid var(--panel-edge-soft)", fontSize: 12 }}>
          <span className="side-dot" style={{ background: b.side === "loyalist" ? "var(--gold)" : "var(--crimson)" }} />
          <span style={{ flexGrow: 1, color: "var(--bone)" }}>
            {b.faction}{b.event ? <span style={{ color: "var(--bone-dim)" }}> · {b.event}</span> : null}
          </span>
          <span style={{ color: b.side === "loyalist" ? "var(--gold-bright)" : "var(--crimson-bright)" }}>+{b.score} VP</span>
          <Link href={`/profile/${b.handle}`} style={{ fontSize: 10, minWidth: 90, textAlign: "right" }}>{b.handle}</Link>
          <span style={{ color: "var(--neutral)", fontSize: 10, minWidth: 70, textAlign: "right" }}>{timeAgo(b.created_at)}</span>
        </div>
      ))}
      {!exhausted && (
        <button className="btn-ghost" onClick={onMore} disabled={busy} style={{ width: "100%", marginTop: 14 }}>
          {busy ? "…" : "LOAD OLDER DISPATCHES"}
        </button>
      )}
    </>
  );
}
