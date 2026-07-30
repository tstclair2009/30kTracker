"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase-client";
import SpaceBattle from "@/components/SpaceBattle";

// The warfront gauge, live: subscribes to battle reports over Supabase
// Realtime and refreshes the totals as they land, so the needle (and the
// space battle behind the page) moves while you watch. Falls back to the
// server-rendered totals if realtime is unavailable.
export default function LiveWarGauge({
  initialLoyal,
  initialTraitor,
}: {
  initialLoyal: number;
  initialTraitor: number;
}) {
  const [loyal, setLoyal] = useState(initialLoyal);
  const [traitor, setTraitor] = useState(initialTraitor);
  const [flash, setFlash] = useState(false);
  const [live, setLive] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function refresh() {
      const { data: season } = await supabase
        .from("seasons").select("id").is("ended_at", null).maybeSingle();
      if (!season) return;
      const { data } = await supabase
        .from("v_war_balance")
        .select("loyalist_vp, traitor_vp")
        .eq("season_id", season.id)
        .maybeSingle();
      if (!data) return;
      setLoyal(Number(data.loyalist_vp) || 0);
      setTraitor(Number(data.traitor_vp) || 0);
      setFlash(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(false), 1400);
    }

    const channel = supabase
      .channel("war-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "battles" },
        () => {
          // several reports can land together (an event night) — settle first
          if (debounce.current) clearTimeout(debounce.current);
          debounce.current = setTimeout(refresh, 400);
        }
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      if (debounce.current) clearTimeout(debounce.current);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      supabase.removeChannel(channel);
    };
  }, []);

  const diff = loyal - traitor;
  const total = loyal + traitor;
  // Marker = loyalist share of total VP, eased off the extremes so it never
  // fully pins to an edge. LOYALIST label is on the left, TRAITOR on the
  // right; the marker moves TOWARD the winning side, so we position by
  // traitor share: high traitor share -> right, high loyalist share -> left.
  const traitorShare = total > 0 ? traitor / total : 0.5;
  const marker = total > 0 ? 6 + traitorShare * 88 : 50; // 6%..94%, centered when empty

  return (
    <>
      <SpaceBattle balance={diff} />

      <section className="panel rise-2" style={{ marginTop: 28, padding: "32px 30px 26px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16, gap: 12 }}>
          <div>
            <div className="eyebrow eyebrow-gold">LOYALIST</div>
            <div className="war-num" style={{ color: "var(--gold-bright)", transition: "text-shadow 0.6s" }}>
              {loyal.toLocaleString()}
            </div>
          </div>
          <div className="eyebrow" style={{ paddingBottom: 8, display: "flex", alignItems: "center", gap: 7 }}>
            VICTORY POINTS
            {live && (
              <span
                title="Live — new reports move the gauge as they land"
                style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: flash ? "var(--gold-bright)" : "var(--neutral)",
                  boxShadow: flash ? "0 0 8px var(--gold-bright)" : "none",
                  transition: "background 0.5s, box-shadow 0.5s",
                }}
              />
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="eyebrow eyebrow-crimson">TRAITOR</div>
            <div className="war-num" style={{ color: "var(--crimson-bright)" }}>{traitor.toLocaleString()}</div>
          </div>
        </div>

        <div className="gauge-shell">
          <div className="gauge-glow-l" style={{ opacity: 0.35 + Math.max(0, 0.5 - traitorShare) * 1.3, transition: "opacity 0.9s" }} />
          <div className="gauge-glow-r" style={{ opacity: 0.35 + Math.max(0, traitorShare - 0.5) * 1.3, transition: "opacity 0.9s" }} />
          <div className="gauge-ticks" />
          <div className="gauge-center" />
          <div
            className="gauge-blade"
            style={{ left: `calc(${marker}% - 1.5px)`, transition: "left 0.9s cubic-bezier(0.22, 1, 0.36, 1)" }}
          />
        </div>

        <p className="eyebrow" style={{ textAlign: "center", marginTop: 14, letterSpacing: "0.4em" }}>
          {diff === 0 ? "THE WAR HANGS IN BALANCE" : diff > 0 ? "THE WAR FAVORS THE LOYALISTS" : "THE WAR FAVORS THE TRAITORS"}
        </p>
      </section>
    </>
  );
}
