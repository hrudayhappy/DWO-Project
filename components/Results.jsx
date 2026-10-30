"use client";
import { useState } from "react";
import { FRAMEWORKS, DOC_LABELS, EVIDENCE_TYPES } from "@/lib/indicators";

const CONF_TEXT = { high: "High confidence", medium: "Medium confidence", low: "Low confidence", insufficient: "Not enough evidence" };

function Conf({ level }) {
  return <span className={`conf ${level}`}>{CONF_TEXT[level] || level}</span>;
}

function Rating({ score }) {
  if (score == null) return <span className="muted">Not rated</span>;
  return (
    <span className="rating" aria-label={`Rating ${score} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => <i key={i} className={score >= i ? "on" : score >= i - 0.5 ? "half" : ""} />)}
      <b>{score}</b>
    </span>
  );
}

function EvidenceCard({ e }) {
  const where = e.doc === "WEB" ? (
    <a href={e.url} target="_blank" rel="noreferrer">{e.title || e.url}</a>
  ) : e.doc === "USER" ? "Confirmed by the user" : `${DOC_LABELS[e.doc] || e.doc}, page ${e.page}`;
  return (
    <li className="ev">
      <blockquote>“{e.quote}”</blockquote>
      <div className="evmeta"><span>{where}</span><span className="tag">{EVIDENCE_TYPES[e.type] || "Evidence"}</span></div>
    </li>
  );
}

function IndicatorRow({ ind }) {
  const [open, setOpen] = useState(false);
  const isStatement = ["S1", "S2", "S3", "S4", "A4"].includes(ind.id);
  return (
    <>
      <tr className={open ? "open" : ""}>
        <td><span className="iname">{ind.name}</span><span className="idef">{ind.definition}</span></td>
        <td>{ind.value || <span className="muted">{ind.note || "No evidence found"}</span>}</td>
        <td>{isStatement ? <span className="muted">Not rated</span> : <Rating score={ind.score} />}</td>
        <td><Conf level={ind.confidence} /></td>
        <td><button className="link" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Hide evidence" : "Show evidence"}</button></td>
      </tr>
      {open && (
        <tr className="drawer">
          <td colSpan={5}>
            <div className="why">
              <p><b>Rule applied.</b> {ind.rule}</p>
              {ind.note && ind.value && <p className="note">{ind.note}</p>}
              {ind.items?.length > 0 && !isStatement && (
                <p><b>Items counted.</b> {ind.items.join("; ")}</p>
              )}
              {ind.evidence.length ? (
                <ul className="evs">{ind.evidence.slice(0, 12).map((e, i) => <EvidenceCard key={i} e={e} />)}</ul>
              ) : (
                <p className="muted">No verified evidence. The indicator is excluded from the calculation rather than scored at zero; a manager would need internal information to rate it.</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function FrameworkSection({ fw, data }) {
  const meta = FRAMEWORKS.find((f) => f.id === fw);
  const groups = [];
  for (const ind of data.indicators) {
    const g = ind.group || "";
    if (!groups.length || groups[groups.length - 1].g !== g) groups.push({ g, items: [] });
    groups[groups.length - 1].items.push(ind);
  }
  const headline = {
    F1: data.status === "ok" ? `Complexity ${data.scores.complexity}, change ${data.scores.change}` : null,
    F2: data.status === "ok" ? `${data.scores.exploratoryShare}% exploratory and ${data.scores.exploitativeShare}% exploitative statements (${data.scores.statements} classified)` : null,
    F3: data.status === "ok" ? `Exploration ${data.scores.exploration}, exploitation ${data.scores.exploitation}` : null,
    F4: data.scores.core != null ? `Core organization: ${data.scores.coreLabel} (${data.scores.core})` : null,
  }[fw];
  return (
    <section className={`fw ${meta.colour}`} id={fw}>
      <header>
        <p className="fwq">{meta.question}</p>
        <h3>{meta.name}</h3>
        <p className="basis">{meta.basis}</p>
      </header>
      <div className="fwout">
        <div>
          <p className="out">{data.output}</p>
          {headline && <p className="sub">{headline}</p>}
          {(data.implication || data.meaning) && <p>{data.implication || data.meaning}</p>}
          {data.parentFlag && <p className="note">{data.parentFlag}</p>}
          {data.status !== "ok" && <p className="note">Fewer than 60 per cent of this framework's indicators have medium or high confidence, so no output is reported. Adding the investor presentation or earnings-call transcript usually helps.</p>}
        </div>
        <div className="fwrule"><Conf level={data.confidence} /><p>{data.rule}</p></div>
      </div>
      <table className="inds">
        <thead><tr><th>Indicator</th><th>What was found</th><th>Rating</th><th>Confidence</th><th><span className="sr">Evidence</span></th></tr></thead>
        <tbody>
          {groups.map((g) => (
            <GroupRows key={g.g} g={g} />
          ))}
        </tbody>
      </table>
      {fw === "F2" && data.statements?.length > 0 && <Statements list={data.statements} />}
    </section>
  );
}
function GroupRows({ g }) {
  return (
    <>
      {g.g && <tr className="grp"><td colSpan={5}>{g.g}</td></tr>}
      {g.items.map((ind) => <IndicatorRow key={ind.id} ind={ind} />)}
    </>
  );
}

function Statements({ list }) {
  const [open, setOpen] = useState(false);
  const LBL = { exploratory: "Exploratory", exploitative: "Exploitative", both: "Both", neither: "Neither" };
  return (
    <div className="stmts">
      <button className="link" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Hide" : "Show"} all {list.length} classified statements</button>
      {open && (
        <ul className="evs">
          {list.map((s, i) => (
            <li key={i} className="ev">
              <blockquote>“{s.quote}”</blockquote>
              <div className="evmeta"><span>{DOC_LABELS[s.doc]}, page {s.page}{s.is_priority ? " · declared priority" : ""}</span><span className={`tag lbl-${s.label}`}>{LBL[s.label]}</span></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DiagnosisMap({ result }) {
  const f = result.frameworks;
  const cells = FRAMEWORKS.map((m) => ({ ...m, out: f[m.id].output, conf: f[m.id].confidence }));
  return (
    <div className="map" role="img" aria-label="Diagnosis map: four dimensions and the resulting flags">
      <div className="lenses">
        {cells.map((c) => (
          <a key={c.id} href={`#${c.id}`} className={`lens ${c.colour}`}>
            <span className="lq">{c.short}</span>
            <span className="lo">{c.out}</span>
            <span className="lc">{CONF_TEXT[c.conf]}</span>
          </a>
        ))}
      </div>
      <div className="arrow" aria-hidden="true" />
      <div className={`verdict ${result.flags.length ? "misfit" : result.complete ? "fit" : "partial"}`}>
        <span className="vt">{result.verdict}</span>
        {result.flags.length > 0 && <span className="vf">{result.flags.map((x) => x.flag).join(" · ")}</span>}
      </div>
    </div>
  );
}

