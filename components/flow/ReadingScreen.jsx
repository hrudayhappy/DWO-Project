"use client";
// The reading screen. It plays back what the pipeline is doing with the user's own documents:
// pages are scanned, each quotation the AI returns is highlighted on its page and lifted into
// one of four buckets, the web search gets its own card, and every quotation is checked.
// The playback follows the pipeline's events and never runs ahead of them.
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Globe, Search, X } from "lucide-react";
import FlowTop, { useDarkPage } from "./FlowTop";
import { BUCKETS, BUCKET, DOC_LABEL, srcLabel, cap } from "./buckets";
import { termsFor } from "@/lib/sections";

const RAIL = ["Open the documents", "Find the right pages", "Extract evidence", "Search the web", "Check every quote"];
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const short = (s, n) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s || "");

// Find a quotation in page text, allowing for the line breaks and spacing PDF text has.
function locate(t, quote) {
  const w = String(quote || "").replace(/[“”"]/g, "").split(/\s+/).filter(Boolean);
  if (w.length < 2) return null;
  for (const n of [w.length, Math.min(8, w.length), Math.min(4, w.length)]) {
    try {
      const m = new RegExp(w.slice(0, n).map(esc).join("\\W+"), "i").exec(t);
      if (m) return { start: m.index, end: n === w.length ? m.index + m[0].length : Math.min(t.length, m.index + quote.length) };
    } catch { return null; }
  }
  return null;
}

function PageText({ text, terms, quote }) {
  const t = (text || "").replace(/\s+/g, " ").trim();
  let body = t.slice(0, 1700), q = null, lead = false;
  if (quote) {
    const at = locate(t, quote);
    if (at) { const s = Math.max(0, at.start - 480), e = Math.min(t.length, at.end + 900); body = t.slice(s, e); q = [at.start - s, at.end - s]; lead = s > 0; }
    else { body = t.slice(0, 1400); q = "top"; }
  }
  const re = terms.length ? new RegExp(`(${terms.map(esc).join("|")})`, "gi") : null;
  const marked = (str, offset, total) => {
    if (!re || !str) return str;
    return str.split(re).map((part, i) => (i % 2
      ? <mark key={i} className="k" style={{ animationDelay: `${Math.min(1, (offset + str.indexOf(part)) / total) * 0.95}s` }}>{part}</mark>
      : part));
  };
  const len = body.length || 1;
  if (q === "top") return <><mark className="q">{quote}</mark> {marked(body, 0, len)}</>;
  if (!q) return <>{marked(body, 0, len)}{t.length > body.length ? " …" : ""}</>;
  return (
    <>
      {lead ? "… " : ""}{marked(body.slice(0, q[0]), 0, len)}
      <mark className="q">{body.slice(q[0], q[1])}</mark>
      {marked(body.slice(q[1]), q[1], len)} …
    </>
  );
}

function CountUp({ to, ms = 900 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf, t0;
    const f = (now) => { t0 ??= now; const p = Math.min(1, (now - t0) / ms); setV(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(f); };
    raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return <>{v}</>;
}

export default function ReadingScreen({ company, scope, docs, feed, onDone, onCancel, onBack }) {
  useDarkPage();
  const reduce = useReducedMotion();
  const stageRef = useRef(null), viewRef = useRef(null), discardRef = useRef(null), bucketRefs = useRef({});
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState("Opening the documents");
  const [view, setView] = useState({ kind: "intro" });
  const [fw, setFw] = useState(null);
  const [strip, setStrip] = useState({ pages: [], at: -1 });
  const [buckets, setBuckets] = useState({ F1: [], F2: [], F3: [], F4: [] });
  const [failed, setFailed] = useState({});
  const [checked, setChecked] = useState(null);
  const [discarded, setDiscarded] = useState(0);
  const [bump, setBump] = useState(0);
  const [flying, setFlying] = useState([]);
  const [finished, setFinished] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  const roleDocs = useMemo(() => ["AR", "IP", "EC"].map((r) => docs.find((d) => d.role === r && d.pages)).filter(Boolean), [docs]);
  const textOf = useMemo(() => {
    const m = {};
    for (const d of roleDocs) m[d.role] = Object.fromEntries(d.pages.map((p) => [p.page, p.text]));
    return (doc, page) => m[doc]?.[page] || "";
  }, [roleDocs]);
  const terms = useMemo(() => (fw ? termsFor(fw) : []), [fw]);

  // the playback
  useEffect(() => {
    let alive = true, cur = 0, queue = [], qi = 0, curFw = null;
    const S = (ms) => new Promise((r) => setTimeout(r, reduce ? Math.min(ms, 160) : ms));
    const backlog = () => feed.current.events.length - cur;
    const rel = (el, dx = 0, dy = 0) => {
      const s = stageRef.current.getBoundingClientRect(), r = el.getBoundingClientRect();
      return { x: r.left - s.left + dx, y: r.top - s.top + dy };
    };
    const land = (c) => {
      if (!alive) return;
      if (c.verified) setBuckets((b) => ({ ...b, [c.fw]: [...b[c.fw], { ...c, _id: Math.random().toString(36).slice(2) }] }));
      else { setDiscarded((n) => n + 1); setBump((n) => n + 1); }
    };
    const fly = (c, fromEl, dur = 0.7) => {
      const target = c.verified ? bucketRefs.current[c.fw] : discardRef.current;
      if (reduce || !fromEl || !target || !stageRef.current) { setTimeout(() => land(c), 60); return; }
      const from = rel(fromEl, 0, 0), to = c.verified ? rel(target, 16, 64) : rel(target, 10, 4);
      const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 70 };
      const id = Math.random().toString(36).slice(2);
      setFlying((f) => [...f, { id, c, from, to, mid, dur }]);
      setTimeout(() => { if (!alive) return; setFlying((f) => f.filter((x) => x.id !== id)); land(c); }, dur * 1000);
    };
    const showPage = (doc, page, extra = {}) => {
      setView({ kind: "page", doc, page, key: `${doc}-${page}-${Math.random()}`, ...extra });
      setStrip((s) => ({ ...s, at: s.pages.findIndex((p) => p.doc === doc && p.page === page) }));
    };
    const scan = async () => { const p = queue[qi % queue.length]; qi++; showPage(p.doc, p.page); await S(backlog() > 1 ? 700 : 1250); };
    const pluck = async (c) => {
      showPage(c.doc, c.page, { quote: c.quote, fw: c.fw });
      await S(820);
      const mark = viewRef.current?.querySelector("mark.q");
      fly(c, mark || viewRef.current, 0.8);
      await S(560);
    };

    (async () => {
      await S(1500);
      while (alive) {
        const f = feed.current, ev = f.events[cur];
        if (!ev) {
          if (f.finished) break;
          if (queue.length) { await scan(); continue; }
          await S(140); continue;
        }
        cur++;
        if (ev.type === "docs") {
          setStep(1); setStatus("Finding the pages each framework needs"); await S(900);
        } else if (ev.type === "scan") {
          curFw = ev.fw; setFw(ev.fw); setStep(2); queue = ev.pages; qi = 0;
          setStrip({ pages: ev.pages, at: -1 });
          setStatus(`Reading ${ev.pages.length} pages for ${BUCKET[ev.fw].name.toLowerCase()} evidence`);
          await scan();
          if (backlog() === 0 && queue.length > 1) await scan();
        } else if (ev.type === "found") {
          const docOk = ev.chips.filter((c) => c.verified && c.doc !== "WEB" && textOf(c.doc, c.page));
          const rest = ev.chips.filter((c) => !docOk.includes(c));
          setStatus(`Found ${ev.chips.length} quotation${ev.chips.length === 1 ? "" : "s"} for ${BUCKET[ev.fw].name.toLowerCase()}`);
          const full = reduce ? 0 : backlog() > 2 ? 1 : 3;
          for (const c of docOk.slice(0, full)) { if (!alive) return; await pluck(c); }
          for (const c of [...docOk.slice(full), ...rest]) { if (!alive) return; fly(c, viewRef.current?.querySelector(".rx-sheet") || viewRef.current, 0.6); await S(110); }
          queue = []; await S(750);
        } else if (ev.type === "failed") {
          setFailed((x) => ({ ...x, [ev.fw]: ev.message })); setStatus(`Could not read the ${BUCKET[ev.fw].name.toLowerCase()} evidence`); queue = []; await S(1100);
        } else if (ev.type === "web") {
          curFw = null; setFw(null); queue = []; setStep(3); setStrip({ pages: [], at: -1 });
          const of = ev.batches > 1 ? ` (${ev.batch + 1} of ${ev.batches})` : "";
          setStatus(ev.round ? `Trying other searches for what is still missing${of}` : `Searching the web for what the documents did not have${of}`);
          setView({ kind: "web", round: ev.round, need: ev.need || [], queries: ev.queries, results: null, key: `web-${ev.round}-${ev.batch}` }); await S(1600);
        } else if (ev.type === "webFound") {
          setView((v) => ({ ...v, results: ev.results, got: ev.chips.length })); await S(900);
          for (const c of ev.chips) { if (!alive) return; fly(c, viewRef.current?.querySelector(".rx-results") || viewRef.current, 0.65); await S(140); }
          await S(700);
        } else if (ev.type === "webFailed") {
          setView((v) => ({ ...v, results: [], failed: true }));
          setStatus("This search did not answer; carrying on"); await S(1100);
        } else if (ev.type === "checked") {
          setStep(4); setFw(null); setStatus("Checking every quotation against the page it came from");
          setView({ kind: "verify", total: ev.total, verified: ev.verified, key: "verify" });
          await S(700); setChecked(ev); await S(1900);
        }
      }
      if (!alive) return;
      if (feed.current.error) { setError(feed.current.error); setStatus("The reading stopped"); return; }
      setFinished(true); setStep(5); setStatus("Every quotation has been checked against the page it came from");
    })();
    const poll = setInterval(() => setReady(feed.current.finished && !feed.current.error), 300);
    return () => { alive = false; clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // once the playback ends, move on by itself after a short pause
  const doneRef = useRef(onDone); doneRef.current = onDone;
  useEffect(() => {
    if (!finished) return;
    const t = setTimeout(() => doneRef.current(), reduce ? 2500 : 4200);
    return () => clearTimeout(t);
  }, [finished, reduce]);

  const total = BUCKETS.reduce((n, b) => n + buckets[b.fw].length, 0);
  const color = fw ? BUCKET[fw].color : "#ffffff";

  return (
    <main className="lx fx rx" style={{ "--ember-k": 0.45, "--ice-k": 0.45, "--scan": view.fw ? BUCKET[view.fw].color : color }}>
      <div className="lx-glow" aria-hidden="true"><i className="g1" /><i className="g2" /></div>
      <div className="fx-page">
        <FlowTop step={1}>
          <button type="button" className="lx-ghost" onClick={onCancel}><X size={14} aria-hidden="true" />Cancel</button>
        </FlowTop>

        <section className="rx-head">
          <p className="lx-chip"><i aria-hidden="true" />{company}{scope && scope !== "Whole company" ? ` · ${scope}` : ""}</p>
          <h1>{finished ? "Evidence ready." : error ? "The reading stopped." : "Reading the documents"}</h1>
          <p className="rx-status" aria-live="polite">{status}</p>
          <ol className="rx-rail" aria-hidden="true">
            {RAIL.map((r, i) => <li key={r} className={i < step ? "past" : i === step ? "now" : ""}><i />{r}</li>)}
          </ol>
        </section>

        <div className="rx-stage" ref={stageRef}>
          <section className="rx-reader" aria-hidden="true">
            <div className="rx-docs">
              {roleDocs.map((d) => (
                <span key={d.role} className={view.kind === "page" && view.doc === d.role ? "on" : ""}>
                  {DOC_LABEL[d.role]}<em>{d.pages.length} pp</em>
                </span>
              ))}
              <span className={view.kind === "web" ? "on" : ""}><Globe size={12} aria-hidden="true" />Web</span>
              {fw && <b className="rx-looking" style={{ "--c": color }}>Looking for {BUCKET[fw].name.toLowerCase()} evidence</b>}
            </div>

            <div className={`rx-view ${view.kind === "page" || view.kind === "web" ? "paper" : ""}`} ref={viewRef}>
              <AnimatePresence mode="popLayout" initial={false}>
                {view.kind === "intro" && (
                  <motion.div key="intro" className="rx-intro" exit={{ opacity: 0, y: -16, transition: { duration: 0.3 } }}>
                    {roleDocs.map((d, i) => (
                      <motion.div key={d.role} className="rx-cover" initial={reduce ? false : { opacity: 0, y: 40, rotate: (i - 1) * 2 }} animate={{ opacity: 1, y: 0, rotate: (i - (roleDocs.length - 1) / 2) * 5 }} transition={{ delay: 0.15 + i * 0.16, duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}>
                        <small>{DOC_LABEL[d.role]}</small>
                        <b>{company}</b>
                        <span>{d.pages.length} pages</span>
                        <i />
                      </motion.div>
                    ))}
                  </motion.div>
                )}
                {view.kind === "page" && (
                  <motion.article key={view.key} className={`rx-sheet ${view.quote ? "pluck" : "scan"}`}
                    initial={reduce ? false : { opacity: 0, y: 26, rotateX: -10, filter: "blur(6px)" }}
                    animate={{ opacity: 1, y: 0, rotateX: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -18, scale: 0.985, filter: "blur(4px)", transition: { duration: 0.28 } }}
                    transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}>
                    <header><span>{DOC_LABEL[view.doc]}</span><span>Page {view.page}</span></header>
                    <div className="rx-text"><PageText text={textOf(view.doc, view.page)} terms={view.quote ? [] : terms} quote={view.quote} /></div>
                    {!view.quote && <div className="rx-beam" />}
                  </motion.article>
                )}
                {view.kind === "web" && (
                  <motion.article key={view.key} className="rx-sheet rx-web" initial={reduce ? false : { opacity: 0, y: 26, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -18, transition: { duration: 0.28 } }} transition={{ duration: 0.45 }}>
                    <header><span className="rx-dots"><i /><i /><i /></span><span>{view.round ? "Web search, second try" : "Web search"}</span></header>
                    {view.need.length > 0 && <p className="rx-need"><span>Looking for</span>{view.need.map((n) => <b key={n}>{n}</b>)}</p>}
                    <ul className="rx-queries">
                      {view.queries.map((q, i) => (
                        <motion.li key={q} initial={reduce ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.3 }}>
                          <Search size={13} aria-hidden="true" />{q}
                        </motion.li>
                      ))}
                    </ul>
                    {!view.results && <p className="rx-searching"><i /><i /><i />Reading the results</p>}
                    {view.results && (
                      <ul className="rx-results">
                        {view.results.slice(0, 5).map((r, i) => (
                          <motion.li key={r.url + i} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                            <b>{short(r.title, 70)}</b><span>{srcLabel({ doc: "WEB", url: r.url })}</span>
                          </motion.li>
                        ))}
                        {view.results.length === 0 && <li><span>{view.failed ? "The search did not answer." : "Nothing useful came back."}</span></li>}
                      </ul>
                    )}
                  </motion.article>
                )}
                {view.kind === "verify" && (
                  <motion.div key="verify" className="rx-verify" initial={reduce ? false : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
                    <svg viewBox="0 0 120 120" className="rx-ring"><circle cx="60" cy="60" r="52" /><motion.circle cx="60" cy="60" r="52" className="fill" initial={{ pathLength: 0 }} animate={{ pathLength: view.total ? view.verified / view.total : 1 }} transition={{ duration: 1.1, ease: "easeOut" }} /></svg>
                    <strong><CountUp to={view.verified} /><small>of {view.total}</small></strong>
                    <p>quotations found word for word on the page they cite</p>
                    {view.total > view.verified && <span>{view.total - view.verified} could not be found and are left out</span>}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="rx-strip">
              {strip.pages.slice(0, 22).map((p, i) => (
                <span key={`${p.doc}${p.page}`} className={i === strip.at ? "on" : i < strip.at ? "past" : ""}>{p.doc === "AR" ? "" : `${p.doc} `}p.{p.page}</span>
              ))}
              {strip.pages.length > 22 && <span className="more">+{strip.pages.length - 22}</span>}
            </div>
          </section>

          <section className="rx-buckets" aria-label="Evidence found so far">
            {BUCKETS.map((b) => {
              const items = buckets[b.fw];
              return (
                <div key={b.fw} ref={(el) => (bucketRefs.current[b.fw] = el)} className={`rx-bucket ${fw === b.fw ? "on" : ""} ${checked ? "checked" : ""}`} style={{ "--c": b.color }}>
                  <header>
                    <i aria-hidden="true" />
                    <div><b>{b.name}{checked && <em className="rx-ok"><Check size={11} strokeWidth={3} aria-hidden="true" />Checked</em>}</b><span>{b.sub}</span></div>
                    <motion.strong key={items.length} initial={reduce || !items.length ? false : { scale: 1.35, color: b.color }} animate={{ scale: 1, color: "#ffffff" }} transition={{ duration: 0.4 }}>{items.length}</motion.strong>
                  </header>
                  <ul>
                    <AnimatePresence initial={false}>
                      {items.slice(-2).reverse().map((c) => (
                        <motion.li key={c._id} layout={!reduce} initial={reduce ? false : { opacity: 0, y: -10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }} transition={{ duration: 0.35 }}>
                          {c.head && <small>{cap(c.head)}</small>}
                          <p>{short(c.quote, 110)}</p>
                          <em>{srcLabel(c)}</em>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                    {!items.length && !failed[b.fw] && <li className="empty">Waiting for the {b.name.toLowerCase()} pages</li>}
                    {failed[b.fw] && <li className="empty bad">Could not read this part. The diagnosis will mark it as missing.</li>}
                  </ul>
                </div>
              );
            })}
            <motion.div ref={discardRef} className="rx-discard" key={bump} initial={reduce || !bump ? false : { x: [-4, 4, -2, 0] }} animate={{ x: 0 }} transition={{ duration: 0.35 }}>
              <span>Not found on the cited page</span><b>{discarded}</b>
            </motion.div>
          </section>

          <div className="rx-fly" aria-hidden="true">
            <AnimatePresence>
              {flying.map((f) => (
                <motion.div key={f.id} className={`rx-chip ${f.c.verified ? "" : "bad"}`} style={{ "--c": BUCKET[f.c.fw]?.color || "#fff" }}
                  initial={{ x: f.from.x, y: f.from.y, opacity: 0, scale: 1 }}
                  animate={{ x: [f.from.x, f.mid.x, f.to.x], y: [f.from.y, f.mid.y, f.to.y], opacity: [0, 1, f.c.verified ? 1 : 0.4], scale: [1, 1, 0.6] }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={{ duration: f.dur, ease: [0.45, 0.05, 0.25, 1], times: [0, 0.45, 1] }}>
                  <i />{short(f.c.quote, 46)}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <footer className="rx-foot">
          {error ? (
            <div className="rx-error" role="alert">
              <p><b>The reading stopped.</b> {error}</p>
              <button type="button" className="lx-cta" onClick={onBack}>Back to your inputs<span aria-hidden="true"><ArrowRight size={18} /></span></button>
            </div>
          ) : finished ? (
            <div className="rx-done">
              <p><b>{total} quotations</b> sorted into four buckets{discarded ? `, ${discarded} left out` : ""}. Next: the key figures, and how each framework will read the evidence.</p>
              <button type="button" className="lx-cta rx-next" onClick={onDone}>Review the evidence<span aria-hidden="true"><ArrowRight size={18} /></span></button>
            </div>
          ) : (
            <div className="rx-wait">
              <p>{total ? `${total} quotation${total === 1 ? "" : "s"} so far` : "Every quotation is checked against its page before it is used."}</p>
              {ready && <button type="button" className="lx-ghost" onClick={onDone}>Skip to the review<ArrowRight size={14} aria-hidden="true" /></button>}
            </div>
          )}
        </footer>
      </div>
    </main>
  );
}
