"use client";
// The balance line: exploration on the left, exploitation on the right, ambidexterity in the middle.
import { useRef } from "react";
import { REGIMES, zoneOf, ZONE_CENTRES } from "./content";

const clamp = (v) => Math.min(1, Math.max(0, v));

export default function BalanceSlider({ value, onChange }) {
  const railRef = useRef(null), drag = useRef(false);
  const zone = zoneOf(value);
  const at = (ev) => { const r = railRef.current.getBoundingClientRect(); return clamp((ev.clientX - r.left) / r.width); };

  function down(ev) {
    if (ev.button !== 0) return;
    drag.current = true; ev.currentTarget.setPointerCapture(ev.pointerId); onChange(at(ev));
    railRef.current.querySelector("[role=slider]")?.focus({ preventScroll: true });
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
    <section className="lx-balance" aria-label="Exploration and exploitation">
      <div className="lx-ends">
        <span className="lx-end ember"><i aria-hidden="true" />Exploration</span>
        <span className="lx-end ice">Exploitation<i aria-hidden="true" /></span>
      </div>
      <div className="lx-track" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <div className="lx-fill" />
        <div className="lx-rail" ref={railRef}>
        <div className="lx-band" />
        {[0.1, 0.2, 0.3, 0.7, 0.8, 0.9].map((p) => <span key={p} className="lx-tick" style={{ left: `${p * 100}%` }} />)}
        <div
          className="lx-handle"
          role="slider"
          tabIndex={0}
          aria-label="Balance between exploration and exploitation"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(value * 100)}
          aria-valuetext={`${REGIMES[zone].zone}, ${Math.round(value * 100)} percent towards exploitation`}
          onKeyDown={key}
          style={{ left: `${value * 100}%` }}
        ><span aria-hidden="true" /></div>
        </div>
      </div>
      <div className="lx-zones">
        {REGIMES.map((r, i) => (
          <button key={r.key} type="button" className={i === zone ? "on" : ""} aria-pressed={i === zone} onClick={() => onChange(ZONE_CENTRES[i])}>
            <b>{r.zone}</b><span>{r.zoneNote}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
