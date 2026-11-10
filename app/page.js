"use client";
import { useEffect, useRef, useState } from "react";
import { runPipeline, initialFigures, applyFigures, fetchNarrative, FIGURES } from "@/lib/pipeline";
import { runDiagnosis } from "@/lib/engine";
import { INDUSTRY_PROFILES, DEFAULT_INDUSTRY } from "@/lib/industryProfile";
import Results from "@/components/Results";
import DocumentDrop from "@/components/upload/DocumentDrop";
import RunButton from "@/components/upload/RunButton";
import Landing from "@/components/landing/Landing";
import ReadingScreen from "@/components/flow/ReadingScreen";
import ReviewScreen from "@/components/flow/ReviewScreen";
import { loadSession, sessionSet, clearAll } from "@/lib/store";

const STAGES = ["Upload", "Read and extract", "Confirm figures", "Diagnosis"];
const STEP = ["", "read", "review", "diagnosis"];
const urlFor = (s) => (s ? `?step=${STEP[s]}` : window.location.pathname);

export default function Home() {
  const [stage, setStage] = useState(0);
  const [health, setHealth] = useState(null);
  const [form, setForm] = useState({ company: "", scope: "", passcode: "" });
  const [docs, setDocs] = useState([]);
  const [runStatus, setRunStatus] = useState("idle");
  const runId = useRef(0);
  const [logItems, setLogItems] = useState([]);
  const [run, setRun] = useState(null);
  const [figs, setFigs] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const logRef = useRef([]);
  const feed = useRef({ events: [], finished: false, error: null });
  const [hydrated, setHydrated] = useState(false);
  const resumeRun = useRef(false), needSummary = useRef(false), fromPop = useRef(false), prevStage = useRef(0);
  const live = useRef({});
  live.current = { stage, run, figs, result, runStatus };

  useEffect(() => { fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => setHealth({})); }, []);

  // Restore the saved analysis, if there is one from the last 24 hours.
  useEffect(() => {
    (async () => {
      let pc = "";
      try { pc = sessionStorage.getItem("aa-passcode") || ""; } catch {}
      const saved = await loadSession();
      const st = saved?.state;
      if (saved?.docs?.length) setDocs(saved.docs.map((d) => ({ ...d, file: { name: d.name, size: d.size } })));
      setForm((f) => ({ ...f, ...(st?.form || {}), passcode: pc }));
      let s = 0;
      if (st) {
        if (st.run) setRun(st.run);
        if (st.figs) setFigs(st.figs);
        if (st.result) setResult(st.result);
        s = st.stage || 0;
        if (s === 3 && !st.result) s = st.run && st.figs ? 2 : 0;
        if (s === 2 && !(st.run && st.figs)) s = 0;
        if (s === 1) { if (st.run && st.figs) s = 2; else { resumeRun.current = true; s = 0; } }
        if (s === 3 && st.result.summary == null && !st.result.summaryError) needSummary.current = true;
      }
      setStage(s); prevStage.current = s;
      window.history.replaceState({ stage: s }, "", urlFor(s));
      setHydrated(true);
    })();
  }, []);

  // A refresh during reading picks up where it stopped; finished steps come from the browser cache.
  useEffect(() => { if (hydrated && resumeRun.current) { resumeRun.current = false; analyse(); } });

  // Save as the user goes. Document text is saved separately because it is large and rarely changes.
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => sessionSet("state", { stage, form: { company: form.company, scope: form.scope }, run, figs, result }), 400);
    return () => clearTimeout(t);
  }, [hydrated, stage, form.company, form.scope, run, figs, result]);
  useEffect(() => {
    if (!hydrated || docs.some((d) => d.status === "reading")) return;
    const t = setTimeout(() => sessionSet("docs", docs.filter((d) => d.status === "done").map((d) => ({ id: d.id, name: d.file.name, size: d.file.size, role: d.role, manual: d.manual, scores: d.scores, status: "done", progress: 100, pages: d.pages }))), 700);
    return () => clearTimeout(t);
  }, [hydrated, docs]);
  useEffect(() => { try { if (form.passcode) sessionStorage.setItem("aa-passcode", form.passcode); } catch {} }, [form.passcode]);

  // Back and forward move between the steps instead of leaving the analysis.
  useEffect(() => {
    if (!hydrated) return;
    const prev = prevStage.current; prevStage.current = stage;
    if (fromPop.current) { fromPop.current = false; return; }
    if (prev === stage) return;
    const replace = prev === 1 && stage === 2;
    window.history[replace ? "replaceState" : "pushState"]({ stage }, "", urlFor(stage));
  }, [stage, hydrated]);
  useEffect(() => {
    const onPop = () => {
      const want = Math.max(0, STEP.indexOf(new URLSearchParams(window.location.search).get("step") || ""));
      const L = live.current;
      let s = want;
      if (s === 3 && !L.result) s = L.run ? 2 : 0;
      if (s === 2 && !(L.run && L.figs)) s = 0;
      if (s === 1 && L.runStatus !== "running") s = L.run && L.figs ? 2 : 0;
      if (L.stage === 1 && s !== 1) { runId.current += 1; setRunStatus("idle"); }
      if (s !== want) window.history.replaceState({ stage: s }, "", urlFor(s));
      fromPop.current = true;
      setStage(s);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // If the page was refreshed before the written summary arrived, ask for it again.
  useEffect(() => {
    if (!hydrated || !needSummary.current || !result) return;
    needSummary.current = false;
    fetchNarrative(result, result.context, form.passcode).then((summary) => setResult((r) => ({ ...r, summary }))).catch((e) => setResult((r) => ({ ...r, summary: "", summaryError: e.message })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const log = {
    start(text) { const id = logRef.current.length; logRef.current = [...logRef.current, { id, text, state: "running" }]; setLogItems(logRef.current); return id; },
    update(id, text) { logRef.current = logRef.current.map((l) => (l.id === id ? { ...l, text } : l)); setLogItems(logRef.current); },
    done(id, text) { logRef.current = logRef.current.map((l) => (l.id === id ? { ...l, text: text || l.text, state: "done" } : l)); setLogItems(logRef.current); },
    fail(id, text) { logRef.current = logRef.current.map((l) => (l.id === id ? { ...l, text, state: "failed" } : l)); setLogItems(logRef.current); },
  };

  const context = { company: form.company.trim(), scope: form.scope.trim() || "Whole company" };

  async function analyse(e) {
    e?.preventDefault();
    if (runStatus === "running") return;
    setError("");
    if (!context.company) { setError("Enter the company name. It is used for the web search."); return; }
    if (docs.some((d) => d.status === "reading")) { setError("Wait for the documents to finish reading."); return; }
    const ar = docs.find((d) => d.role === "AR" && d.status === "done");
    if (!ar) { setError("Add the annual report and mark it as such. The other two documents are optional but improve the diagnosis."); return; }
    const files = { AR: null, IP: null, EC: null }, preread = {};
    for (const d of docs) if (d.role && d.status === "done") { files[d.role] = d.file; preread[d.role] = d.pages; }
    const id = ++runId.current;
    logRef.current = []; setLogItems([]); setRunStatus("running");
    setRun(null); setFigs(null); setResult(null);
    const fd = { events: [], finished: false, error: null };
    feed.current = fd;
    setStage(1); window.scrollTo({ top: 0 });
    try {
      const r = await runPipeline({ files, preread, context, passcode: form.passcode, log, onEvent: (ev) => fd.events.push(ev), isCancelled: () => runId.current !== id });
      if (runId.current !== id) return;
      if (["F1", "F2", "F3", "F4"].every((k) => !Object.keys(r.extraction[k] || {}).length)) {
        const why = (r.errors[0] || "").replace(/^[a-z ]+:\s*/, "") || "nothing could be extracted";
        setError(`The analysis stopped: ${why}`); setRunStatus("idle");
        fd.error = why; fd.finished = true; return;
      }
      setRun(r);
      setFigs(initialFigures(r.extraction, r.profile));
      setRunStatus("idle");
      fd.finished = true;
    } catch (err) {
      if (runId.current !== id || err.message === "CANCELLED") return;
      setRunStatus("idle");
      setError(`The analysis stopped: ${err.message}`);
      fd.error = err.message; fd.finished = true;
    }
  }

  function toReview() { setStage(2); window.scrollTo({ top: 0 }); }

  function cancelRun() {
    runId.current += 1;
    setRunStatus("idle"); setStage(0); setLogItems([]); logRef.current = [];
  }

  const current = [...logItems].reverse().find((l) => l.state === "running");
  const [stepLabel, stepDetail] = current ? current.text.split(/:\s*/) : [null, null];

  async function diagnose() {
    const { extraction, figures } = applyFigures(run.extraction, figs);
    const profile = INDUSTRY_PROFILES[DEFAULT_INDUSTRY];
    const res = runDiagnosis(extraction, figures, profile);
    setResult({ ...res, context, run: { ...run, extraction }, figures: figs, summary: null, generatedAt: new Date().toISOString() });
    setStage(3);
    window.scrollTo({ top: 0 });
    try {
      const summary = await fetchNarrative(res, context, form.passcode);
      setResult((r) => ({ ...r, summary }));
    } catch (e) {
      setResult((r) => ({ ...r, summary: "", summaryError: e.message }));
    }
  }

  // Starting again is the one deliberate way to drop the saved analysis.
  function reset() {
    setStage(0); setRun(null); setFigs(null); setResult(null); setLogItems([]); logRef.current = []; setError("");
    setDocs([]); setRunStatus("idle"); runId.current += 1;
    setForm((f) => ({ company: "", scope: "", passcode: f.passcode }));
    clearAll();
    window.scrollTo({ top: 0 });
  }

  function resume() { setStage(result ? 3 : 2); window.scrollTo({ top: 0 }); }

  if (stage === 1) {
    return (
      <ReadingScreen company={context.company} scope={context.scope} docs={docs} feed={feed}
        onDone={toReview} onCancel={cancelRun} onBack={() => { setStage(0); window.scrollTo({ top: 0 }); }} />
    );
  }

  if (stage === 2 && run && figs) {
    return (
      <ReviewScreen context={context} run={run} figs={figs} setFigs={setFigs} onDiagnose={diagnose} onReset={reset} />
    );
  }

  if (stage === 0) {
    return (
      <Landing testMode={health?.mock} saved={hydrated && run && figs ? { company: run.company || form.company, at: result ? "the diagnosis" : "the review", onResume: resume, onReset: reset } : null}>
        <form className="upload lx-form" onSubmit={analyse}>
          <div className="lx-form-grid">
            <fieldset className="lx-box" disabled={stage === 1}>
              <h3>The company</h3>
              <label>Company name
                <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="e.g. Bajaj Auto Limited" />
              </label>
              <label>Part of the business to analyse <em>optional</em>
                <input value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} placeholder="e.g. Indian passenger-vehicle business only" />
              </label>
              <p className="lx-industry-note"><b>Industry</b> Indian automobile manufacturers. Industry-level indicators come from the {INDUSTRY_PROFILES[DEFAULT_INDUSTRY].source}.</p>
            </fieldset>
            <section className="lx-box">
              <h3>Documents</h3>
              <DocumentDrop docs={docs} setDocs={setDocs} disabled={stage === 1} />
            </section>
          </div>

          <div className="lx-form-foot">
            <div className="lx-industry">
              {health?.passcodeRequired && (
                <label className="lx-code">Access code
                  <input type="password" value={form.passcode} disabled={stage === 1} onChange={(e) => setForm({ ...form, passcode: e.target.value })} placeholder="From the project team" />
                </label>
              )}
              {health && !health.mock && (!health.gemini || !health.tavily) && (
                <p className="warn">The server is missing {[!health.gemini && "the Gemini key", !health.tavily && "the Tavily key"].filter(Boolean).join(" and ")}. Add it in the hosting settings before running an analysis.</p>
              )}
            </div>
            <RunButton status={runStatus} step={stepLabel} detail={stepDetail} onRun={analyse} onCancel={cancelRun} disabled={docs.some((d) => d.status === "reading")} />
          </div>

          {error && <p className="error" role="alert">{error}</p>}
        </form>
      </Landing>
    );
  }

  return (
    <main>
      <header className="masthead">
        <div className="wrap">
          <div className="brand">
            <h1>Ambidexterity Analyzer</h1>
            <p>How well does an organization balance exploring the new with exploiting what it already does well? Upload a company's public documents and the tool reads them, scores four organization-theory frameworks and shows the evidence behind every conclusion.</p>
          </div>
          <ol className="stages" aria-label="Progress">
            {STAGES.map((s, i) => (
              <li key={s} className={i === stage ? "now" : i < stage ? "past" : ""}><span>{i + 1}</span>{s}</li>
            ))}
          </ol>
        </div>
      </header>

      <div className="wrap body">
        {stage === 3 && result && <Results result={result} onReset={reset} />}
      </div>
      <footer className="wrap foot">Designing Work Organisations, IIM Lucknow. Frameworks from Daft and Uppal (2020), Duncan (1972), Miles and Snow (1978), March (1991) and O'Reilly and Tushman (2004).</footer>
    </main>
  );
}
