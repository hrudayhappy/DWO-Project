"use client";
// The review screen: the user's inputs, the key figures and every piece of evidence, sorted by
// framework. Figures can be corrected, evidence left out, and classifications changed before
// the fixed rules score them.
import { useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { ArrowRight, Building2, ChevronDown, FileText, Globe, RotateCcw, Undo2 } from "lucide-react";
import FlowTop, { useDarkPage } from "./FlowTop";
import ParentSwitch from "@/components/upload/ParentSwitch";
import { BUCKETS, BUCKET, DOC_LABEL, srcLabel, cap } from "./buckets";
import { FIGURES } from "@/lib/pipeline";
import { reviewGroups } from "@/lib/review";

const TYPE = { fact: "Reported fact", company_claim: "Company's own words", third_party: "Third party", inference: "Inference" };
const LABELS = [["exploratory", "Exploratory"], ["exploitative", "Exploitative"], ["both", "Both"], ["neither", "Neither"]];
const STYLES = [["organic", "Organic"], ["mechanistic", "Mechanistic"], ["mixed", "Mixed"]];
const short = (s, n) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s || "");

function Segmented({ options, value, onChange, label }) {
  return (
    <div className="vx-seg" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? "on" : ""} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  );
}

function Item({ item, kind, review, setReview }) {
  const off = !!review.off[item.key];
  const [more, setMore] = useState(false);
  const ev = item.evidence;
  const label = review.label[item.key] ?? item.label;
  const style = review.style[item.key] ?? item.style;
  const toggle = () => setReview((r) => ({ ...r, off: { ...r.off, [item.key]: !off } }));
  return (
    <li className={`vx-item ${off ? "off" : ""}`}>
      <button type="button" role="switch" aria-checked={!off} aria-label={off ? "Use this evidence" : "Leave this evidence out"} className="vx-use" onClick={toggle}><i /></button>
      <div className="vx-body">
        {(item.head || kind !== "item") && (
          <div className="vx-line">
            {item.head && <b>{cap(item.head)}</b>}
            {kind === "statement" && (
              <>
                <Segmented label="Classification" options={LABELS} value={label} onChange={(v) => setReview((r) => ({ ...r, label: { ...r.label, [item.key]: v } }))} />
                {item.priority && <span className="vx-tag">Listed as a priority</span>}
                {label !== item.label && <span className="vx-tag changed">Changed from {item.label}</span>}
              </>
            )}
            {kind === "job" && (
              <>
                <Segmented label="Style of the job description" options={STYLES} value={style} onChange={(v) => setReview((r) => ({ ...r, style: { ...r.style, [item.key]: v } }))} />
                {style !== item.style && <span className="vx-tag changed">Changed from {item.style}</span>}
              </>
            )}
          </div>
        )}
        {(more ? ev : ev.slice(0, 1)).map((e, i) => (
          <figure key={i} className="vx-quote">
            <blockquote>“{e.quote}”</blockquote>
            <figcaption>
              {e.doc === "WEB" ? <a href={e.url} target="_blank" rel="noreferrer">{srcLabel(e)}</a> : <span>{srcLabel(e)}</span>}
              {TYPE[e.type] && <span>{TYPE[e.type]}</span>}
            </figcaption>
          </figure>
        ))}
        {ev.length > 1 && <button type="button" className="vx-more" onClick={() => setMore(!more)}>{more ? "Show one source" : `${ev.length - 1} more source${ev.length > 2 ? "s" : ""}`}</button>}
      </div>
    </li>
  );
}

