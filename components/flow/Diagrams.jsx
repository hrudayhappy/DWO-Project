"use client";
// Theory diagrams for the four frameworks, drawn on light panels so they read as figures.
// They explain the theory only; where the company falls is shown on the diagnosis page.
// Colour carries one meaning throughout: ember is exploration and organic design, ice is
// exploitation and mechanistic design, the same as the balance line on the first page.
// Miles and Snow and March share one orientation (exploration up, exploitation across), so
// what management says and what the company does can be compared on the same axes.
import { ArrowRight } from "lucide-react";

// ---------- Environmental uncertainty (Duncan, as in Daft) ----------
const DUNCAN = [
  { k: "lo", tag: "Simple + stable", t: "Low uncertainty", pts: ["Few external elements, and they are alike", "They change slowly, if at all"], ex: "Soft-drink bottlers, food processors", calls: "Mechanistic and formal; efficiency is rewarded", mode: "ice" },
  { k: "lm", tag: "Complex + stable", t: "Low to moderate uncertainty", pts: ["Many external elements, and they differ", "They change slowly"], ex: "Universities, appliance makers, insurers", calls: "Mechanistic, with some boundary spanning", mode: "ice" },
  { k: "md", tag: "Simple + unstable", t: "Moderate to high uncertainty", pts: ["Few external elements, and they are alike", "They change often and unpredictably"], ex: "E-commerce, fashion, toy makers", calls: "Organic and adaptable; sustained exploration", mode: "ember" },
  { k: "hi", tag: "Complex + unstable", t: "High uncertainty", pts: ["Many external elements, and they differ", "They change often and unpredictably"], ex: "Computer makers, aerospace, airlines", calls: "Organic with many integrators; both modes, so ambidexterity", mode: "both" },
];

function Duncan() {
  return (
    <figure className="dg">
      <div className="dgd" role="img" aria-label="Two by two matrix: environmental complexity, simple to complex, against environmental change, stable to unstable. Uncertainty rises from simple and stable to complex and unstable.">
        <div className="dg-yl"><b>Environmental change</b></div>
        <div className="dgd-rl" aria-hidden="true"><span>Stable</span><span>Unstable</span></div>
        <div className="dgd-grid">
          {DUNCAN.map((c) => (
            <div key={c.k} className={`dgd-cell ${c.k}`}>
              <p className="dgd-tag">{c.tag}</p>
              <h5>{c.t}</h5>
              <ul>{c.pts.map((p) => <li key={p}>{p}</li>)}</ul>
              <p className="dgd-ex">For example: {c.ex}</p>
              <p className={`dgd-calls ${c.mode}`}><i aria-hidden="true" />{c.calls}</p>
            </div>
          ))}
          <span className="dgd-arrow" aria-hidden="true">Uncertainty<ArrowRight size={12} strokeWidth={2.4} /></span>
        </div>
        <div className="dgd-cl" aria-hidden="true"><span>Simple</span><span>Complex</span></div>
        <div className="dg-xl"><b>Environmental complexity</b></div>
      </div>
      <figcaption>Uncertainty rises from the top left to the bottom right. The more uncertain the environment, the more organic the organisation needs to be, and the more it needs to explore as well as exploit.</figcaption>
    </figure>
  );
}

// ---------- Miles and Snow strategy types ----------
const TYPES = [
  { k: "pro", t: "Prospector", d: "Looks for new products and markets, and accepts the risk" },
  { k: "ana", t: "Analyzer", d: "Keeps a stable core while following promising new markets" },
  { k: "rea", t: "Reactor", d: "No consistent strategy; responds to pressure as it comes" },
  { k: "def", t: "Defender", d: "Protects a narrow niche through efficiency" },
];

function MilesSnow() {
  return (
    <figure className="dg">
      <div className="dgq" role="img" aria-label="Two by two matrix of strategy types. Exploration up the side, exploitation along the bottom. Prospector: high exploration, low exploitation. Analyzer: high on both. Reactor: low on both. Defender: low exploration, high exploitation.">
        <div className="dg-yl"><b>Exploration</b><small>in statements of intent</small></div>
        <div className="dgq-yt" aria-hidden="true"><span>High</span><span>Low</span></div>
        <div className="dgq-plot">
          {TYPES.map((t) => <div key={t.k} className={`dgq-cell ${t.k}`}><b>{t.t}</b><span>{t.d}</span></div>)}
          <i className="dgq-v" aria-hidden="true" /><i className="dgq-h" aria-hidden="true" />
        </div>
        <div className="dgq-xt" aria-hidden="true"><span>Low</span><span>High</span></div>
        <div className="dg-xl"><b>Exploitation</b><small>in statements of intent</small></div>
      </div>
      <figcaption>A share counts as high at 30% or more of management&apos;s statements of intent. A Reactor is one with too little to place: fewer than five statements of intent, or two or more contradictions between the documents.</figcaption>
    </figure>
  );
}

