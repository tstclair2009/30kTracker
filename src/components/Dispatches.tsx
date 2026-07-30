"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { loadMoreDispatches, latestDispatches } from "@/app/actions";
import { createClient } from "@/lib/supabase-client";
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
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // realtime: when new reports land (or are withdrawn/voided), refresh the
  // newest page and merge it on top of whatever is already loaded
  useEffect(() => {
    const supabase = createClient();
    async function refresh() {
      const fresh = await latestDispatches();
      // the fresh page replaces its whole time window (so withdrawn or voided
      // reports vanish); older pagination below it is kept
      setBattles((prev) => {
        const oldestFresh = fresh[fresh.length - 1]?.created_at;
        if (!oldestFresh) return fresh;
        return [...fresh, ...prev.filter((b) => b.created_at < oldestFresh)];
      });
    }
    const channel = supabase
      .channel("dispatches-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "battles" }, () => {
        if (debounce.current) clearTimeout(debounce.current);
        debounce.current = setTimeout(refresh, 500);
      })
      .subscribe();
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
      supabase.removeChannel(channel);
    };
  }, []);

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
