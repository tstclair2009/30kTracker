"use client";

import { useEffect, useRef } from "react";

// The void war, fought behind the page: a nebula-lit battlefield over a
// besieged world. Two fleets of gothic capital ships hold station and trade
// macro-cannon broadsides, lance strikes, and torpedoes while fighter wings
// dogfight in the gulf between them. Impacts flare against void shields;
// wreckage tumbles through the dark. Both side-color edges are always present
// and brighten toward whichever side is winning.
// `balance` is loyalist_vp - traitor_vp (positive = loyalists ahead).

type SideId = "loyalist" | "traitor";

const GOLD = { r: 201, g: 162, b: 39 };
const CRIMSON = { r: 164, g: 31, b: 31 };
function tint(side: SideId, a: number) {
  const c = side === "loyalist" ? GOLD : CRIMSON;
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

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

    // ---- static backdrop (nebula + planet), prerendered per resize ----
    const backdrop = document.createElement("canvas");
    const bctx = backdrop.getContext("2d")!;
    let cityLights: { x: number; y: number; tw: number }[] = [];

    function paintBackdrop() {
      backdrop.width = w * dpr;
      backdrop.height = h * dpr;
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // deep space base
      const base = bctx.createLinearGradient(0, 0, 0, h);
      base.addColorStop(0, "#030308");
      base.addColorStop(1, "#07060a");
      bctx.fillStyle = base;
      bctx.fillRect(0, 0, w, h);

      // nebula: soft billows — gold-stained near the loyalist edge, ember-red
      // near the traitor edge, cold steel through the middle
      const blobs = 16;
      for (let i = 0; i < blobs; i++) {
        const bx = Math.random();
        const by = Math.random() * 0.85;
        const r = (0.18 + Math.random() * 0.3) * Math.max(w, h);
        let col: string;
        if (bx < 0.35) col = `rgba(140,104,34,${0.028 + Math.random() * 0.035})`;
        else if (bx > 0.65) col = `rgba(120,30,26,${0.028 + Math.random() * 0.035})`;
        else col = `rgba(46,56,88,${0.03 + Math.random() * 0.04})`;
        const g = bctx.createRadialGradient(bx * w, by * h, 0, bx * w, by * h, r);
        g.addColorStop(0, col);
        g.addColorStop(1, "rgba(0,0,0,0)");
        bctx.fillStyle = g;
        bctx.fillRect(bx * w - r, by * h - r, r * 2, r * 2);
      }

      // fine dust
      for (let i = 0; i < 260; i++) {
        bctx.fillStyle = `rgba(180,180,210,${0.02 + Math.random() * 0.04})`;
        bctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
      }

      // the besieged world: a dark planetary arc along the bottom of the frame
      const pr = Math.max(w * 0.8, h * 0.55);
      const pcx = w * 0.5;
      const pcy = h * 0.86 + pr; // top of the disc sits at ~86% screen height

      // atmosphere rim glow
      const atmo = bctx.createRadialGradient(pcx, pcy, pr * 0.96, pcx, pcy, pr * 1.05);
      atmo.addColorStop(0, "rgba(0,0,0,0)");
      atmo.addColorStop(0.45, "rgba(110,130,170,0.16)");
      atmo.addColorStop(0.7, "rgba(90,110,160,0.05)");
      atmo.addColorStop(1, "rgba(0,0,0,0)");
      bctx.fillStyle = atmo;
      bctx.fillRect(0, h * 0.6, w, h * 0.4);

      // planet body, day side fading into night
      bctx.save();
      bctx.beginPath();
      bctx.arc(pcx, pcy, pr, 0, Math.PI * 2);
      bctx.clip();
      const body = bctx.createLinearGradient(0, 0, w, 0);
      body.addColorStop(0, "#1a1d26");
      body.addColorStop(0.45, "#12141c");
      body.addColorStop(1, "#08090e");
      bctx.fillStyle = body;
      bctx.fillRect(0, h * 0.6, w, h * 0.4);
      // faint continents
      for (let i = 0; i < 10; i++) {
        const gx = Math.random() * w;
        const gy = h * (0.86 + Math.random() * 0.14);
        const gr = 30 + Math.random() * 90;
        const g = bctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        g.addColorStop(0, "rgba(60,66,58,0.12)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        bctx.fillStyle = g;
        bctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
      }
      bctx.restore();

      // hive-city lights on the night side (twinkled at draw time)
      cityLights = [];
      let guard = 0;
      while (cityLights.length < 46 && guard++ < 600) {
        const x = Math.random() * w;
        const y = h * (0.865 + Math.random() * 0.13);
        const dx = x - pcx, dy = y - pcy;
        if (dx * dx + dy * dy < pr * pr * 0.985) {
          cityLights.push({ x, y, tw: Math.random() * Math.PI * 2 });
        }
      }
    }

    function resize() {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintBackdrop();
    }
    resize();
    window.addEventListener("resize", resize);

    // ---- stars: three parallax depths, slow drift ----
    const starLayers = [
      { n: 90, size: 0.7, speed: 0.0000012, alpha: 0.5 },
      { n: 50, size: 1.1, speed: 0.0000028, alpha: 0.7 },
      { n: 22, size: 1.6, speed: 0.0000055, alpha: 0.9 },
    ].map((l) =>
      Array.from({ length: l.n }, () => ({
        x: Math.random(), y: Math.random() * 0.88,
        r: l.size * (0.6 + Math.random() * 0.8),
        tw: Math.random() * Math.PI * 2,
        speed: l.speed, alpha: l.alpha,
        warm: Math.random() < 0.25,
      }))
    );

    // ---- the fleets ----
    // Capital ships hold station on their side of the gulf, prows toward the
    // enemy, drifting ponderously at anchor.
    type Capital = {
      side: SideId; ax: number; ay: number;  // anchor
      size: number; ph: number; drift: number;
      x: number; y: number;
    };
    const capitals: Capital[] = [];
    function spawnCapital(side: SideId, ax: number, ay: number, size: number) {
      capitals.push({ side, ax, ay, size, ph: Math.random() * Math.PI * 2, drift: 0.012 + Math.random() * 0.02, x: ax, y: ay });
    }
    spawnCapital("loyalist", 0.13, 0.24, 68);
    spawnCapital("loyalist", 0.07, 0.52, 50);
    spawnCapital("loyalist", 0.17, 0.72, 40);
    spawnCapital("traitor", 0.87, 0.30, 68);
    spawnCapital("traitor", 0.93, 0.58, 50);
    spawnCapital("traitor", 0.83, 0.78, 40);

    // Fighter wings strafe across the gulf and bank back for another pass.
    type Fighter = {
      side: SideId; x: number; y: number; vx: number;
      wob: number; wobSp: number; wobAmp: number; baseY: number;
    };
    const fighters: Fighter[] = [];
    for (let i = 0; i < 7; i++) {
      fighters.push({
        side: "loyalist", x: Math.random() * 0.35, baseY: 0.12 + Math.random() * 0.72,
        y: 0, vx: 0.00006 + Math.random() * 0.00005,
        wob: Math.random() * Math.PI * 2, wobSp: 0.002 + Math.random() * 0.003, wobAmp: 0.015 + Math.random() * 0.03,
      });
      fighters.push({
        side: "traitor", x: 0.65 + Math.random() * 0.35, baseY: 0.12 + Math.random() * 0.72,
        y: 0, vx: -(0.00006 + Math.random() * 0.00005),
        wob: Math.random() * Math.PI * 2, wobSp: 0.002 + Math.random() * 0.003, wobAmp: 0.015 + Math.random() * 0.03,
      });
    }

    // ---- ordnance ----
    type Shell = { x0: number; y0: number; x1: number; y1: number; f: number; dur: number; delay: number; side: SideId };
    const shells: Shell[] = [];
    type Lance = { x0: number; y0: number; x1: number; y1: number; life: number; max: number; side: SideId };
    const lances: Lance[] = [];
    type Torpedo = { x: number; y: number; x1: number; y1: number; f: number; dur: number; side: SideId };
    const torpedoes: Torpedo[] = [];
    type Flare = { x: number; y: number; life: number; max: number; kind: "shield" | "hull" };
    const flares: Flare[] = [];
    type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number };
    const sparks: Spark[] = [];

    // tumbling wreckage
    const wrecks = Array.from({ length: 4 }, () => ({
      x: 0.3 + Math.random() * 0.4, y: 0.15 + Math.random() * 0.6,
      vx: (Math.random() - 0.5) * 0.000006, vy: (Math.random() - 0.5) * 0.000006,
      rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.0006,
      size: 4 + Math.random() * 7,
      pts: Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2;
        const rr = 0.5 + Math.random() * 0.6;
        return [Math.cos(a) * rr, Math.sin(a) * rr] as [number, number];
      }),
    }));

    function enemyCapital(side: SideId) {
      const pool = capitals.filter((c) => c.side !== side);
      return pool[Math.floor(Math.random() * pool.length)];
    }

    function fireBroadside(from: Capital) {
      const target = enemyCapital(from.side);
      if (!target) return;
      const count = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        shells.push({
          x0: from.x, y0: from.y + (Math.random() - 0.5) * 0.03,
          x1: target.x + (Math.random() - 0.5) * 0.04,
          y1: target.y + (Math.random() - 0.5) * 0.05,
          f: 0, dur: 1100 + Math.random() * 500, delay: i * (90 + Math.random() * 120),
          side: from.side,
        });
      }
    }

    function fireLance(from: Capital) {
      const target = enemyCapital(from.side);
      if (!target) return;
      lances.push({ x0: from.x, y0: from.y, x1: target.x, y1: target.y + (Math.random() - 0.5) * 0.04, life: 0, max: 26, side: from.side });
    }

    function fireTorpedo(from: Capital) {
      const target = enemyCapital(from.side);
      if (!target) return;
      torpedoes.push({ x: from.x, y: from.y, x1: target.x, y1: target.y, f: 0, dur: 4200 + Math.random() * 1600, side: from.side });
    }

    function impact(x: number, y: number, big: boolean) {
      // void shields catch most hits; some bite into the hull
      const hull = Math.random() < 0.3;
      flares.push({ x, y, life: 0, max: hull ? 22 : 16, kind: hull ? "hull" : "shield" });
      const n = hull ? (big ? 14 : 8) : 3;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 0.00002 + Math.random() * 0.00006;
        sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 24 + Math.random() * 20 });
      }
    }

    // ---- drawing ----
    function drawCapital(c: Capital, t: number) {
      const dir = c.side === "loyalist" ? 1 : -1;
      const x = c.x * w, y = c.y * h;
      const L = c.size, H = c.size * 0.2;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(dir, 1);

      // engine wake first, so the hull covers its root
      const wake = ctx.createLinearGradient(-L * 1.7, 0, -L * 0.9, 0);
      wake.addColorStop(0, "rgba(255,150,60,0)");
      wake.addColorStop(1, "rgba(255,170,80,0.25)");
      ctx.fillStyle = wake;
      ctx.fillRect(-L * 1.7, -H * 0.55, L * 0.8, H * 1.1);

      // hull: armored ram prow, long gothic midships, blocky stern
      ctx.fillStyle = "#161923";
      ctx.beginPath();
      ctx.moveTo(L, 0);
      ctx.lineTo(L * 0.55, -H * 0.62);
      ctx.lineTo(L * 0.1, -H * 0.8);
      ctx.lineTo(-L * 0.55, -H);
      ctx.lineTo(-L * 0.95, -H * 0.6);
      ctx.lineTo(-L, -H * 0.28);
      ctx.lineTo(-L, H * 0.28);
      ctx.lineTo(-L * 0.95, H * 0.6);
      ctx.lineTo(-L * 0.55, H);
      ctx.lineTo(L * 0.1, H * 0.8);
      ctx.lineTo(L * 0.55, H * 0.62);
      ctx.closePath();
      ctx.fill();

      // starlight rims the dorsal line so the silhouette reads against the void
      ctx.strokeStyle = "rgba(175,185,215,0.22)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(L, 0);
      ctx.lineTo(L * 0.55, -H * 0.62);
      ctx.lineTo(L * 0.1, -H * 0.8);
      ctx.lineTo(-L * 0.55, -H);
      ctx.lineTo(-L * 0.95, -H * 0.6);
      ctx.stroke();

      // dorsal spires — the cathedral ridge
      ctx.fillStyle = "#1d212c";
      const spires = 4;
      for (let i = 0; i < spires; i++) {
        const sx = -L * 0.55 + (i / (spires - 1)) * L * 0.65;
        const sh = H * (0.7 + (i % 2) * 0.5);
        ctx.beginPath();
        ctx.moveTo(sx - L * 0.035, -H * 0.7);
        ctx.lineTo(sx, -H * 0.7 - sh);
        ctx.lineTo(sx + L * 0.035, -H * 0.7);
        ctx.closePath();
        ctx.fill();
      }
      // command bridge tower astern
      ctx.fillRect(-L * 0.78, -H * 1.5, L * 0.12, H * 1.0);
      ctx.beginPath();
      ctx.moveTo(-L * 0.72, -H * 1.5);
      ctx.lineTo(-L * 0.72, -H * 2.05);
      ctx.lineTo(-L * 0.7, -H * 1.5);
      ctx.closePath();
      ctx.fill();

      // prow trim catches the enemy's light
      ctx.strokeStyle = tint(c.side, 0.4);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(L, 0);
      ctx.lineTo(L * 0.55, -H * 0.62);
      ctx.moveTo(L, 0);
      ctx.lineTo(L * 0.55, H * 0.62);
      ctx.stroke();

      // engines
      for (const ey of [-0.32, 0.32]) {
        const g = ctx.createRadialGradient(-L, ey * H, 0, -L, ey * H, H * 0.5);
        g.addColorStop(0, "rgba(255,190,110,0.9)");
        g.addColorStop(1, "rgba(255,120,40,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(-L, ey * H, H * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // running lights blink along the hull
      for (let i = 0; i < 4; i++) {
        const lx = -L * 0.7 + i * L * 0.42;
        const blink = Math.sin(t * 0.0016 + c.ph + i * 1.7);
        ctx.fillStyle = tint(c.side, blink > 0.55 ? 0.85 : 0.12);
        ctx.fillRect(lx, -1, 1.6, 1.6);
      }
      ctx.restore();
    }

    function drawFighter(f: Fighter) {
      const dir = f.vx >= 0 ? 1 : -1;
      const x = f.x * w, y = f.y * h;
      const s = 4;
      // engine trail
      const tg = ctx.createLinearGradient(x - dir * s * 4, y, x - dir * s, y);
      tg.addColorStop(0, tint(f.side, 0));
      tg.addColorStop(1, tint(f.side, 0.35));
      ctx.strokeStyle = tg;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - dir * s * 4, y);
      ctx.lineTo(x - dir * s, y);
      ctx.stroke();
      // dart hull
      ctx.fillStyle = "#1a1d24";
      ctx.beginPath();
      ctx.moveTo(x + dir * s, y);
      ctx.lineTo(x - dir * s * 0.8, y - s * 0.55);
      ctx.lineTo(x - dir * s * 0.4, y);
      ctx.lineTo(x - dir * s * 0.8, y + s * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = tint(f.side, 0.9);
      ctx.fillRect(x - dir * s * 0.6 - 0.8, y - 0.8, 1.6, 1.6);
    }

    let last = performance.now();
    let raf = 0;
    let broadsideTimer = 600;
    let lanceTimer = 3000;
    let torpedoTimer = 6000;

    function frame(now: number) {
      const dt = Math.min(now - last, 60);
      last = now;

      // backdrop (nebula + planet)
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(backdrop, 0, 0, w, h);

      // ---- side-color edges (brighten toward the winner) ----
      const b = balanceRef.current;
      const lead = Math.max(-1, Math.min(1, b / 400));
      const loyalStrength = 0.08 + Math.max(0, lead) * 0.3;
      const traitorStrength = 0.08 + Math.max(0, -lead) * 0.3;
      const gL = ctx.createLinearGradient(0, 0, w * 0.4, 0);
      gL.addColorStop(0, tint("loyalist", loyalStrength));
      gL.addColorStop(1, tint("loyalist", 0));
      ctx.fillStyle = gL;
      ctx.fillRect(0, 0, w * 0.4, h);
      const gR = ctx.createLinearGradient(w, 0, w * 0.6, 0);
      gR.addColorStop(0, tint("traitor", traitorStrength));
      gR.addColorStop(1, tint("traitor", 0));
      ctx.fillStyle = gR;
      ctx.fillRect(w * 0.6, 0, w * 0.4, h);

      // ---- stars (parallax drift + twinkle) ----
      for (const layer of starLayers) {
        for (const s of layer) {
          if (!reduce) {
            s.x -= s.speed * dt;
            if (s.x < -0.01) s.x += 1.02;
          }
          s.tw += 0.018;
          const a = s.alpha * (0.55 + Math.sin(s.tw) * 0.35);
          ctx.fillStyle = s.warm ? `rgba(235,215,180,${a})` : `rgba(210,220,240,${a})`;
          ctx.beginPath();
          ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ---- city lights on the night side ----
      for (const cl of cityLights) {
        cl.tw += 0.01;
        ctx.fillStyle = `rgba(220,180,110,${0.25 + Math.sin(cl.tw) * 0.15})`;
        ctx.fillRect(cl.x, cl.y, 1.2, 1.2);
      }

      // ---- wreckage ----
      for (const wk of wrecks) {
        if (!reduce) {
          wk.x += wk.vx * dt; wk.y += wk.vy * dt; wk.rot += wk.vr * dt * 0.06;
          if (wk.x < 0.05 || wk.x > 0.95) wk.vx *= -1;
          if (wk.y < 0.05 || wk.y > 0.8) wk.vy *= -1;
        }
        ctx.save();
        ctx.translate(wk.x * w, wk.y * h);
        ctx.rotate(wk.rot);
        ctx.fillStyle = "#14161d";
        ctx.beginPath();
        wk.pts.forEach(([px, py], i) => {
          if (i === 0) ctx.moveTo(px * wk.size, py * wk.size);
          else ctx.lineTo(px * wk.size, py * wk.size);
        });
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // ---- fleet movement ----
      if (!reduce) {
        for (const c of capitals) {
          c.ph += 0.0004 * dt;
          c.x = c.ax + Math.sin(c.ph) * c.drift * 0.5;
          c.y = c.ay + Math.sin(c.ph * 0.7) * c.drift;
        }
        for (const f of fighters) {
          f.x += f.vx * dt;
          f.wob += f.wobSp * dt;
          f.y = f.baseY + Math.sin(f.wob) * f.wobAmp;
          // bank and come around for another pass
          if (f.side === "loyalist") {
            if (f.vx > 0 && f.x > 0.88) f.vx *= -1;
            if (f.vx < 0 && f.x < 0.04) { f.vx *= -1; f.baseY = 0.12 + Math.random() * 0.72; }
          } else {
            if (f.vx < 0 && f.x < 0.12) f.vx *= -1;
            if (f.vx > 0 && f.x > 0.96) { f.vx *= -1; f.baseY = 0.12 + Math.random() * 0.72; }
          }
        }

        // ---- gunnery orders ----
        broadsideTimer -= dt;
        if (broadsideTimer <= 0) {
          broadsideTimer = 650 + Math.random() * 900;
          fireBroadside(capitals[Math.floor(Math.random() * capitals.length)]);
        }
        lanceTimer -= dt;
        if (lanceTimer <= 0) {
          lanceTimer = 4500 + Math.random() * 4000;
          fireLance(capitals[Math.floor(Math.random() * capitals.length)]);
        }
        torpedoTimer -= dt;
        if (torpedoTimer <= 0) {
          torpedoTimer = 8000 + Math.random() * 7000;
          fireTorpedo(capitals[Math.floor(Math.random() * capitals.length)]);
        }
      }

      // ---- ships ----
      for (const c of capitals) drawCapital(c, now);
      for (const f of fighters) drawFighter(f);

      // ---- macro shells ----
      for (let i = shells.length - 1; i >= 0; i--) {
        const s = shells[i];
        if (s.delay > 0) { s.delay -= dt; continue; }
        s.f += dt / s.dur;
        if (s.f >= 1) {
          impact(s.x1, s.y1, false);
          shells.splice(i, 1);
          continue;
        }
        const fx = s.x0 + (s.x1 - s.x0) * s.f;
        const fy = s.y0 + (s.y1 - s.y0) * s.f;
        const bx = s.x0 + (s.x1 - s.x0) * Math.max(0, s.f - 0.05);
        const by = s.y0 + (s.y1 - s.y0) * Math.max(0, s.f - 0.05);
        ctx.strokeStyle = s.side === "loyalist" ? "rgba(255,224,160,0.85)" : "rgba(255,140,100,0.85)";
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(bx * w, by * h);
        ctx.lineTo(fx * w, fy * h);
        ctx.stroke();
        // muzzle flash at the start of the shot
        if (s.f < 0.05) {
          ctx.fillStyle = "rgba(255,230,180,0.5)";
          ctx.beginPath();
          ctx.arc(s.x0 * w, s.y0 * h, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ---- lance beams ----
      for (let i = lances.length - 1; i >= 0; i--) {
        const l = lances[i];
        l.life += dt / 16;
        const f = l.life / l.max;
        if (f >= 1) {
          impact(l.x1, l.y1, true);
          lances.splice(i, 1);
          continue;
        }
        const a = Math.sin(f * Math.PI); // swell and die
        const core = l.side === "loyalist" ? `rgba(255,240,200,${0.85 * a})` : `rgba(255,170,150,${0.85 * a})`;
        ctx.strokeStyle = tint(l.side, 0.18 * a);
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(l.x0 * w, l.y0 * h);
        ctx.lineTo(l.x1 * w, l.y1 * h);
        ctx.stroke();
        ctx.strokeStyle = core;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(l.x0 * w, l.y0 * h);
        ctx.lineTo(l.x1 * w, l.y1 * h);
        ctx.stroke();
      }

      // ---- torpedoes ----
      for (let i = torpedoes.length - 1; i >= 0; i--) {
        const tp = torpedoes[i];
        tp.f += dt / tp.dur;
        if (tp.f >= 1) {
          impact(tp.x1, tp.y1, true);
          flares.push({ x: tp.x1, y: tp.y1, life: 0, max: 26, kind: "hull" });
          torpedoes.splice(i, 1);
          continue;
        }
        const fx = tp.x + (tp.x1 - tp.x) * tp.f;
        const fy = tp.y + (tp.y1 - tp.y) * tp.f + Math.sin(tp.f * 18) * 0.004;
        const tx = tp.x + (tp.x1 - tp.x) * Math.max(0, tp.f - 0.06);
        const ty = tp.y + (tp.y1 - tp.y) * Math.max(0, tp.f - 0.06);
        const tg = ctx.createLinearGradient(tx * w, ty * h, fx * w, fy * h);
        tg.addColorStop(0, "rgba(255,170,80,0)");
        tg.addColorStop(1, "rgba(255,190,110,0.5)");
        ctx.strokeStyle = tg;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tx * w, ty * h);
        ctx.lineTo(fx * w, fy * h);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,210,140,0.95)";
        ctx.beginPath();
        ctx.arc(fx * w, fy * h, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // ---- impact flares ----
      for (let i = flares.length - 1; i >= 0; i--) {
        const fl = flares[i];
        fl.life += dt / 16;
        const f = fl.life / fl.max;
        if (f >= 1) { flares.splice(i, 1); continue; }
        if (fl.kind === "shield") {
          // void shield: an oily ellipse of displaced light
          ctx.strokeStyle = `rgba(150,190,255,${(1 - f) * 0.55})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.ellipse(fl.x * w, fl.y * h, 4 + f * 22, (4 + f * 22) * 0.62, 0.4, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          const r = 2 + f * 16;
          const g = ctx.createRadialGradient(fl.x * w, fl.y * h, 0, fl.x * w, fl.y * h, r);
          g.addColorStop(0, `rgba(255,220,150,${(1 - f) * 0.9})`);
          g.addColorStop(0.5, `rgba(255,130,60,${(1 - f) * 0.5})`);
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(fl.x * w, fl.y * h, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ---- sparks ----
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i];
        sp.life += dt / 16;
        const f = sp.life / sp.max;
        if (f >= 1) { sparks.splice(i, 1); continue; }
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        ctx.fillStyle = `rgba(255,190,120,${(1 - f) * 0.8})`;
        ctx.fillRect(sp.x * w, sp.y * h, 1.2, 1.2);
      }

      raf = requestAnimationFrame(frame);
    }

    if (reduce) {
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
