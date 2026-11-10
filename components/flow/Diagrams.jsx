"use client";
// Theory diagrams for the four frameworks. They explain the theory only; where the company
// falls is shown on the diagnosis page.

function Duncan() {
  const cells = [
    { k: "md", t: "Moderate to high", d: "Organic and adaptable. Sustained exploration is needed." },
    { k: "hi", t: "High uncertainty", d: "Organic, with much boundary spanning. Both modes are needed: ambidexterity." },
    { k: "lo", t: "Low uncertainty", d: "Mechanistic and formal. Efficiency is rewarded." },
    { k: "lm", t: "Low to moderate", d: "Mechanistic, with some boundary spanning. Efficiency first, selective exploration." },
  ];
  return (
    <figure className="dg">
      <div className="dg-frame">
        <div className="dg-yaxis"><span>Change</span><small>stable to dynamic</small></div>
        <div className="dg-matrix">
          {cells.map((c) => <div key={c.k} className={`dg-cell ${c.k}`}><b>{c.t}</b><span>{c.d}</span></div>)}
        </div>
        <div className="dg-xaxis"><span>Complexity</span><small>simple to complex</small></div>
      </div>
      <figcaption>The more complex and fast-changing the environment, the more uncertain it is, and the more organic the organisation needs to be.</figcaption>
    </figure>
  );
}

// Strategy type from the share of statements that are exploratory and exploitative.
function MilesSnow() {
  const X = (p) => 46 + p * 2.4, Y = (p) => 206 - p * 1.96;
  return (
    <figure className="dg">
      <svg viewBox="0 0 300 240" className="dg-svg" role="img" aria-label="Strategy types by share of exploratory and exploitative statements">
        <rect x={X(0)} y={Y(100)} width={X(100) - X(0)} height={Y(0) - Y(100)} className="dg-bg" />
        <rect x={X(30)} y={Y(100)} width={X(100) - X(30)} height={Y(30) - Y(100)} className="dg-r r2" />
        <rect x={X(60)} y={Y(30)} width={X(100) - X(60)} height={Y(0) - Y(30)} className="dg-r r3" />
        <rect x={X(0)} y={Y(100)} width={X(30) - X(0)} height={Y(60) - Y(100)} className="dg-r r3" />
        <text x={(X(30) + X(100)) / 2} y={(Y(100) + Y(30)) / 2} className="dg-l">Analyzer</text>
        <text x={(X(30) + X(100)) / 2} y={(Y(100) + Y(30)) / 2 + 15} className="dg-s">does both</text>
        <text x={(X(60) + X(100)) / 2} y={(Y(30) + Y(0)) / 2 - 2} className="dg-l">Prospector</text>
        <text x={(X(60) + X(100)) / 2} y={(Y(30) + Y(0)) / 2 + 13} className="dg-s">new products, markets</text>
        <text x={(X(0) + X(30)) / 2} y={(Y(100) + Y(60)) / 2 - 2} className="dg-l">Defender</text>
        <text x={(X(0) + X(30)) / 2} y={(Y(100) + Y(60)) / 2 + 13} className="dg-s">efficiency</text>
        <text x={(X(0) + X(60)) / 2} y={(Y(30) + Y(0)) / 2 + 4} className="dg-s faint">no clear type</text>
        {[0, 30, 60, 100].map((p) => <text key={`x${p}`} x={X(p)} y={Y(0) + 14} className="dg-t">{p}%</text>)}
        {[30, 60, 100].map((p) => <text key={`y${p}`} x={X(0) - 6} y={Y(p) + 3} className="dg-t end">{p}%</text>)}
        <text x={(X(0) + X(100)) / 2} y={236} className="dg-ax">Exploratory statements</text>
        <text x={12} y={(Y(0) + Y(100)) / 2} className="dg-ax" transform={`rotate(-90 12 ${(Y(0) + Y(100)) / 2})`}>Exploitative statements</text>
      </svg>
      <figcaption>Reactor: fewer than five statements of intent, or two or more contradictions between documents, wherever the shares fall.</figcaption>
    </figure>
  );
}

