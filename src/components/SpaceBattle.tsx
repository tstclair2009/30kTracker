"use client";

import { useEffect, useRef } from "react";

// Lively animated space battle: a star system with a central star, orbiting
// planets, and two opposing fleets trading weapon fire. Both side-color edges
// are always present; each brightens toward whichever side is winning.
// `balance` is loyalist_vp - traitor_vp (positive = loyalists ahead).
export default function SpaceBattle({ balance = 0 }: { balance?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const balanceRef = useRef(balance);
  balanceRef.current = balance;

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const context = canvasEl.getContext("2d");
    if (!context) return;
    const canvas = canvasEl;
    const ctx = context;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    // ---- scene elements ----
    const stars = Array.from({ length: 140 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.3 + 0.2,
      tw: Math.random() * Math.PI * 2,
    }));

    const planets = [
      { dist: 0.16, size: 10, speed: 0.00022, ang: 0.4, color: "#3a4a6a" },
      { dist: 0.26, size: 16, speed: 0.00014, ang: 2.1, color: "#6a4a3a" },
      { dist: 0.38, size: 7, speed: 0.0001, ang: 4.0, color: "#4a5a4a" },
    ];

    type Ship = { x: number; y: number; vx: number; vy: number; side: "loyalist" | "traitor"; size: number };
    const ships: Ship[] = [];
    function spawnFleets() {
      ships.length = 0;
      for (let i = 0; i < 7; i++) {
        ships.push({ x: -0.05 - Math.random() * 0.2, y: 0.15 + Math.random() * 0.7, vx: 0.00004 + Math.random() * 0.00003, vy: (Math.random() - 0.5) * 0.00002, side: "loyalist", size: 4 + Math.random() * 4 });
        ships.push({ x: 1.05 + Math.random() * 0.2, y: 0.15 + Math.random() * 0.7, vx: -(0.00004 + Math.random() * 0.00003), vy: (Math.random() - 0.5) * 0.00002, side: "traitor", size: 4 + Math.random() * 4 });
      }
    }
    spawnFleets();

    type Shot = { x: number; y: number; tx: number; ty: number; life: number; max: number; side: "loyalist" | "traitor" };
    const shots: Shot[] = [];
    type Boom = { x: number; y: number; life: number; max: number; side: "loyalist" | "traitor" };
    const booms: Boom[] = [];

    let last = performance.now();
    let raf = 0;
    let shotTimer = 0;

    function frame(now: number) {
      const dt = Math.min(now - last, 60);
      last = now;

      ctx.clearRect(0, 0, w, h);
      // deep space wash
      ctx.fillStyle = "#06060c";
      ctx.fillRect(0, 0, w, h);

      // ---- side-color edges (brighten toward the winner) ----
      const b = balanceRef.current;
      const lead = Math.max(-1, Math.min(1, b / 400)); // -1..1 compressed
      const loyalStrength = 0.10 + Math.max(0, lead) * 0.32;
      const traitorStrength = 0.10 + Math.max(0, -lead) * 0.32;

      const gL = ctx.createLinearGradient(0, 0, w * 0.45, 0);
      gL.addColorStop(0, `rgba(212,161,74,${loyalStrength})`);
      gL.addColorStop(1, "rgba(212,161,74,0)");
      ctx.fillStyle = gL;
      ctx.fillRect(0, 0, w * 0.45, h);

      const gR = ctx.createLinearGradient(w, 0, w * 0.55, 0);
      gR.addColorStop(0, `rgba(192,57,43,${traitorStrength})`);
      gR.addColorStop(1, "rgba(192,57,43,0)");
      ctx.fillStyle = gR;
      ctx.fillRect(w * 0.55, 0, w * 0.45, h);

      // ---- stars ----
      for (const s of stars) {
        s.tw += 0.02;
        const a = 0.4 + Math.sin(s.tw) * 0.3;
        ctx.fillStyle = `rgba(232,226,208,${a})`;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // ---- central star + planets (system sits center-ish) ----
      const cx = w * 0.5, cy = h * 0.5;
      const minDim = Math.min(w, h);

      // star glow
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, minDim * 0.12);
      glow.addColorStop(0, "rgba(212,161,74,0.5)");
      glow.addColorStop(0.4, "rgba(192,90,43,0.18)");
      glow.addColorStop(1, "rgba(192,57,43,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, minDim * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e8d8a0";
      ctx.beginPath();
      ctx.arc(cx, cy, minDim * 0.018, 0, Math.PI * 2);
      ctx.fill();

      for (const p of planets) {
        if (!reduce) p.ang += p.speed * dt;
        const px = cx + Math.cos(p.ang) * minDim * p.dist;
        const py = cy + Math.sin(p.ang) * minDim * p.dist * 0.6;
        // orbit ring
        ctx.strokeStyle = "rgba(120,120,150,0.06)";
        ctx.beginPath();
        ctx.ellipse(cx, cy, minDim * p.dist, minDim * p.dist * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();
        // planet
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.arc(px + p.size * 0.3, py, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // ---- fleets ----
      if (!reduce) {
        for (const ship of ships) {
          ship.x += ship.vx * dt;
          ship.y += ship.vy * dt;
          // wrap when a fleet crosses the field
          if (ship.side === "loyalist" && ship.x > 1.15) { ship.x = -0.1; ship.y = 0.15 + Math.random() * 0.7; }
          if (ship.side === "traitor" && ship.x < -0.15) { ship.x = 1.1; ship.y = 0.15 + Math.random() * 0.7; }
        }

        // weapon fire: pair up opposing ships occasionally
        shotTimer += dt;
        if (shotTimer > 90) {
          shotTimer = 0;
          const loy = ships.filter((s) => s.side === "loyalist");
          const tra = ships.filter((s) => s.side === "traitor");
          if (loy.length && tra.length) {
            const a = loy[Math.floor(Math.random() * loy.length)];
            const t = tra[Math.floor(Math.random() * tra.length)];
            const shooter = Math.random() < 0.5 ? a : t;
            const target = shooter === a ? t : a;
            shots.push({ x: shooter.x, y: shooter.y, tx: target.x, ty: target.y, life: 0, max: 28, side: shooter.side });
          }
        }
      }

      // draw ships
      for (const ship of ships) {
        const sx = ship.x * w, sy = ship.y * h;
        const col = ship.side === "loyalist" ? "#d4a14a" : "#c0392b";
        ctx.fillStyle = col;
        ctx.beginPath();
        // little triangle pointing in travel direction
        const dir = ship.side === "loyalist" ? 1 : -1;
        ctx.moveTo(sx + dir * ship.size, sy);
        ctx.lineTo(sx - dir * ship.size, sy - ship.size * 0.6);
        ctx.lineTo(sx - dir * ship.size, sy + ship.size * 0.6);
        ctx.closePath();
        ctx.fill();
        // engine glow
        ctx.fillStyle = ship.side === "loyalist" ? "rgba(212,161,74,0.4)" : "rgba(192,57,43,0.4)";
        ctx.beginPath();
        ctx.arc(sx - dir * ship.size * 1.3, sy, ship.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // ---- shots ----
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i];
        s.life += dt / 16;
        const f = s.life / s.max;
        if (f >= 1) {
          booms.push({ x: s.tx, y: s.ty, life: 0, max: 18, side: s.side });
          shots.splice(i, 1);
          continue;
        }
        const x1 = s.x + (s.tx - s.x) * f;
        const y1 = s.y + (s.ty - s.y) * f;
        const x0 = s.x + (s.tx - s.x) * Math.max(0, f - 0.12);
        const y0 = s.y + (s.ty - s.y) * Math.max(0, f - 0.12);
        ctx.strokeStyle = s.side === "loyalist" ? "rgba(255,220,150,0.9)" : "rgba(255,120,90,0.9)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x0 * w, y0 * h);
        ctx.lineTo(x1 * w, y1 * h);
        ctx.stroke();
      }

      // ---- explosions ----
      for (let i = booms.length - 1; i >= 0; i--) {
        const bm = booms[i];
        bm.life += dt / 16;
        const f = bm.life / bm.max;
        if (f >= 1) { booms.splice(i, 1); continue; }
        const r = 2 + f * 14;
        ctx.fillStyle = bm.side === "loyalist"
          ? `rgba(255,210,140,${(1 - f) * 0.8})`
          : `rgba(255,110,80,${(1 - f) * 0.8})`;
        ctx.beginPath();
        ctx.arc(bm.x * w, bm.y * h, r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    }

    if (reduce) {
      // draw a single static frame
      frame(performance.now());
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: -1,
        pointerEvents: "none",
      }}
    />
  );
}
