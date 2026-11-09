"use client";
// The animation stage: one WebGL canvas, notes in columns on either side joined to the
// scene by leader lines, a caption, and tabs that move through the regime's scenes.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

const STILL_AT = 7; // seconds into a scene when everything has assembled

function sizeFor(W) {
  const narrow = W < 620;
  const side = narrow ? 0 : Math.round(Math.min(134, Math.max(110, W * 0.165)));
  const H = narrow ? Math.round(W * 0.66) : Math.round(Math.min(420, Math.max(320, W * 0.5)));
  return { narrow, side, H };
}

export default function Stage({ regime }) {
  const viewRef = useRef(null), boxRef = useRef(null), canvasRef = useRef(null), svgRef = useRef(null), notesRef = useRef(null), barRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState(0);
  const [auto, setAuto] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [notes, setNotes] = useState({ key: "", list: [] });
  const [narrow, setNarrow] = useState(false);
  const [thumbs, setThumbs] = useState({});
  const e = useRef({ mod: null, r: null, s: null, t: 0, last: 0, raf: 0, inView: true, reduce: false, W: 0, H: 0, side: 0, shown: -1 }).current;
  const live = useRef({ auto, playing }); live.current = { auto, playing };

  const scenes = regime.scenes;
  const idx = Math.min(tab, scenes.length - 1);
  const [code, kind, title, text] = scenes[idx];

  // Notes that should be visible at time t; leaders and text draw in as t passes each note's t0.
  function syncNotes(t) {
    const s = e.s; if (!s) return;
    const n = e.reduce ? s.notes.length : s.notes.filter((x) => t >= x.t0).length;
    if (n === e.shown) return;
    e.shown = n;
    const els = notesRef.current?.children || [];
    const order = s.notes.map((x, i) => [x.t0, i]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    const on = new Set(order.slice(0, n));
    [...els].forEach((el, i) => el.classList.toggle("on", on.has(i)));
    svgRef.current?.querySelectorAll("[data-i]").forEach((el) => el.classList.toggle("on", on.has(+el.dataset.i)));
  }

  // Place notes in the left and right columns near the height of what they point to, without overlaps.
  function layoutNotes() {
    const s = e.s, box = notesRef.current, svg = svgRef.current;
    if (!s || !box || !svg || !e.W) return;
    const els = [...box.children];
    if (e.side === 0 || els.length !== s.notes.length) { svg.innerHTML = ""; els.forEach((el) => { el.style.cssText = ""; }); e.shown = -1; syncNotes(e.t); return; }
    const { W, H, side } = e, gap = 10, lead = 8;
    els.forEach((el) => { el.style.width = `${side - 18}px`; });
    const items = s.notes.map((n, i) => {
      const p = e.mod.project(s, n.at);
      return { i, p, side: n.side ?? (p.x < W / 2 ? "left" : "right"), el: els[i], h: els[i].offsetHeight };
    });
    let paths = "";
    for (const sd of ["left", "right"]) {
      const col = items.filter((it) => it.side === sd).sort((a, b) => a.p.y - b.p.y);
      // first pass: as close to the anchor as possible, pushing down past the note above
      let y = 6;
      col.forEach((it) => { it.top = Math.max(y, it.p.y - lead); y = it.top + it.h + gap; });
      // second pass: if the column runs off the bottom, push back up
      let limit = H - 6;
      for (let k = col.length - 1; k >= 0; k--) { const it = col[k]; if (it.top + it.h > limit) it.top = Math.max(6, limit - it.h); limit = it.top - gap; }
      col.forEach((it) => {
        it.el.dataset.side = sd;
        it.el.style.top = `${it.top}px`;
        it.el.style.left = sd === "left" ? "0px" : "";
        it.el.style.right = sd === "right" ? "0px" : "";
        const x0 = sd === "left" ? side - 10 : W - side + 10, y0 = it.top + lead;
        const x1 = sd === "left" ? x0 + 14 : x0 - 14;
        const { x, y: ay } = it.p;
        const d = `M${x0.toFixed(1)} ${y0.toFixed(1)}H${x1.toFixed(1)}L${x.toFixed(1)} ${ay.toFixed(1)}`;
        paths += `<g data-i="${it.i}" class="ld-lead"><path class="ld-halo" pathLength="1" d="${d}"/><path pathLength="1" d="${d}"/>` +
          `<circle class="ld-dot" cx="${x0.toFixed(1)}" cy="${y0.toFixed(1)}" r="2"/><circle class="ld-pin" cx="${x.toFixed(1)}" cy="${ay.toFixed(1)}" r="3.4"/></g>`;
      });
    }
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = paths;
    e.shown = -1; syncNotes(e.t);
  }

  function resize() {
    const view = viewRef.current; if (!view || !e.r) return;
    const W = Math.round(view.clientWidth); if (!W) return;
    const { narrow: nw, side, H } = sizeFor(W);
    e.W = W; e.H = H; e.side = side;
    boxRef.current.style.height = `${H}px`;
    e.r.setSize(W, H, false);
    setNarrow(nw);
    if (e.s) { e.mod.fit(e.s, W, H, { side }); layoutNotes(); drawNow(); }
  }

  function drawNow() { if (e.s && e.r) e.mod.draw(e.r, e.s, e.reduce ? STILL_AT : e.t); }

  // Engine: load three.js, create the renderer, run the frame loop. Paused off screen and in background tabs.
  useEffect(() => {
    let alive = true, ro, io;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    e.reduce = mq.matches;
    const onMq = () => { e.reduce = mq.matches; e.shown = -1; syncNotes(e.t); drawNow(); };
    mq.addEventListener?.("change", onMq);
    import("./scenes").then((mod) => {
      if (!alive) return;
      e.mod = mod;
      try { e.r = mod.createRenderer(canvasRef.current, Math.min(window.devicePixelRatio || 1, 2)); }
      catch { setFailed(true); return; }
      ro = new ResizeObserver(() => resize()); ro.observe(viewRef.current);
      io = new IntersectionObserver(([en]) => { e.inView = en.isIntersecting; }, { threshold: 0.05 }); io.observe(viewRef.current);
      setReady(true);
      const frame = (now) => {
        e.raf = requestAnimationFrame(frame);
        const dt = Math.min(0.1, (now - (e.last || now)) / 1000); e.last = now;
        if (!e.s || e.reduce || !e.inView || document.hidden || !live.current.playing) return;
        e.t += dt;
        mod.draw(e.r, e.s, e.t);
        syncNotes(e.t);
        if (barRef.current) barRef.current.style.transform = `scaleX(${Math.min(1, e.t / e.s.hold)})`;
        if (live.current.auto && e.t > e.s.hold && !e.advancing) { e.advancing = true; setTab((i) => i + 1); }
      };
      e.raf = requestAnimationFrame(frame);
    }).catch(() => setFailed(true));
    return () => {
      alive = false; cancelAnimationFrame(e.raf); ro?.disconnect(); io?.disconnect(); mq.removeEventListener?.("change", onMq);
      if (e.mod) e.mod.disposeScene(e.s);
      e.s = null; e.r?.dispose(); e.r = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New regime: back to its first scene, auto-advance on again.
  useEffect(() => { setTab(0); setAuto(true); }, [regime.key]);

  // Wrap the tab index once auto-advance runs past the last scene.
  useEffect(() => { if (tab >= scenes.length) setTab(0); }, [tab, scenes.length]);

  // Build the scene for the current tab and theme.
  useEffect(() => {
    if (!ready || tab >= scenes.length) return;
    const timer = setTimeout(() => {
      const old = e.s;
      e.s = e.mod.buildScene(code, regime.key);
      e.t = 0; e.shown = -1; e.advancing = false;
      e.mod.disposeScene(old);
      if (e.W) e.mod.fit(e.s, e.W, e.H, { side: e.side });
      setNotes({ key: `${regime.key}-${code}`, list: e.s.notes.map((n) => ({ title: n.title, sub: n.sub })) });
      drawNow();
    }, 60);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, code, regime.key]);

  // Once the note elements exist, measure and place them.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { layoutNotes(); }, [notes, narrow]);

  // Still images for the tabs, made when the browser is idle.
  useEffect(() => {
    if (!ready) return;
    const names = scenes.map((s) => s[0]);
    const run = () => { try { setThumbs(e.mod.thumbnails(names, regime.key)); } catch { /* tabs keep their labels */ } };
    const id = "requestIdleCallback" in window ? window.requestIdleCallback(run, { timeout: 1500 }) : setTimeout(run, 400);
    return () => ("cancelIdleCallback" in window ? window.cancelIdleCallback(id) : clearTimeout(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, regime.key]);

  function pick(i) { setAuto(false); setTab(i); }
  function onTabKey(ev) {
    const d = ev.key === "ArrowRight" ? 1 : ev.key === "ArrowLeft" ? -1 : 0; if (!d) return;
    ev.preventDefault(); const n = (idx + d + scenes.length) % scenes.length; pick(n);
    ev.currentTarget.parentElement.children[n]?.focus();
  }

  return (
    <div className="ld-stage">
      <div className="ld-stage-head">
        <span className="ld-regime"><i aria-hidden="true" />{regime.name}</span>
        {!failed && (
          <button type="button" className="ld-pause" onClick={() => setPlaying((p) => !p)} aria-pressed={!playing} aria-label={playing ? "Pause the animation" : "Play the animation"}>
            {playing ? <Pause size={13} strokeWidth={2.4} /> : <Play size={13} strokeWidth={2.4} />}
            <span>{playing ? "Pause" : "Play"}</span>
          </button>
        )}
      </div>
      <div className={`ld-view ${narrow ? "narrow" : ""} ${failed ? "failed" : ""}`} ref={viewRef} id="ld-panel" role="tabpanel" aria-label={`${kind}: ${title}`}>
        <div className="ld-canvas" ref={boxRef}>
          <canvas ref={canvasRef} aria-hidden="true" />
          <svg ref={svgRef} className="ld-leaders" aria-hidden="true" />
        </div>
        <ul className="ld-notes" ref={notesRef} key={notes.key}>
          {notes.list.map((n, i) => (
            <li key={i} className="ld-note"><b>{n.title}</b>{n.sub && <span>{n.sub}</span>}</li>
          ))}
        </ul>
      </div>
      <div className="ld-cap" aria-live="polite">
        <small>{kind}</small>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
      <div className="ld-tabs" role="tablist" aria-label="Scenes" style={{ "--n": scenes.length }}>
        {scenes.map(([c, label, ttl], i) => (
          <button key={c} type="button" role="tab" aria-selected={i === idx} aria-controls="ld-panel" tabIndex={i === idx ? 0 : -1}
            className={`ld-tab ${i === idx ? "on" : ""}`} onClick={() => pick(i)} onKeyDown={onTabKey}>
            <span className="ld-thumb">{thumbs[c] && <img src={thumbs[c]} alt="" />}</span>
            <span className="ld-tab-label">{label}<em>{ttl}</em></span>
            {i === idx && auto && playing && <i className="ld-progress" ref={barRef} aria-hidden="true" />}
          </button>
        ))}
      </div>
    </div>
  );
}
