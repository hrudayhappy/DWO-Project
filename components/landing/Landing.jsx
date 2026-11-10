"use client";
// The landing page. Top half teaches: a balance line from exploration to exploitation and three
// scenes for wherever it is set. Bottom half is the tool: what it does, then the inputs.
import { useEffect, useState } from "react";
import { ArrowUpRight, FileStack, ScanSearch, Gauge } from "lucide-react";
import BalanceSlider from "./BalanceSlider";
import SceneRow from "./SceneRow";
import { REGIMES, zoneOf } from "./content";

const clamp = (v) => Math.min(1, Math.max(0, v));

export default function Landing({ children, testMode }) {
  const [value, setValue] = useState(0.5);
  const regime = REGIMES[zoneOf(value)];

  useEffect(() => {
    document.documentElement.classList.add("lx-html");
    return () => document.documentElement.classList.remove("lx-html");
  }, []);

  const go = (id) => (ev) => { ev.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); };

  return (
    <main className="lx" data-regime={regime.key} style={{ "--ember-k": clamp(1.3 - 1.6 * value), "--ice-k": clamp(1.6 * value - 0.3) }}>
      <div className="lx-glow" aria-hidden="true"><i className="g1" /><i className="g2" /><i className="g3" /></div>
      <div className="lx-page">
        <header className="lx-nav">
          <a className="lx-brand" href="#top" onClick={go("top")}><span className="lx-mark" aria-hidden="true" /><b>Ambidexterity</b> Analyzer</a>
          <nav className="lx-pills" aria-label="Sections">
            <a href="#top" onClick={go("top")}>Overview</a>
            <a href="#how" onClick={go("how")}>How it works</a>
            <a href="#analyse" onClick={go("analyse")}>Analyse</a>
          </nav>
          <span className="lx-course">IIM Lucknow · DWO</span>
        </header>

        <section className="lx-hero" id="top">
          <div>
            <p className="lx-chip lx-hello"><i aria-hidden="true" />Designing Work Organisations</p>
            <h1>Explore <em>{regime.joiner}</em><br />exploit{regime.mark}</h1>
            <p className="lx-verdict"><b>{regime.verdict[0]}</b> {regime.verdict[1]}</p>
          </div>
          <p className="lx-intro">Every company splits its effort between exploring new things and exploiting what it already does well. Lean too far either way and it falls into a trap. Move the slider to see how each choice shapes the organisation.</p>
        </section>

        <BalanceSlider value={value} onChange={setValue} />
        <SceneRow regime={regime} />

        <section className="lx-offer" id="how">
          <div className="lx-offer-text">
            <p className="lx-chip"><i aria-hidden="true" />The analyzer</p>
            <h2>Where does your company sit?</h2>
            <p>Give it a company&apos;s annual report, investor presentation and earnings-call transcript. It reads the structure, strategy and spending against four organisation-design frameworks, works out where the company sits between exploration and exploitation, and shows the evidence behind every call.</p>
            <a className="lx-cta" href="#analyse" onClick={go("analyse")}>Analyse a company<span aria-hidden="true"><ArrowUpRight size={18} strokeWidth={2.2} /></span></a>
          </div>
          <ol className="lx-steps">
            <li><span className="lx-tile" aria-hidden="true"><FileStack size={19} strokeWidth={1.8} /></span><div><b>Upload</b><span>Annual report, presentation and call transcript</span></div></li>
            <li><span className="lx-tile" aria-hidden="true"><ScanSearch size={19} strokeWidth={1.8} /></span><div><b>Read</b><span>Evidence checked against four frameworks</span></div></li>
            <li><span className="lx-tile" aria-hidden="true"><Gauge size={19} strokeWidth={1.8} /></span><div><b>Diagnose</b><span>Where it sits, and what to change</span></div></li>
          </ol>
        </section>

        <section className="lx-analyse" id="analyse" aria-labelledby="lx-analyse-h">
          <div className="lx-analyse-head">
            <h2 id="lx-analyse-h">Analyse a company</h2>
            {testMode && <span className="lx-chip lx-test"><i aria-hidden="true" />Test mode: AI responses are simulated</span>}
          </div>
          {children}
        </section>
      </div>
      <footer className="lx-foot">Frameworks from Daft and Uppal (2020), Duncan (1972), Miles and Snow (1978), March (1991) and O&apos;Reilly and Tushman (2004).</footer>
    </main>
  );
}