// ---------- Exploration and exploitation (March) ----------
// Same orientation as Miles and Snow: exploitation score across, exploration score up.
function March() {
  const X = (s) => 30 + (s - 1) * 62, Y = (s) => 262 - (s - 1) * 60;
  const pts = (list) => list.map(([a, b]) => `${X(a)},${Y(b)}`).join(" ");
  return (
    <figure className="dg">
      <div className="dgp">
        <div className="dg-yl"><b>Exploration score</b><small>1 to 5</small></div>
        <svg viewBox="0 0 300 286" className="dgp-svg" role="img" aria-label="Exploitation score across, exploration score up. Far above the diagonal is exploration-led, with the risk of a failure trap. Far below is exploitation-led, with the risk of a success trap. Along the diagonal the two are balanced, and both at 3.5 or more is ambidextrous.">
          <defs>
            <linearGradient id="dgp-amb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffb48f" /><stop offset="1" stopColor="#a9cdf0" /></linearGradient>
            <marker id="dgp-head" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="#1e1c1b" /></marker>
          </defs>
          <polygon points={pts([[1, 1.75], [1, 5], [4.25, 5]])} className="p-em" />
          <polygon points={pts([[1.75, 1], [5, 1], [5, 4.25]])} className="p-ic" />
          <polygon points={pts([[1, 1], [1.75, 1], [5, 4.25], [5, 5], [4.25, 5], [1, 1.75]])} className="p-band" />
          <polygon points={pts([[3.5, 3.5], [3.5, 4.25], [4.25, 5], [5, 5], [5, 4.25], [4.25, 3.5]])} fill="url(#dgp-amb)" className="p-amb" />
          <line x1={X(1)} y1={Y(1)} x2={X(5)} y2={Y(5)} className="p-diag" />
          <text x={X(1.95)} y={Y(4.35)} className="p-l">Exploration-led</text>
          <text x={X(1.95)} y={Y(4.35) + 12} className="p-s">risk: failure trap</text>
          <text x={X(4.05)} y={Y(1.85)} className="p-l">Exploitation-led</text>
          <text x={X(4.05)} y={Y(1.85) + 12} className="p-s">risk: success trap</text>
          <text x={X(4.42)} y={Y(4.52)} className="p-l sm">Ambi-</text>
          <text x={X(4.42)} y={Y(4.52) + 11} className="p-l sm">dextrous</text>
          <text x={X(2.6)} y={Y(2.4)} className="p-s" transform={`rotate(-44 ${X(2.6)} ${Y(2.4)})`}>balanced, at a modest level</text>
          <line x1={X(1)} y1={Y(1)} x2={X(1)} y2={Y(5) - 14} className="p-ax" markerEnd="url(#dgp-head)" />
          <line x1={X(1)} y1={Y(1)} x2={X(5) + 14} y2={Y(1)} className="p-ax" markerEnd="url(#dgp-head)" />
          {[1, 2, 3, 4, 5].map((s) => <text key={`x${s}`} x={X(s)} y={Y(1) + 13} className="p-t">{s}</text>)}
          {[2, 3, 4, 5].map((s) => <text key={`y${s}`} x={X(1) - 7} y={Y(s) + 3} className="p-t end">{s}</text>)}
        </svg>
        <div className="dg-xl"><b>Exploitation score</b><small>1 to 5</small></div>
      </div>
      <figcaption>Each score is the average of its signals, from 1 to 5. Scores within three quarters of a point of each other count as balanced; balanced at 3.5 or more on both is ambidextrous.</figcaption>
    </figure>
  );
}

