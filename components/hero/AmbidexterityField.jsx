"use client";
// Landing-page animation: the exploration/exploitation balance as a particle field.
// Left of the divider particles search freely (exploration); right of it they are picked up
// into lanes and flow steadily (exploitation). Particles that reach the far edge reappear on the
// exploring side as a new search. The divider follows the pointer, or drifts on its own when idle.
import { useEffect, useRef } from "react";

const EXPLORE = "197, 90, 17"; // --orange
const EXPLOIT = "31, 56, 100"; // --navy
const LANES = 9;

function verdict(share) {
  if (share < 0.25) return ["Success trap", "Refining what already works, with little search for what comes next."];
  if (share < 0.4) return ["Leaning on exploitation", "Efficiency first, with some room for new ideas."];
  if (share <= 0.6) return ["Ambidextrous", "Exploring and exploiting at the same time, and linking the two."];
  if (share <= 0.75) return ["Leaning on exploration", "Plenty of search, but fewer ideas reach steady use."];
  return ["Failure trap", "Constant search, and little of it is ever put to use."];
}

export default function AmbidexterityField() {
  const boxRef = useRef(null);
  const canvasRef = useRef(null);
  const shareRef = useRef(null);
  const titleRef = useRef(null);
  const lineRef = useRef(null);

  useEffect(() => {
    const box = boxRef.current, canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0, dpr = 1, parts = [], d = 0, target = 0.5, t = 0;
    let pointerAt = null, lastPointer = -1e9, running = false, visible = true, raf = 0, lastText = 0, lastTs = 0;

    const laneY = (i) => H * 0.14 + ((i + 0.5) * (H * 0.72)) / LANES;
    const spawnExplore = (p) => {
      p.x = Math.random() * Math.max(d - 6, 4); p.y = 14 + Math.random() * (H - 28);
      p.a = Math.random() * Math.PI * 2; p.vx = 0; p.vy = 0; p.lane = -1;
    };

    function resize() {
      const r = box.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const oldW = W || r.width;
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = "100%"; canvas.style.height = "100%";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(520, Math.max(180, (W * H) / 620)));
      if (!parts.length) {
        d = W * 0.5;
        parts = Array.from({ length: n }, () => {
          const p = { x: 0, y: 0, vx: 0, vy: 0, a: 0, lane: -1, s: 0.85 + Math.random() * 0.35, r: 1.4 + Math.random() * 0.9 };
          if (Math.random() < 0.5) spawnExplore(p); else { p.x = d + Math.random() * (W - d); p.lane = (Math.random() * LANES) | 0; p.y = laneY(p.lane); p.vx = 1.1; }
          return p;
        });
      } else {
        const k = W / oldW; d *= k; for (const p of parts) p.x *= k;
        parts.length = Math.min(parts.length, n);
      }
    }

    function step(dt) {
      t += dt;
      // Divider: follow the pointer, otherwise sweep slowly between the two traps.
      const idle = performance.now() - lastPointer > 3500;
      const goal = idle && !reduce ? 0.5 + 0.33 * Math.sin(t / 2300) : target;
      if (!idle || reduce) target = goal;
      d += (goal * W - d) * Math.min(1, 0.06 * dt / 16.7);
      for (const p of parts) {
        if (p.x < d) {
          // exploration: a wandering search with a slight drift towards the divide
          p.lane = -1;
          p.a += (Math.random() - 0.5) * 0.55;
          p.vx = (p.vx + Math.cos(p.a) * 0.07 + 0.011) * 0.955;
          p.vy = (p.vy + Math.sin(p.a) * 0.07) * 0.955;
          if (p.y < 10 || p.y > H - 10) { p.vy *= -1; p.a = -p.a; p.y = Math.min(H - 10, Math.max(10, p.y)); }
          if (p.x < 3) { p.vx = Math.abs(p.vx); p.a = 0; }
        } else {
          // exploitation: picked up into the nearest lane, steady flow to the right
          if (p.lane < 0) { let best = 0, bd = 1e9; for (let i = 0; i < LANES; i++) { const dd = Math.abs(laneY(i) - p.y); if (dd < bd) { bd = dd; best = i; } } p.lane = best; }
          const ly = laneY(p.lane);
          p.vy = (p.vy + (ly - p.y) * 0.03) * 0.78;
          p.vx += (0.8 * p.s - p.vx) * 0.08;
          if (p.x > W + 6) { if (d > 12) spawnExplore(p); else { p.x = d + 1; } }
        }
        p.x += p.vx * dt / 16.7; p.y += p.vy * dt / 16.7;
      }
    }

    function wobbleLine(x, seed) {
      ctx.beginPath();
      for (let y = 0; y <= H; y += 12) {
        const wx = x + Math.sin(y * 0.045 + seed) * 1.6 + Math.sin(y * 0.13 + seed * 2) * 0.8;
        y === 0 ? ctx.moveTo(wx, y) : ctx.lineTo(wx, y);
      }
      ctx.stroke();
    }

    function draw(trails) {
      if (trails) { ctx.fillStyle = "rgba(251, 252, 254, 0.3)"; ctx.fillRect(0, 0, W, H); }
      else { ctx.fillStyle = "#fbfcfe"; ctx.fillRect(0, 0, W, H); }
      const share = d / W, balanced = Math.abs(share - 0.5) <= 0.1;
      // lanes on the exploiting side
      ctx.setLineDash([3, 7]); ctx.lineWidth = 1; ctx.strokeStyle = `rgba(${EXPLOIT}, 0.10)`;
      for (let i = 0; i < LANES; i++) { ctx.beginPath(); ctx.moveTo(d + 6, laneY(i)); ctx.lineTo(W, laneY(i)); ctx.stroke(); }
      ctx.setLineDash([]);
      // links across the divide when the balance is ambidextrous
      if (balanced) {
        const near = parts.filter((p) => Math.abs(p.x - d) < 90);
        const left = near.filter((p) => p.x < d), right = near.filter((p) => p.x >= d);
        const strength = 1 - Math.abs(share - 0.5) / 0.1;
        ctx.lineWidth = 1.2;
        for (const a of left) {
          let best = null, bd = 72 * 72;
          for (const b of right) { const dx = a.x - b.x, dy = a.y - b.y, q = dx * dx + dy * dy; if (q < bd) { bd = q; best = b; } }
          if (best) { ctx.strokeStyle = `rgba(84, 130, 53, ${0.75 * strength * (1 - Math.sqrt(bd) / 72)})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(best.x, best.y); ctx.stroke(); }
        }
      }
      // particles
      for (const p of parts) {
        if (p.x < d) {
          ctx.fillStyle = `rgba(${EXPLORE}, 0.85)`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.strokeStyle = `rgba(${EXPLOIT}, 0.9)`; ctx.lineWidth = p.r * 1.1; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(p.x - 5 * p.s, p.y); ctx.lineTo(p.x + 1, p.y); ctx.stroke();
        }
      }
      // the divide
      ctx.lineWidth = balanced ? 2.2 : 1.6;
      ctx.strokeStyle = balanced ? "rgba(84, 130, 53, 0.9)" : "rgba(30, 30, 30, 0.55)";
      wobbleLine(d, 1.3);
    }

    function updateText(force) {
      const now = performance.now();
      if (!force && now - lastText < 120) return;
      lastText = now;
      const share = Math.round((d / W) * 100);
      const [title, line] = verdict(d / W);
      shareRef.current.textContent = `Exploration ${share}%  ·  Exploitation ${100 - share}%`;
      if (titleRef.current.textContent !== title) {
        titleRef.current.textContent = title; lineRef.current.textContent = line;
        box.dataset.state = title === "Ambidextrous" ? "balanced" : /trap/.test(title) ? "trap" : "lean";
      }
      box.setAttribute("aria-valuenow", String(share));
      box.setAttribute("aria-valuetext", `${share}% exploration: ${title}`);
    }

    function frame(ts) {
      const dt = Math.min(48, lastTs ? ts - lastTs : 16.7); lastTs = ts;
      step(dt); draw(true); updateText(false);
      raf = running ? requestAnimationFrame(frame) : 0;
    }
    function start() { if (reduce || running || !visible || document.hidden) return; running = true; lastTs = 0; raf = requestAnimationFrame(frame); }
    function stop() { running = false; cancelAnimationFrame(raf); }
    function still() { for (let i = 0; i < 260; i++) step(16.7); draw(false); updateText(true); }

    function setFromX(clientX) {
      const r = box.getBoundingClientRect();
      target = Math.min(0.97, Math.max(0.03, (clientX - r.left) / r.width));
      lastPointer = performance.now();
      if (reduce) { d = target * W; still(); }
    }
    const onMove = (e) => { if (e.pointerType === "mouse" || e.buttons) setFromX(e.clientX); };
    const onDown = (e) => setFromX(e.clientX);
    const onKey = (e) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
      e.preventDefault();
      const cur = target;
      target = e.key === "Home" ? 0.05 : e.key === "End" ? 0.95 : Math.min(0.95, Math.max(0.05, cur + (e.key === "ArrowRight" ? 0.05 : -0.05)));
      lastPointer = performance.now() + 6000; // keyboard choice holds longer
      if (reduce) { d = target * W; still(); }
    };

    resize();
    if (reduce) still(); else { draw(false); start(); }
    const ro = new ResizeObserver(() => { resize(); if (reduce) still(); });
    ro.observe(box);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); });
    io.observe(box);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    box.addEventListener("pointermove", onMove);
    box.addEventListener("pointerdown", onDown);
    box.addEventListener("keydown", onKey);
    return () => {
      stop(); ro.disconnect(); io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      box.removeEventListener("pointermove", onMove);
      box.removeEventListener("pointerdown", onDown);
      box.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <figure className="field">
      <div
        ref={boxRef}
        className="field-box"
        tabIndex={0}
        role="slider"
        aria-label="Balance between exploration and exploitation"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={50}
        data-state="balanced"
      >
        <canvas ref={canvasRef} aria-hidden="true" />
        <span className="field-tag explore">explore</span>
        <span className="field-tag exploit">exploit</span>
      </div>
      <figcaption className="field-read">
        <span className="field-verdict"><b ref={titleRef}>Ambidextrous</b> <span ref={lineRef}>Exploring and exploiting at the same time, and linking the two.</span></span>
        <span className="field-share" ref={shareRef}>Exploration 50%  ·  Exploitation 50%</span>
        <span className="field-hint">Move or drag across the field, or use the arrow keys, to shift the balance.</span>
      </figcaption>
    </figure>
  );
}
