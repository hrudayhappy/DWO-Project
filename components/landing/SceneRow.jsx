"use client";
// Three scene cards for the current region. One WebGL canvas sits over the row and draws each
// scene into its card's window, so the page holds a single graphics context.
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

const STILL_AT = 9;       // seconds into a scene when everything has assembled
const STAGGER = 0.35;     // each card starts a little after the one before

export default function SceneRow({ regime }) {
  const rowRef = useRef(null), canvasRef = useRef(null), viewRefs = useRef([]), cardRefs = useRef([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(true);
  const e = useRef({ mod: null, r: null, scenes: [], t: [0, 0, 0], last: 0, raf: 0, inView: true, reduce: false, rects: [], W: 0, H: 0, dirty: 0 }).current;
  const live = useRef(playing); live.current = playing;

  function measure() {
    const row = rowRef.current; if (!row || !e.r) return;
    const W = row.clientWidth, H = row.clientHeight; if (!W || !H) return;
    const rr = row.getBoundingClientRect();
    e.W = W; e.H = H;
    e.r.setSize(W, H, false);
    e.rects = viewRefs.current.map((v) => { if (!v) return null; const b = v.getBoundingClientRect(); return { x: b.left - rr.left, y: b.top - rr.top, w: b.width, h: b.height }; });
    e.scenes.forEach((s, i) => { const r = e.rects[i]; if (s && r) e.mod.fit(s, r.w, r.h); });
    drawAll(); e.dirty = 4;
  }

  function syncBullets() {
    e.scenes.forEach((s, i) => {
      const card = cardRefs.current[i]; if (!card) return;
      const t = e.reduce ? STILL_AT : e.t[i];
      card.querySelectorAll("[data-t0]").forEach((li) => li.classList.toggle("on", t >= +li.dataset.t0));
    });
  }

  function drawAll() {
    const r = e.r; if (!r || !e.W) return;
    r.setScissorTest(false); r.clear(); r.setScissorTest(true);
    e.scenes.forEach((s, i) => {
      const b = e.rects[i]; if (!s || !b) return;
      const y = e.H - b.y - b.h;
      r.setViewport(b.x, y, b.w, b.h); r.setScissor(b.x, y, b.w, b.h);
      e.mod.draw(r, s, e.reduce ? STILL_AT : Math.max(0, e.t[i]));
    });
    syncBullets();
  }

  useEffect(() => {
    let alive = true, ro, io;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    e.reduce = mq.matches;
    const onMq = () => { e.reduce = mq.matches; e.dirty = 4; };
    mq.addEventListener?.("change", onMq);
    import("./scenes").then((mod) => {
      if (!alive) return;
      e.mod = mod;
      try { e.r = mod.createRenderer(canvasRef.current, Math.min(window.devicePixelRatio || 1, 2)); }
      catch { setFailed(true); return; }
      ro = new ResizeObserver(() => measure()); ro.observe(rowRef.current);
      io = new IntersectionObserver(([en]) => { e.inView = en.isIntersecting; }, { threshold: 0.02 }); io.observe(rowRef.current);
      setReady(true);
      const frame = (now) => {
        e.raf = requestAnimationFrame(frame);
        const dt = Math.min(0.1, (now - (e.last || now)) / 1000); e.last = now;
        const running = e.scenes.length && !e.reduce && e.inView && !document.hidden && live.current;
        if (running) { for (let i = 0; i < 3; i++) e.t[i] += dt; drawAll(); }
        else if (e.dirty > 0) { e.dirty--; drawAll(); }
      };
      e.raf = requestAnimationFrame(frame);
    }).catch(() => setFailed(true));
    return () => {
      alive = false; cancelAnimationFrame(e.raf); ro?.disconnect(); io?.disconnect(); mq.removeEventListener?.("change", onMq);
      e.scenes.forEach((s) => e.mod?.disposeScene(s)); e.scenes = [];
      e.r?.dispose(); e.r = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New region: build its three scenes and start them in a cascade.
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const old = e.scenes;
      e.scenes = regime.cards.map((c) => e.mod.buildScene(c.code));
      old.forEach((s) => e.mod.disposeScene(s));
      e.t = [0, -STAGGER, -2 * STAGGER];
      measure();
    }, 40);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, regime.key]);

  function replay(i) { e.t[i] = 0; if (!live.current) setPlaying(true); drawAll(); e.dirty = 4; }

  return (
    <section className="lx-scenes" aria-label={`${regime.name}: how the organisation looks`}>
      <div className="lx-scenes-head">
        <p className="lx-regime"><i aria-hidden="true" /><b>{regime.name}</b><span>What the organisation looks like</span></p>
        {!failed && (
          <button type="button" className="lx-ghost" onClick={() => setPlaying((p) => !p)} aria-pressed={!playing}>
            {playing ? <Pause size={13} strokeWidth={2.2} aria-hidden="true" /> : <Play size={13} strokeWidth={2.2} aria-hidden="true" />}
            {playing ? "Pause" : "Play"}
          </button>
        )}
      </div>
      <div className="lx-cards" ref={rowRef}>
        <canvas ref={canvasRef} className="lx-canvas" aria-hidden="true" />
        {regime.cards.map((c, i) => (
          <article className="lx-card" key={`${regime.key}-${c.code}`} ref={(el) => (cardRefs.current[i] = el)} style={{ "--i": i }}>
            <header>
              <span className="lx-chip"><i aria-hidden="true" />{c.kind}</span>
              {!failed && (
                <button type="button" className="lx-icon" onClick={() => replay(i)} aria-label={`Replay ${c.title}`}>
                  <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
                </button>
              )}
            </header>
            <div className={`lx-view ${failed ? "failed" : ""}`} ref={(el) => (viewRefs.current[i] = el)} />
            <h3>{c.title}</h3>
            <ul>
              {c.bullets.map(([text, t0]) => <li key={text} data-t0={t0}>{text}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
