"use client";
// The balance line: exploration on the left, exploitation on the right, the ambidextrous band in the middle.
import { useRef } from "react";
import { REGIMES, zoneOf, ZONE_CENTRES } from "./content";

const clamp = (v) => Math.min(1, Math.max(0, v));

export default function BalanceSlider({ value, onChange }) {
  const trackRef = useRef(null), drag = useRef(false);
  const zone = zoneOf(value);
  const at = (ev) => { const r = trackRef.current.getBoundingClientRect(); return clamp((ev.clientX - r.left) / r.width); };

  function down(ev) {
    if (ev.button !== 0 || ev.target.closest(".ld-zones")) return;
    drag.current = true; ev.currentTarget.setPointerCapture(ev.pointerId); onChange(at(ev));
    trackRef.current.querySelector("[role=slider]")?.focus({ preventScroll: true });
  }
  function move(ev) { if (drag.current) onChange(at(ev)); }
  function up() { drag.current = false; }
  function key(ev) {
    const step = { ArrowLeft: -0.02, ArrowDown: -0.02, ArrowRight: 0.02, ArrowUp: 0.02, PageDown: -0.1, PageUp: 0.1 }[ev.key];
    if (step != null) { ev.preventDefault(); onChange(clamp(value + step)); }
    else if (ev.key === "Home") { ev.preventDefault(); onChange(0); }
    else if (ev.key === "End") { ev.preventDefault(); onChange(1); }
  }

  return (
    <section className="ld-choice" aria-label="Exploration and exploitation">
      <div className="ld-end"><b>Exploration</b><small>Search, variety, experiments</small></div>
      <div className="ld-track" ref={trackRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <div className="ld-rail" />
        <div className="ld-band" />
        {[0, 25, 50, 75, 100].map((p) => <div key={p} className="ld-tick" style={{ left: `${p}%` }} />)}
        <div
          className="ld-handle"
          role="slider"
          tabIndex={0}
          aria-label="Balance between exploration and exploitation"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(value * 100)}
          aria-valuetext={`${REGIMES[zone].zone}, ${Math.round(value * 100)} percent towards exploitation`}
          onKeyDown={key}
          style={{ left: `${value * 100}%` }}
        />
        <div className="ld-zones">
          {REGIMES.map((r, i) => (
            <button key={r.key} type="button" className={i === zone ? "on" : ""} aria-pressed={i === zone} onClick={() => onChange(ZONE_CENTRES[i])}>{r.zone}</button>
          ))}
        </div>
      </div>
      <div className="ld-end r"><b>Exploitation</b><small>Refinement, efficiency, routine</small></div>
    </section>
  );
}
