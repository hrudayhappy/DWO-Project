"use client";
import { useEffect, useRef, useState } from "react";
import { runPipeline, initialFigures, applyFigures, fetchNarrative, FIGURES } from "@/lib/pipeline";
import { runDiagnosis } from "@/lib/engine";
import { INDUSTRY_PROFILES, DEFAULT_INDUSTRY } from "@/lib/industryProfile";
import Results from "@/components/Results";

const STAGES = ["Upload", "Read and extract", "Confirm figures", "Diagnosis"];

export default function Home() {
  const [stage, setStage] = useState(0);
  const [health, setHealth] = useState(null);
  const [form, setForm] = useState({ company: "", scope: "", parentTech: false, passcode: "" });
  const [files, setFiles] = useState({ AR: null, IP: null, EC: null });
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
    e.preventDefault();
    setError("");
    if (!files.AR) { setError("Add the annual report to start. The other two documents are optional but improve the diagnosis."); return; }
    if (!context.company) { setError("Enter the company name. It is used for the web search."); return; }
    logRef.current = []; setLogItems([]); setStage(1);
    try {
      const r = await runPipeline({ files, context, passcode: form.passcode, log });
      setRun(r);
      setFigs(initialFigures(r.extraction));
      setStage(2);
    } catch (err) {
      setError(`The analysis stopped: ${err.message}`);
    }
  }

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
    setFiles({ AR: null, IP: null, EC: null });
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
        {stage === 0 && (
          <form className="upload" onSubmit={analyse}>
            <section className="panel">
              <h2>The company</h2>
              <label>Company name
                <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="e.g. Bajaj Auto Limited" />
              </label>
              <label>Part of the business to analyse <em>optional</em>
                <input value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} placeholder="e.g. Indian passenger-vehicle business only" />
              </label>
              <label className="check">
                <input type="checkbox" checked={form.parentTech} onChange={(e) => setForm({ ...form, parentTech: e.target.checked })} />
                The company relies on a parent company for much of its technology
              </label>
            </section>

            <section className="panel">
              <h2>Documents</h2>
              <p className="hint">PDFs are read in your browser; only the relevant pages are sent for analysis.</p>
              {[["AR", "Annual report", "Required. The most recent integrated or annual report."], ["IP", "Investor presentation", "Optional. The latest quarterly results presentation."], ["EC", "Earnings-call transcript", "Optional. The latest quarterly call transcript."]].map(([id, name, note]) => (
                <label key={id} className={`file ${files[id] ? "has" : ""}`}>
                  <span className="fname">{name}</span>
                  <span className="fnote">{files[id] ? files[id].name : note}</span>
                  <input type="file" accept="application/pdf" onChange={(e) => setFiles({ ...files, [id]: e.target.files[0] || null })} />
                </label>
              ))}
            </section>

            <section className="panel">
              <h2>Industry</h2>
              <p>Indian automobile manufacturers. Industry-level indicators come from the {INDUSTRY_PROFILES[DEFAULT_INDUSTRY].source}.</p>
              {health?.passcodeRequired && (
                <label>Access code
                  <input type="password" value={form.passcode} onChange={(e) => setForm({ ...form, passcode: e.target.value })} placeholder="Provided by the project team" />
                </label>
              )}
              {health && !health.mock && (!health.gemini || !health.tavily) && (
                <p className="warn">The server is missing {[!health.gemini && "the Gemini key", !health.tavily && "the Tavily key"].filter(Boolean).join(" and ")}. Add it in the hosting settings before running an analysis.</p>
              )}
              {health?.mock && <p className="warn">Test mode: AI responses are simulated.</p>}
            </section>

            {error && <p className="error" role="alert">{error}</p>}
            <button className="primary" type="submit">Analyse documents</button>
          </form>
        )}

        {stage === 1 && (
          <section className="panel progress" aria-live="polite">
            <h2>Reading and extracting evidence</h2>
            <p className="hint">Large annual reports take a minute to read. Keep this tab open.</p>
            <ul className="log">
              {logItems.map((l) => <li key={l.id} className={l.state}>{l.text}</li>)}
            </ul>
            {error && <><p className="error" role="alert">{error}</p><button className="secondary" onClick={reset}>Start again</button></>}
          </section>
        )}

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
