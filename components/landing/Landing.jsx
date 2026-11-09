"use client";
// The landing page: a colour field that follows the balance line, the upload form on the left
// and the animation stage on the right.
import { useEffect, useState } from "react";
import BalanceSlider from "./BalanceSlider";
import Stage from "./Stage";
import { REGIMES, zoneOf } from "./content";

export default function Landing({ children }) {
  const [value, setValue] = useState(0.5);
  const regime = REGIMES[zoneOf(value)];
  const { field, accent, ink } = regime.colors;

  // the page behind the landing takes the field colour too, so overscroll matches
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("ld-html"); html.style.setProperty("--ld-field", field);
    return () => { html.classList.remove("ld-html"); html.style.removeProperty("--ld-field"); };
  }, [field]);

  return (
    <main className="landing" data-regime={regime.key} style={{ "--field": field, "--accent": accent, "--ld-ink": ink, "--s": value }}>
      <div className="ld-grid" aria-hidden="true" />
      <div className="ld-page">
        <header className="ld-top">
          <div className="ld-brand"><b>Ambidexterity</b><small>Analyzer</small></div>
          <div className="ld-course">Designing Work Organisations · IIM Lucknow</div>
        </header>

        <section className="ld-hero">
          <div>
            <h1>Explore <em>{regime.joiner}</em><br />exploit{regime.mark}</h1>
            <p className="ld-verdict"><b>{regime.verdict[0]}</b> {regime.verdict[1]}</p>
          </div>
          <p className="ld-intro">Upload a company&apos;s annual report, investor presentation and call transcript. The analyzer reads its structure and spending, works out where it sits between these two ends, and shows the evidence behind every call.</p>
        </section>

        <BalanceSlider value={value} onChange={setValue} />

        <div className="ld-cols">
          <div className="ld-form">{children}</div>
          <Stage regime={regime} />
        </div>
      </div>
      <footer className="ld-foot">Frameworks from Daft and Uppal (2020), Duncan (1972), Miles and Snow (1978), March (1991) and O&apos;Reilly and Tushman (2004).</footer>
    </main>
  );
}