export default function ReviewScreen({ context, form, setForm, docs, run, figs, setFigs, review, setReview, onDiagnose, onReset }) {
  useDarkPage();
  const reduce = useReducedMotion();
  const groups = useMemo(() => reviewGroups(run.extraction), [run]);
  const [tab, setTab] = useState("F1");
  const [showLeft, setShowLeft] = useState(false);

  const counts = Object.fromEntries(BUCKETS.map((b) => {
    const all = (groups[b.fw] || []).flatMap((g) => g.items);
    return [b.fw, { all: all.length, use: all.filter((i) => !review.off[i.key]).length }];
  }));
  const allItems = BUCKETS.reduce((n, b) => n + counts[b.fw].all, 0);
  const inUse = BUCKETS.reduce((n, b) => n + counts[b.fw].use, 0);
  const editedFigs = FIGURES.filter((f) => figs[f.key].value !== (figs[f.key].original == null ? "" : String(figs[f.key].original))).length;
  const changes = Object.values(review.off).filter(Boolean).length + Object.keys(review.label).length + Object.keys(review.style).length + editedFigs;
  const pages = (run.docsRead || []).reduce((n, d) => n + d.pages, 0);
  const rejected = run.stats?.rejected || [];
  const roleDocs = ["AR", "IP", "EC"].map((r) => docs.find((d) => d.role === r && d.status === "done")).filter(Boolean);
  const b = BUCKET[tab];

  return (
    <main className="lx fx vx" style={{ "--ember-k": 0.35, "--ice-k": 0.4 }}>
      <div className="lx-glow" aria-hidden="true"><i className="g1" /><i className="g2" /></div>
      <div className="fx-page">
        <FlowTop step={2}>
          <button type="button" className="lx-ghost" onClick={onReset}><RotateCcw size={13} aria-hidden="true" />Start again</button>
        </FlowTop>

        <section className="vx-head">
          <p className="lx-chip"><i aria-hidden="true" />{context.company}{context.scope !== "Whole company" ? ` · ${context.scope}` : ""}</p>
          <h1>Review what we found.</h1>
          <p className="vx-lede">The AI only gathered the evidence. Check it here: correct a figure, leave out anything that looks wrong, or change how a statement is classified. The scores are then worked out by fixed rules.</p>
          <dl className="vx-stats">
            <div><dt>Pages read</dt><dd>{pages}</dd></div>
            <div><dt>Quotations verified</dt><dd>{run.stats?.verified ?? 0}</dd></div>
            <div><dt>Not found on the page</dt><dd>{rejected.length}</dd></div>
            <div><dt>Web results used</dt><dd>{(run.webResults || []).length}</dd></div>
          </dl>
        </section>

        <div className="vx-top">
          <section className="vx-card vx-inputs" aria-labelledby="vx-in">
            <h2 id="vx-in">Your inputs</h2>
            <dl>
              <div><dt>Company</dt><dd>{context.company}</dd></div>
              <div><dt>Part of the business</dt><dd>{context.scope}</dd></div>
              <div><dt>Industry</dt><dd>Indian automobile manufacturers</dd></div>
            </dl>
            <ul className="vx-docs">
              {roleDocs.map((d) => (
                <li key={d.role}><span className="lx-tile" aria-hidden="true"><FileText size={16} strokeWidth={1.8} /></span><div><b>{DOC_LABEL[d.role]}</b><span>{d.file.name} · {d.pages.length} pages</span></div></li>
              ))}
              {(run.webResults || []).length > 0 && <li><span className="lx-tile" aria-hidden="true"><Globe size={16} strokeWidth={1.8} /></span><div><b>Web search</b><span>{run.webResults.length} results for missing and supporting inputs</span></div></li>}
            </ul>
            <div className="psw-slot"><ParentSwitch on={form.parentTech} onChange={(v) => setForm({ ...form, parentTech: v })} /></div>
          </section>

          <section className="vx-card vx-figs" aria-labelledby="vx-fig">
            <div className="vx-card-head">
              <h2 id="vx-fig">Key figures</h2>
              <p>These drive the spending ratios. Correct any that are wrong and fill in any that are missing.</p>
            </div>
            <div className="vx-fig-grid">
              {FIGURES.map((f) => {
                const st = figs[f.key], ev = st.evidence[0];
                const orig = st.original == null ? "" : String(st.original);
                const edited = st.value !== orig;
                const state = edited ? "edited" : ev ? "found" : "missing";
                return (
                  <div key={f.key} className={`vx-fig ${state}`}>
                    <div className="vx-fig-top">
                      <label htmlFor={`fig-${f.key}`}>{f.label}</label>
                      <span className="vx-badge">{edited ? "Edited" : ev ? "Found" : "Missing"}</span>
                    </div>
                    <div className="vx-input">
                      <input id={`fig-${f.key}`} inputMode="decimal" value={st.value} placeholder="Not found" onChange={(e) => setFigs({ ...figs, [f.key]: { ...st, value: e.target.value.replace(/[^0-9.]/g, "") } })} />
                      <span>{f.unit}</span>
                    </div>
                    {ev && !edited && <p className="vx-src"><b>{srcLabel(ev)}</b> “{short(ev.quote, 110)}”</p>}
                    {!ev && !edited && <p className="vx-src muted">Not in the documents. Enter it if you know it, or leave it empty.</p>}
                    {edited && <button type="button" className="vx-undo" onClick={() => setFigs({ ...figs, [f.key]: { ...st, value: orig } })}><Undo2 size={13} aria-hidden="true" />{orig ? `Back to ${orig}` : "Clear"}</button>}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <section className="vx-card vx-evidence" aria-labelledby="vx-ev">
          <div className="vx-card-head">
            <h2 id="vx-ev">Evidence</h2>
            <p>Switch off anything that does not belong. Left-out evidence is not used in any score.</p>
          </div>
          <div className="vx-tabs" role="tablist" aria-label="Frameworks">
            {BUCKETS.map((x) => (
              <button key={x.fw} type="button" role="tab" id={`tab-${x.fw}`} aria-selected={tab === x.fw} aria-controls="vx-panel" className={tab === x.fw ? "on" : ""} style={{ "--c": x.color }} onClick={() => setTab(x.fw)}>
                <i aria-hidden="true" /><b>{x.name}</b><span>{counts[x.fw].use}{counts[x.fw].use !== counts[x.fw].all ? ` of ${counts[x.fw].all}` : ""}</span>
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={tab} id="vx-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="vx-panel" style={{ "--c": b.color }}
              initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }} transition={{ duration: 0.25 }}>
              <p className="vx-panel-sub"><b>{b.sub}.</b> Framework: {b.framework}.</p>
              {(groups[tab] || []).length === 0 && <p className="vx-none">No verified evidence was found for this framework. The diagnosis will mark it as having too little evidence.</p>}
              {(groups[tab] || []).map((g) => (
                <div key={g.title} className="vx-group">
                  <h3>{g.title}<span>{g.items.filter((i) => !review.off[i.key]).length}</span></h3>
                  <ul>{g.items.map((it) => <Item key={it.key} item={it} kind={g.kind} review={review} setReview={setReview} />)}</ul>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
          {rejected.length > 0 && (
            <div className="vx-left">
              <button type="button" aria-expanded={showLeft} onClick={() => setShowLeft(!showLeft)}>
                <ChevronDown size={15} aria-hidden="true" style={{ transform: showLeft ? "rotate(180deg)" : "none" }} />
                {rejected.length} quotation{rejected.length === 1 ? " was" : "s were"} not found on the page cited and {rejected.length === 1 ? "is" : "are"} not used
              </button>
              {showLeft && (
                <ul>
                  {rejected.map((r, i) => <li key={i}><blockquote>“{short(r.quote, 220)}”</blockquote><span>{r.doc === "WEB" ? srcLabel(r) : `${DOC_LABEL[r.doc] || r.doc} · p.${r.page}`} · {r.reason}</span></li>)}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>

      <div className="vx-bar" role="region" aria-label="Run the diagnosis">
        <div className="vx-bar-in">
          <p><Building2 size={15} aria-hidden="true" /><span><b>{inUse}</b> of {allItems} <span className="vx-long">pieces of evidence </span>in use{changes ? ` · ${changes} change${changes === 1 ? "" : "s"}` : ""}<span className="vx-long">{changes ? " by you" : ""}</span></span></p>
          <button type="button" className="lx-cta" onClick={onDiagnose}>Run the diagnosis<span aria-hidden="true"><ArrowRight size={18} /></span></button>
        </div>
      </div>
    </main>
  );
}