// Exploration and exploitation scores (1 to 5) read together.
function March() {
  const X = (s) => 46 + (s - 1) * 56, Y = (s) => 226 - (s - 1) * 54;
  const pts = (list) => list.map(([a, b]) => `${X(a)},${Y(b)}`).join(" ");
  return (
    <figure className="dg">
      <svg viewBox="0 0 300 262" className="dg-svg" role="img" aria-label="Exploration and exploitation scores and what they mean">
        <rect x={X(1)} y={Y(5)} width={X(5) - X(1)} height={Y(1) - Y(5)} className="dg-bg" />
        <polygon points={pts([[1.75, 1], [5, 1], [5, 4.25]])} className="dg-r r2" />
        <polygon points={pts([[1, 1.75], [1, 5], [4.25, 5]])} className="dg-r r2" />
        <polygon points={pts([[1, 1], [1.75, 1], [5, 4.25], [5, 5], [4.25, 5], [1, 1.75]])} className="dg-r r1" />
        <polygon points={pts([[3.5, 3.5], [3.5, 4.25], [4.25, 5], [5, 5], [5, 4.25], [4.25, 3.5]])} className="dg-r r4" />
        <text x={X(4.3)} y={Y(4.45)} className="dg-l">Ambidextrous</text>
        <text x={X(2.35)} y={Y(2.15)} className="dg-s" transform={`rotate(-44 ${X(2.35)} ${Y(2.15)})`}>balanced, at a modest level</text>
        <text x={X(4.05)} y={Y(1.95)} className="dg-l">Exploration-led</text>
        <text x={X(4.05)} y={Y(1.95) + 14} className="dg-s">risk: failure trap</text>
        <text x={X(1.95)} y={Y(4.2)} className="dg-l">Exploitation-led</text>
        <text x={X(1.95)} y={Y(4.2) + 14} className="dg-s">risk: success trap</text>
        {[1, 2, 3, 4, 5].map((s) => <text key={`x${s}`} x={X(s)} y={Y(1) + 14} className="dg-t">{s}</text>)}
        {[2, 3, 4, 5].map((s) => <text key={`y${s}`} x={X(1) - 6} y={Y(s) + 3} className="dg-t end">{s}</text>)}
        <text x={(X(1) + X(5)) / 2} y={258} className="dg-ax">Exploration score</text>
        <text x={12} y={(Y(1) + Y(5)) / 2} className="dg-ax" transform={`rotate(-90 12 ${(Y(1) + Y(5)) / 2})`}>Exploitation score</text>
      </svg>
      <figcaption>Each score is the average of its indicators. Within three quarters of a point of each other, the two count as balanced.</figcaption>
    </figure>
  );
}

function Design() {
  // Organic on the left and mechanistic on the right, the same way round as the score below
  // and the exploration-to-exploitation line on the first page.
  const rows = [
    ["Hierarchy", "Flat, few levels", "Tall, many levels"],
    ["Decisions", "Delegated to the people closest to the work", "Kept at the top"],
    ["Rules", "Few, flexible", "Many, written down"],
    ["Coordination", "Teams work across departments", "Separate departments, joined only through managers"],
    ["Roles", "Broad and changing", "Narrow and fixed"],
  ];
  return (
    <figure className="dg">
      <table className="dg-table">
        <thead><tr><th /><th><i className="ember" aria-hidden="true" />Organic</th><th><i className="ice" aria-hidden="true" />Mechanistic</th></tr></thead>
        <tbody>{rows.map(([a, o, m]) => <tr key={a}><th scope="row">{a}</th><td>{o}</td><td>{m}</td></tr>)}</tbody>
      </table>
      <div className="dg-scale">
        <p>The four core signals are each scored 1 to 5 and averaged</p>
        <div className="dg-scale-bar" role="img" aria-label="An average of 2.5 or less is organic, 3.5 or more is mechanistic, and anything between is mixed">
          <span>Organic<small>1 to 2.5</small></span><span className="mix">Mixed</span><span>Mechanistic<small>3.5 to 5</small></span>
        </div>
      </div>
      <div className="dg-amb">
        <div className="dg-amb-y"><span>Integration at the top</span><small>low to high</small></div>
        <div className="dg-amb-grid">
          <div className="dg-cell c">
            <b>Risk of constraint</b><span>The core's routines hold the new unit back</span>
          </div>
          <div className="dg-cell hi"><b>Structural ambidexterity</b><span>Separate, autonomous, joined at the top</span></div>
          <div className="dg-cell lo"><b>Risk of isolation</b><span>Cut off from the core's resources</span></div>
        </div>
        <div className="dg-amb-x"><span>Autonomy of the new unit</span><small>low to high</small></div>
      </div>
      <figcaption>With no separate unit, an organic core can still balance both (contextual ambidexterity). A unit brought back into the core is read as a sequential adjustment.</figcaption>
    </figure>
  );
}

export default function Diagram({ fw }) {
  if (fw === "F1") return <Duncan />;
  if (fw === "F2") return <MilesSnow />;
  if (fw === "F3") return <March />;
  return <Design />;
}
