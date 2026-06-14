"use client";

import { useState } from "react";
import Link from "next/link";
import { runSearch } from "@/app/ledger/search-action";

type Hit = {
  id: number; handle: string; faction: string;
  side: "loyalist" | "traitor"; score: number; event: string | null; created_at: string;
};

export default function LedgerSearch() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function onChange(value: string) {
    setQ(value);
    if (value.trim().length < 2) { setHits(null); return; }
    setBusy(true);
    const res = await runSearch(value);
    setHits(res);
    setBusy(false);
  }

  return (
    <div>
      <input
        className="input"
        style={{ fontSize: 14 }}
        placeholder="Search by soldier, event, or faction…"
        value={q}
        onChange={(e) => onChange(e.target.value)}
      />
      {hits !== null && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 10, color: "var(--bone-dim)", letterSpacing: "0.12em", marginBottom: 10 }}>
            {busy ? "SEARCHING…" : `${hits.length} RESULT${hits.length === 1 ? "" : "S"}`}
          </div>
          {hits.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", borderBottom: "1px solid var(--panel-edge)", fontSize: 12 }}>
              <span style={{ width: 8, height: 8, transform: "rotate(45deg)", background: s.side === "loyalist" ? "var(--gold)" : "var(--crimson)" }} />
              <Link href={`/profile/${s.handle}`} style={{ minWidth: 110 }}>{s.handle}</Link>
              <span style={{ flexGrow: 1, color: "var(--bone)" }}>
                {s.faction}{s.event ? <span style={{ color: "var(--bone-dim)" }}> · {s.event}</span> : null}
              </span>
              <span style={{ color: "var(--bone)" }}>+{s.score} VP</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