// ---------- Organisation design ----------
// Organic: a flat web of teams. Mechanistic: a tall tree with each department in its own silo.
function OrganicChart() {
  const n = [[34, 74], [74, 52], [112, 80], [150, 54], [190, 76], [60, 108], [160, 108]];
  const links = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 2], [2, 6], [6, 4], [1, 3], [5, 6], [0, 2], [2, 4]];
  return (
    <svg viewBox="0 0 224 128" className="dgo-svg" aria-hidden="true">
      <line x1="112" y1="20" x2="74" y2="52" className="o-up" /><line x1="112" y1="20" x2="150" y2="54" className="o-up" />
      {links.map(([a, b]) => <line key={`${a}-${b}`} x1={n[a][0]} y1={n[a][1]} x2={n[b][0]} y2={n[b][1]} className="o-link" />)}
      <circle cx="112" cy="20" r="6.5" className="o-lead" />
      {n.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="7.5" className="o-node" />)}
    </svg>
  );
}
function MechanisticChart() {
  const cols = [44, 112, 180];
  return (
    <svg viewBox="0 0 224 128" className="dgo-svg" aria-hidden="true">
      {cols.map((x) => <rect key={`s${x}`} x={x - 31} y={39} width={62} height={84} rx={9} className="m-silo" />)}
      <path d={`M112 22 V31 H${cols[0]} V45 M112 31 H${cols[2]} V45 M112 31 V45`} className="m-line" />
      {cols.map((x) => (
        <g key={x}>
          <path d={`M${x} 56 V63 H${x - 14} V72 M${x} 63 H${x + 14} V72 M${x - 14} 83 V98 M${x + 14} 83 V98`} className="m-line" />
          <rect x={x - 7} y={45} width={14} height={11} rx={2} className="m-node" />
          <rect x={x - 21} y={72} width={14} height={11} rx={2} className="m-node" />
          <rect x={x + 7} y={72} width={14} height={11} rx={2} className="m-node" />
          <rect x={x - 21} y={98} width={14} height={11} rx={2} className="m-node" />
          <rect x={x + 7} y={98} width={14} height={11} rx={2} className="m-node" />
        </g>
      ))}
      <rect x={105} y={11} width={14} height={11} rx={2} className="m-top" />
    </svg>
  );
}

// Small pictures of where the new unit sits relative to the core
function Glyph({ kind }) {
  return (
    <svg viewBox="0 0 96 50" className="dga-glyph" aria-hidden="true">
      {kind === "constraint" && <><rect x="10" y="8" width="76" height="36" rx="7" className="g-core" /><rect x="50" y="17" width="28" height="18" rx="5" className="g-new" /></>}
      {kind !== "constraint" && <>
        <path d={kind === "structural" ? "M48 13 V19 H24 V26 M48 19 H73 V26" : "M48 13 V19 H24 V26"} className="g-link" />
        {kind === "isolation" && <path d="M54 19 H73 V24" className="g-link cut" />}
        <circle cx="48" cy="8" r="5" className="g-lead" />
        <rect x="6" y="26" width="36" height="20" rx="5" className="g-core" />
        <rect x="56" y="26" width="34" height="20" rx="5" className="g-new" />
      </>}
    </svg>
  );
}

const CORE_ROWS = [
  ["Hierarchy", "Flat, few levels", "Tall, many levels"],
  ["Decisions", "Delegated to the people closest to the work", "Kept at the top"],
  ["Rules", "Few, flexible", "Many, written down"],
  ["Coordination", "Teams work across departments", "Separate departments, joined only through managers"],
  ["Roles", "Broad and changing", "Narrow and fixed"],
];

function Design() {
  return (
    <figure className="dg">
      <div className="dgo">
        <span />
        <div className="dgo-col em"><OrganicChart /><b><i aria-hidden="true" />Organic</b><small>adapts and learns</small></div>
        <div className="dgo-col ic"><MechanisticChart /><b><i aria-hidden="true" />Mechanistic</b><small>efficient and predictable</small></div>
        {CORE_ROWS.map(([a, o, m]) => (
          <div key={a} className="dgo-row"><b>{a}</b><span className="em">{o}</span><span className="ic">{m}</span></div>
        ))}
      </div>
      <div className="dgo-scale">
        <p>The four core signals are each scored from 1 to 5 and averaged</p>
        <div className="dgo-bar" role="img" aria-label="An average of 2.5 or less is organic, 3.5 or more is mechanistic, and anything between is mixed">
          <span>Organic<small>1 to 2.5</small></span><span className="mix">Mixed</span><span>Mechanistic<small>3.5 to 5</small></span>
        </div>
      </div>

      <h5 className="dg-sub">Where the new business sits</h5>
      <div className="dga">
        <div className="dg-yl"><b>Integration at the top</b><small>low to high</small></div>
        <div className="dga-grid">
          <div className="dga-cell c"><Glyph kind="constraint" /><b>Risk of constraint</b><span>The new unit sits inside the core, whose routines hold it back</span></div>
          <div className="dga-cell s"><Glyph kind="structural" /><b>Structural ambidexterity</b><span>Separate and autonomous, joined to the core at the top</span></div>
          <div className="dga-cell i"><Glyph kind="isolation" /><b>Risk of isolation</b><span>Autonomous but cut off from the core&apos;s resources</span></div>
        </div>
        <div className="dg-xl"><b>Autonomy of the new unit</b><small>low to high</small></div>
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