function Flag({ flag }) {
  return (
    <article className="flag">
      <header>
        <h4>{flag.flag}</h4>
        <Conf level={flag.confidence} />
      </header>
      <p><b>{flag.compared}.</b> {flag.condition}. {flag.meaning}.</p>
      <p className="muted">Check internally before acting: {flag.internalCheck}</p>
      <div className="opts">
        {flag.recommendations.map((r, i) => (
          <div className="opt" key={i}>
            <h5>Option {String.fromCharCode(65 + i)}: {r.option}</h5>
            <dl>
              <dt>Benefits</dt><dd>{r.benefits}</dd>
              <dt>Risks</dt><dd>{r.risks}</dd>
              <dt>Trade-off</dt><dd>{r.tradeoffs}</dd>
              <dt>Assumes</dt><dd>{r.assumptions}</dd>
            </dl>
          </div>
        ))}
      </div>
    </article>
  );
}

export default function Results({ result, onReset }) {
  const { context, run } = result;
  const download = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(context.company || "diagnosis").replace(/\W+/g, "_")}_ambidexterity_diagnosis.json`;
    a.click();
  };
  return (
    <div className="results">
      <section className="lead">
        <p className="who">{context.company}{context.scope && context.scope !== "Whole company" ? ` · ${context.scope}` : ""}</p>
        <DiagnosisMap result={result} />
        <div className="summary">
          {result.summary === null && <p className="muted">Writing the summary…</p>}
          {result.summary && result.summary.split(/\n+/).map((p, i) => <p key={i}>{p}</p>)}
          {result.summaryError && <p className="muted">The written summary could not be generated ({result.summaryError}). The diagnosis below is complete.</p>}
        </div>
        <div className="actions noprint">
          <button className="secondary" onClick={() => window.print()}>Print or save as PDF</button>
          <button className="secondary" onClick={download}>Download results</button>
          <button className="secondary" onClick={onReset}>Analyse another company</button>
        </div>
      </section>

      <section className="flags">
        <h2>{result.flags.length ? "Misfits and design options" : "Diagnostic rules"}</h2>
        {result.flags.length ? result.flags.map((fl) => <Flag key={fl.flag} flag={fl} />) : (
          <p>No diagnostic rule was triggered by the evidence available. {result.complete ? "The four dimensions are consistent with one another." : "Some dimensions lacked enough evidence, so the absence of flags is not proof of fit."}</p>
        )}
      </section>

      <h2 className="sec">How each framework was scored</h2>
      {["F1", "F2", "F3", "F4"].map((fw) => <FrameworkSection key={fw} fw={fw} data={result.frameworks[fw]} />)}

      <section className="panel method">
        <h2>Evidence trail</h2>
        <p>{run.stats.verified} of {run.stats.total} quotations were verified against their cited page and used; {run.stats.total - run.stats.verified} could not be verified and were discarded. Documents read: {run.docsRead.map((d) => `${DOC_LABELS[d.id]} (${d.pages} pages)`).join(", ")}.</p>
        {run.errors.length > 0 && <p className="note">Steps that did not complete: {run.errors.join("; ")}.</p>}
        <p className="muted">What public documents cannot show: actual decision rights, the targets and budgets applied to new units, informal coordination and culture. These should be confirmed with management before acting on the diagnosis.</p>
      </section>
    </div>
  );
}
