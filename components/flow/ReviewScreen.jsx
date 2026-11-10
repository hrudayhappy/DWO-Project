"use client";
// After reading: what was extracted (in one line), the key figures as a highlight strip that
// opens into editable tiles, and how each framework will read the evidence. The diagnosis
// page then places the company within the frameworks.
import { useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { ArrowRight, ArrowUpRight, ChevronDown, CornerDownRight, Globe, Info, RotateCcw, Undo2 } from "lucide-react";
import FlowTop, { useDarkPage } from "./FlowTop";
import Diagram from "./Diagrams";
import { LENSES, evidenceCounts } from "./theory";
import { srcLabel, domain } from "./buckets";
import { FIGURES, PROFILE_FIGS } from "@/lib/pipeline";

const ALL = [...FIGURES, ...PROFILE_FIGS];
const ORDER = ["revenue", "rnd", "pat", "employees", "incorporated", "dividends", "buyback", "royalty", "export_share", "ev_share", "new_business_share"];
// Short names for the tiles; the full name stays in the tooltip and the screen-reader label
const SHORT = { revenue: "Revenue", rnd: "R&D spend", pat: "Profit after tax", employees: "Employees", incorporated: "Incorporated", dividends: "Dividends", buyback: "Buyback", royalty: "Royalty to a parent", export_share: "Exports, share of volume", ev_share: "EV share of sales", new_business_share: "New business share" };
const TILES = ORDER.map((k) => ALL.find((f) => f.key === k)).filter(Boolean).map((f) => ({ ...f, short: SHORT[f.key] || f.label }));
const num = (figs, k) => (figs?.[k] && figs[k].value !== "" && !isNaN(Number(figs[k].value)) ? Number(figs[k].value) : null);
const inr = (v) => v.toLocaleString("en-IN", { maximumFractionDigits: v >= 100 ? 0 : 2 });
const pct = (v) => `${v.toLocaleString("en-IN", { maximumFractionDigits: v >= 10 ? 1 : 2 })}%`;
const firstSentence = (q) => {
  const s = String(q || "").replace(/\s+/g, " ").trim();
  const m = s.match(/^(.{40,}?[.;!?])\s/);
  const out = m ? m[1] : s;
  return out.length > 170 ? out.slice(0, 168).trimEnd() + "…" : out;
};

function Highlights({ figs }) {
  const rev = num(figs, "revenue"), rnd = num(figs, "rnd"), pat = num(figs, "pat"), emp = num(figs, "employees"), inc = num(figs, "incorporated");
  const year = new Date().getFullYear();
  const cells = [
    { label: "Revenue", value: rev != null ? `₹${inr(rev)} cr` : null, sub: "Revenue from operations" },
    { label: "R&D investment", value: rev && rnd != null ? pct((rnd / rev) * 100) : null, sub: rnd != null ? `₹${inr(rnd)} cr, as a share of revenue` : "Share of revenue" },
    { label: "Net profit margin", value: rev && pat != null ? pct((pat / rev) * 100) : null, sub: pat != null ? `₹${inr(pat)} cr profit after tax` : "Profit after tax over revenue" },
    { label: "Company size", value: emp != null ? inr(emp) : null, sub: "Permanent employees" },
    { label: "In existence", value: inc ? `${year - inc} years` : null, sub: inc ? `Incorporated in ${inc}` : "Since incorporation" },
  ];
  return (
    <dl className="vx-high">
      {cells.map((c) => (
        <div key={c.label}>
          <dt>{c.label}</dt>
          <dd className={c.value ? "" : "none"}>{c.value || "Not found"}</dd>
          <dd className="sub">{c.sub}</dd>
        </div>
      ))}
    </dl>
  );
}

function Tile({ f, st, setSt, web }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const ev = st.evidence[0];
  const orig = st.original == null ? "" : String(st.original);
  const edited = st.value !== orig;
  const state = edited ? "edited" : ev ? (ev.doc === "WEB" ? "web" : "found") : "missing";
  const stateText = { edited: "Edited by you", found: "Found in the documents", web: "Found on the web", missing: "Not found" }[state];
  const none = web === "missing" ? "Not in the documents, and the web search did not find it either. Type it in if you know it, or leave it empty." : "Not found in the documents. Type it in if you know it, or leave it empty.";
  return (
    <div className={`vx-tile ${state} ${open ? "open" : ""}`}>
      <div className="vx-tile-top">
        <label htmlFor={`fig-${f.key}`} title={f.label}>{f.short}</label>
        <span className="vx-dot" title={stateText}><span className="sr">{stateText}</span></span>
        <button type="button" className="vx-i" aria-expanded={open} aria-label={`Where ${f.label.toLowerCase()} comes from`} onClick={() => setOpen(!open)}><Info size={14} strokeWidth={2} aria-hidden="true" /></button>
      </div>
      <div className="vx-input">
        <input id={`fig-${f.key}`} inputMode="decimal" value={st.value} placeholder="Not found" onChange={(e) => setSt({ ...st, value: e.target.value.replace(/[^0-9.]/g, "") })} />
        {f.unit && <span>{f.unit}</span>}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="vx-why" initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }}>
            <div className="vx-why-in">
              {ev && ev.doc === "WEB" && <b className="vx-src"><Globe size={12} aria-hidden="true" />{domain(ev.url)}<a href={ev.url} target="_blank" rel="noreferrer">Open<ArrowUpRight size={12} aria-hidden="true" /><span className="sr"> the page (opens in a new tab)</span></a></b>}
              {ev && ev.doc !== "WEB" && <b className="vx-src">{srcLabel(ev)}</b>}
              {ev ? <p>“{firstSentence(ev.quote)}”</p> : <p>{none}</p>}
              {edited && <button type="button" className="vx-undo" onClick={() => setSt({ ...st, value: orig })}><Undo2 size={13} aria-hidden="true" />{orig ? `Back to ${orig}` : "Clear"}</button>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function countLabel(c) {
  if (c.unit === "source") return `${c.n} source${c.n === 1 ? "" : "s"}`;
  if (c.of) return `${c.n} of ${c.of} figure${c.of === 1 ? "" : "s"}`;
  if (!c.n) return "None found";
  return `${c.n} found`;
}
const WEB_KEY = { incorporated: "incorporated_year" };

export default function ReviewScreen({ context, run, figs, setFigs, onDiagnose, onReset }) {
  useDarkPage();
  const reduce = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState("F1");
  const counts = useMemo(() => evidenceCounts(run.extraction, figs), [run, figs]);
  const totals = Object.fromEntries(LENSES.map((l) => [l.fw, l.groups.flatMap((g) => g.items).reduce((n, it) => n + (counts[it.id].unit === "source" ? 0 : counts[it.id].n), 0)]));
  const fill = run.web || { tried: [], filled: [] };
  const pages = (run.docsRead || []).reduce((n, d) => n + d.pages, 0);
  const web = (run.webResults || []).length;
  const verified = run.stats?.verified ?? 0;
  const edits = TILES.filter((f) => figs[f.key] && figs[f.key].value !== (figs[f.key].original == null ? "" : String(figs[f.key].original))).length;
  const lens = LENSES.find((l) => l.fw === tab);

  return (
    <main className="lx fx vx" style={{ "--ember-k": 0.35, "--ice-k": 0.4 }}>
      <div className="lx-glow" aria-hidden="true"><i className="g1" /><i className="g2" /></div>
      <div className="fx-page">
        <FlowTop step={2}>
          <button type="button" className="lx-ghost" onClick={onReset}><RotateCcw size={13} aria-hidden="true" />Start again</button>
        </FlowTop>

        <section className="vx-head">
          <div>
            <p className="lx-chip"><i aria-hidden="true" />{context.company}{context.scope !== "Whole company" ? ` · ${context.scope}` : ""}</p>
            <h1>Evidence extracted.</h1>
            <p className="vx-lede">Each piece was checked word for word against the page it came from. Check the key figures below, then see how each framework will use the evidence.</p>
          </div>
          <div className="vx-count-big">
            <strong>{verified}</strong>
            <span>pieces of evidence</span>
            <small>from {pages} pages{web ? ` and ${web} web results` : ""}</small>
            {fill.tried.length > 0 && <small className="vx-fill"><Globe size={12} aria-hidden="true" />The web filled {fill.filled.length} of {fill.tried.length} gaps in the documents</small>}
          </div>
        </section>

        <section className="vx-card vx-figures" aria-labelledby="vx-fig">
          <div className="vx-card-head">
            <h2 id="vx-fig">Key figures</h2>
            <button type="button" className="lx-ghost" aria-expanded={expanded} aria-controls="vx-tiles" onClick={() => setExpanded(!expanded)}>
              {expanded ? "Hide the figures" : `See and correct all ${TILES.length} figures`}
              <ChevronDown size={14} aria-hidden="true" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform .25s" }} />
            </button>
          </div>
          <Highlights figs={figs} />
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div id="vx-tiles" className="vx-tiles-wrap" initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}>
                <p className="vx-tiles-note">These drive the spending ratios in the diagnosis. Correct anything that looks wrong; the <Info size={12} aria-hidden="true" /> button shows where a figure was found. <span className="vx-key"><i className="found" />In the documents</span><span className="vx-key"><i className="web" />On the web</span><span className="vx-key"><i className="missing" />Not found</span></p>
                <div className="vx-tiles">
                  {TILES.map((f) => figs[f.key] && <Tile key={f.key} f={f} st={figs[f.key]} web={fill.keys?.[WEB_KEY[f.key] || f.src[1]]} setSt={(st) => setFigs({ ...figs, [f.key]: st })} />)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <section className="vx-card vx-lenses" aria-labelledby="vx-ln">
          <div className="vx-card-head">
            <h2 id="vx-ln">How the diagnosis reads the evidence</h2>
            <p>Four frameworks, in this order. Each looks for specific signals in the documents. The next page shows where the company falls.</p>
          </div>
          <div className="vx-chain" role="tablist" aria-label="Frameworks">
            {LENSES.map((l, i) => (
              <button key={l.fw} type="button" role="tab" id={`ln-${l.fw}`} aria-selected={tab === l.fw} aria-controls="vx-lens" className={tab === l.fw ? "on" : ""} style={{ "--c": l.color }} onClick={() => setTab(l.fw)}>
                <span className="n">{i + 1}</span>
                <b>{l.short}</b>
                <small>{l.question}</small>
                <em>{totals[l.fw]} found</em>
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={tab} id="vx-lens" role="tabpanel" aria-labelledby={`ln-${tab}`} className="vx-lens" style={{ "--c": lens.color }}
              initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }} transition={{ duration: 0.3 }}>
              <div className="vx-theory">
                <h3>{lens.name}<span>{lens.basis}</span></h3>
                <p>{lens.idea}</p>
                <Diagram fw={tab} />
              </div>
              <div className="vx-signals">
                <h3>What we look for in the documents</h3>
                {lens.groups.map((g) => (
                  <div key={g.title} className="vx-sig-group">
                    <h4>{g.title}</h4>
                    <ul>
                      {g.items.map((it) => {
                        const c = counts[it.id];
                        return (
                          <li key={it.id}>
                            <div>
                              <b>{it.name}</b>
                              <ul className="vx-cues" aria-label="What we look for">{it.cues.map((q) => <li key={q}>{q}</li>)}</ul>
                              <em><CornerDownRight size={12} aria-hidden="true" />{it.reads}</em>
                            </div>
                            <span className={`vx-n ${c.n ? "yes" : "no"}`}>{countLabel(c)}{c.web ? <small>{c.web} from the web</small> : null}{c.note ? <small>{c.note}</small> : null}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
                <p className="vx-total">We found <b>{totals[tab]}</b> pieces of evidence for this framework.</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </section>
      </div>

      <div className="vx-bar" role="region" aria-label="Run the diagnosis">
        <div className="vx-bar-in">
          <p><span><b>{verified}</b> pieces of evidence<span className="vx-long"> across four frameworks</span>{edits ? ` · ${edits} figure${edits === 1 ? "" : "s"} corrected` : ""}</span></p>
          <button type="button" className="lx-cta" onClick={onDiagnose}>Run the diagnosis<span aria-hidden="true"><ArrowRight size={18} /></span></button>
        </div>
      </div>
    </main>
  );
}
