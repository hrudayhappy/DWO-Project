"use client";
import { useEffect, useRef, useState } from "react";
import { runPipeline, initialFigures, applyFigures, fetchNarrative, FIGURES } from "@/lib/pipeline";
import { runDiagnosis } from "@/lib/engine";
import { INDUSTRY_PROFILES, DEFAULT_INDUSTRY } from "@/lib/industryProfile";
import Results from "@/components/Results";
import DocumentDrop from "@/components/upload/DocumentDrop";
import ParentSwitch from "@/components/upload/ParentSwitch";
import RunButton from "@/components/upload/RunButton";
import Landing from "@/components/landing/Landing";

const STAGES = ["Upload", "Read and extract", "Confirm figures", "Diagnosis"];

export default function Home() {
  const [stage, setStage] = useState(0);
  const [health, setHealth] = useState(null);
  const [form, setForm] = useState({ company: "", scope: "", parentTech: false, passcode: "" });
  const [docs, setDocs] = useState([]);
  const [runStatus, setRunStatus] = useState("idle");
  const runId = useRef(0);
  const [logItems, setLogItems] = useState([]);
  const [run, setRun] = useState(null);
  const [figs, setFigs] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const logRef = useRef([]);

  useEffect(() => { fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => setHealth({})); }, []);

  const log = {
    start(text) { const id = logRef.current.length; logRef.current = [...logRef.current, { id, text, state: "running" }]; setLogItems(logRef.current); return id; },
    update(id, text) { logRef.current = logRef.current.map((l) => (l.id === id ? { ...l, text } : l)); setLogItems(logRef.current); },
    done(id, text) { logRef.current = logRef.current.map((l) => (l.id === id ? { ...l, text: text || l.text, state: "done" } : l)); setLogItems(logRef.current); },
    fail(id, text) { logRef.current = logRef.current.map((l) => (l.id === id ? { ...l, text, state: "failed" } : l)); setLogItems(logRef.current); },
  };

  const context = { company: form.company.trim(), scope: form.scope.trim() || "Whole company", parentTech: form.parentTech };

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
    logRef.current = []; setLogItems([]); setStage(1); setRunStatus("running");
    try {
      const r = await runPipeline({ files, preread, context, passcode: form.passcode, log, isCancelled: () => runId.current !== id });
      if (runId.current !== id) return;
      setRun(r);
      setFigs(initialFigures(r.extraction));
      setRunStatus("done");
      setTimeout(() => { if (runId.current === id) { setStage(2); setRunStatus("idle"); window.scrollTo({ top: 0, behavior: "smooth" }); } }, 1100);
    } catch (err) {
      if (runId.current !== id || err.message === "CANCELLED") return;
      setRunStatus("failed");
      setError(`The analysis stopped: ${err.message}`);
    }
  }

  function cancelRun() {
    runId.current += 1;
    setRunStatus("idle"); setStage(0); setLogItems([]); logRef.current = [];
  }

  const current = [...logItems].reverse().find((l) => l.state === "running");
  const [stepLabel, stepDetail] = current ? current.text.split(/:\s*/) : [null, null];

  async function diagnose() {
    const { extraction, figures } = applyFigures(run.extraction, figs);
    const profile = INDUSTRY_PROFILES[DEFAULT_INDUSTRY];
    const res = runDiagnosis(extraction, figures, profile, { parentTech: form.parentTech });
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

  function reset() {
    setStage(0); setRun(null); setFigs(null); setResult(null); setLogItems([]); logRef.current = []; setError("");
    setDocs([]); setRunStatus("idle"); runId.current += 1;
  }

  if (stage <= 1) {
    return (
      <Landing testMode={health?.mock}>
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
              <div className="psw-slot">
                <ParentSwitch on={form.parentTech} onChange={(v) => setForm({ ...form, parentTech: v })} disabled={stage === 1} />
              </div>
            </fieldset>
            <section className="lx-box">
              <h3>Documents</h3>
              <DocumentDrop docs={docs} setDocs={setDocs} disabled={stage === 1} />
            </section>
          </div>

          <div className="lx-form-foot">
            <div className="lx-industry">
              <p><b>Industry</b> Indian automobile manufacturers. Industry-level indicators come from the {INDUSTRY_PROFILES[DEFAULT_INDUSTRY].source}.</p>
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
          {stage === 1 && logItems.length > 0 && (
            <ul className="log compact runlog lx-log" aria-label="Progress">
              {logItems.map((l) => <li key={l.id} className={l.state}>{l.text}</li>)}
            </ul>
          )}
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
        {stage === 2 && figs && (
          <section className="panel confirm">
            <h2>Confirm the key figures</h2>
            <p className="hint">These figures drive the ratios in the diagnosis. Check them against the documents, correct any that are wrong, and fill in any that are missing. Leave a field empty if the figure is not available.</p>
            <ul className="log compact">{logItems.map((l) => <li key={l.id} className={l.state}>{l.text}</li>)}</ul>
            <table className="figs">
              <thead><tr><th>Figure</th><th>Value</th><th>Source</th></tr></thead>
              <tbody>
                {FIGURES.map((f) => {
                  const st = figs[f.key];
                  const ev = st.evidence[0];
                  return (
                    <tr key={f.key}>
                      <td>{f.label}</td>
                      <td className="val">
                        <input inputMode="decimal" value={st.value} aria-label={f.label} onChange={(e) => setFigs({ ...figs, [f.key]: { ...st, value: e.target.value.replace(/[^0-9.]/g, "") } })} />
                        <span>{f.unit}</span>
                      </td>
                      <td className="src">{ev ? <><b>{ev.doc === "WEB" ? "Web" : ev.doc} {ev.page ? `p.${ev.page}` : ""}</b> “{ev.quote}”</> : <span className="muted">Not found in the documents</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="actions">
              <button className="primary" onClick={diagnose}>Run the diagnosis</button>
              <button className="secondary" onClick={reset}>Start again</button>
            </div>
          </section>
        )}

        {stage === 3 && result && <Results result={result} onReset={reset} />}
      </div>
      <footer className="wrap foot">Designing Work Organisations, IIM Lucknow. Frameworks from Daft and Uppal (2020), Duncan (1972), Miles and Snow (1978), March (1991) and O'Reilly and Tushman (2004).</footer>
    </main>
  );
}
