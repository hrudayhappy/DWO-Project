// What each framework is, what it looks for in the documents (2, 4 or 6 cues per signal),
// and how a signal is read.
// The wording follows lib/indicators.js and the rules in lib/engine.js.
import { BUCKET } from "./buckets";

export const LENSES = [
  {
    fw: "F1", name: "Environmental uncertainty", basis: "Duncan; Daft and Uppal",
    question: "What does the environment demand?",
    idea: "An environment is uncertain when it is complex (many different things to deal with) and changes quickly. The more uncertain it is, the more a company needs to explore as well as exploit, and the more organic its structure needs to be.",
    groups: [
      { title: "Complexity", items: [
        { id: "C1", name: "Product and technology scope", cues: ["Vehicle segments", "Petrol and diesel", "CNG and hybrid", "Electric"], reads: "More segments and powertrains, more complex" },
        { id: "C2", name: "Geographic scope", cues: ["Share of volume exported", "Countries served"], reads: "Wider reach, more complex" },
        { id: "C3", name: "External dependencies", cues: ["Raw materials", "Supply chain", "Regulation", "Currency", "Geopolitics", "Cyber"], reads: "More categories, more complex" },
      ] },
      { title: "Change", items: [
        { id: "U1", name: "Technological change", cues: ["Industry EV growth", "The company's EV share"], reads: "Faster shift to electric, more dynamic" },
        { id: "U2", name: "Regulatory change", cues: ["Emission and fuel norms", "EV incentives", "Safety rules", "Taxes and tariffs"], reads: "More changes, more dynamic" },
        { id: "U3", name: "External disruptions", cues: ["Chip or rare-earth shortages", "Tariffs", "Conflicts", "Cyber incidents"], reads: "More disruptions, more dynamic" },
      ] },
    ],
  },
  {
    fw: "F2", name: "Miles and Snow strategy types", basis: "Miles and Snow",
    question: "What does management say it will do?",
    idea: "Companies tend to follow one of four strategies. Prospectors look for new products and markets, Defenders protect their niche through efficiency, Analyzers do both, and Reactors have no consistent strategy. Management's own statements show which one it intends.",
    groups: [
      { title: "Statements of intent", items: [
        { id: "S1", name: "Exploratory intent", cues: ["New products", "New technologies", "New markets", "New businesses"], reads: "A high share points to a Prospector" },
        { id: "S2", name: "Exploitative intent", cues: ["Cost", "Efficiency", "Margins", "Defending share"], reads: "A high share points to a Defender" },
        { id: "S3", name: "Declared priorities", cues: ["Priorities for the coming year", "Outlook in the leadership letter"], reads: "Show where management's attention goes" },
        { id: "S4", name: "Consistency", cues: ["Annual report", "Investor presentation", "Earnings call", "Contradictions between them"], reads: "Contradictions or too few statements point to a Reactor" },
      ] },
    ],
  },
  {
    fw: "F3", name: "Exploration and exploitation", basis: "March",
    question: "What does the company actually do?",
    idea: "Exploration is search and experiment: new products, technologies and markets, with uncertain and distant returns. Exploitation is refinement and efficiency in what already exists, with quick and certain returns. Doing too much of either leads to a trap.",
    groups: [
      { title: "Exploration", items: [
        { id: "X1", name: "R&D intensity", cues: ["R&D spending", "Revenue"], reads: "Higher, more exploration" },
        { id: "X2", name: "New to the company", cues: ["First-time products", "New technologies", "New markets", "New brands"], reads: "More of them, more exploration" },
        { id: "X3", name: "Revenue from new businesses", cues: ["EV share of sales", "Other new-business revenue"], reads: "Higher, exploration is paying off" },
        { id: "X4", name: "New capabilities", cues: ["Acquisitions", "New subsidiaries", "Technology partnerships", "Stakes in start-ups"], reads: "More or larger, more exploration" },
      ] },
      { title: "Exploitation", items: [
        { id: "Y1", name: "Efficiency programmes", cues: ["Named cost programmes", "Quality programmes", "Productivity drives", "Savings in numbers"], reads: "Formal and quantified, more exploitation" },
        { id: "Y2", name: "Capacity for current models", cues: ["Capital spending plans", "Capacity for existing models"], reads: "Most of it, more exploitation" },
        { id: "Y3", name: "Incremental launches", cues: ["Facelifts", "New variants", "Model refreshes", "Special editions"], reads: "Many of them, more exploitation" },
        { id: "Y4", name: "Payouts to shareholders", cues: ["Dividends and buybacks", "Profit after tax"], reads: "High payouts, the core is being harvested" },
      ] },
    ],
  },
  {
    fw: "F4", name: "Organisation design", basis: "Burns and Stalker; Daft and Uppal; O'Reilly and Tushman",
    question: "Is the company built for both?",
    idea: "A mechanistic organisation has a tall hierarchy, decisions kept at the top, many written rules and departments that work apart. It is efficient. An organic one is flat, delegated and works across teams. It adapts and learns. An ambidextrous company keeps new businesses in a separate, autonomous unit and joins it to the core at the top.",
    groups: [
      { title: "Mechanistic or organic core", items: [
        { id: "B1", name: "Who decides", cues: ["Decisions kept at the top", "Delegation to unit heads"], reads: "At the top is mechanistic; delegated is organic" },
        { id: "B2", name: "Rules and procedures", cues: ["Standard procedures", "TPM and similar systems", "Written policies", "Layers of approval"], reads: "Many rules is mechanistic; few is organic" },
        { id: "B3", name: "Coordination across teams", cues: ["Cross-functional teams", "Flatter structures", "Silos between departments", "Working only through managers"], reads: "Weak is mechanistic; strong is organic" },
        { id: "B4", name: "How jobs are written", cues: ["Autonomy", "Building from scratch", "Ambiguity", "Compliance", "SOPs", "Reporting lines"], reads: "Compliance and reporting lines is mechanistic; autonomy and ambiguity is organic" },
      ] },
      { title: "Ambidextrous design", items: [
        { id: "A1", name: "A separate unit", cues: ["EV or new-business unit", "Separate subsidiary"], reads: "A separate subsidiary is the strongest separation" },
        { id: "A2", name: "Its autonomy", cues: ["Own legal entity", "Own leader", "Own brand", "Own sales channel", "Own profit and loss", "Outside investors"], reads: "More of these, more autonomy" },
        { id: "A3", name: "Integration at the top", cues: ["Reports to the group CEO", "Shared directors", "Shared platforms", "Shared group priorities"], reads: "More of these, better joined to the core" },
        { id: "A4", name: "Recent changes", cues: ["Units created", "Spin-offs or demergers", "Mergers", "Units brought back"], reads: "A unit brought back triggers a maturity check" },
      ] },
    ],
  },
].map((l) => ({ ...l, color: BUCKET[l.fw].color, short: BUCKET[l.fw].name }));

// How much verified evidence the extraction holds for each indicator, and how much of it
// came from the web.
const evs = (x) => (Array.isArray(x) ? x : x ? [x] : []).filter((e) => e && e.verified);
const items = (list) => (list || []).filter((i) => evs(i?.evidence).length);
const one = (f) => (f && evs(f.evidence).length ? [f] : []);
const web = (list) => list.filter((i) => evs(i.evidence ?? i).some((e) => e.doc === "WEB")).length;
const c = (list, extra = {}) => ({ n: list.length, web: web(list), ...extra });
const figN = (figs, keys) => {
  const got = keys.filter((k) => figs?.[k]?.value !== "" && figs?.[k]?.value != null);
  return { n: got.length, of: keys.length, unit: "figure", web: got.filter((k) => (figs[k].evidence || []).some((e) => e.doc === "WEB")).length };
};

export function evidenceCounts(x = {}, figs = {}) {
  const F1 = x.F1 || {}, F2 = x.F2 || {}, F3 = x.F3 || {}, F4 = x.F4 || {};
  const st = (F2.statements || []).filter((s) => s && s.verified);
  const stw = (list) => ({ n: list.length, web: list.filter((s) => s.doc === "WEB").length });
  const contra = items(F2.contradictions).length;
  return {
    C1: c([...items(F1.segments), ...items(F1.powertrains)]),
    C2: (() => { const f = figN(figs, ["export_share"]); const m = one(F1.markets_served); return { n: f.n + m.length, web: f.web + web(m) }; })(),
    C3: c(items(F1.risk_categories)),
    U1: { ...figN(figs, ["ev_share"]), unit: undefined, of: undefined, note: "plus industry data from IBEF" },
    U2: c(items(F1.regulatory_changes), { note: "plus policy changes from IBEF" }),
    U3: c(items(F1.disruptions)),
    S1: stw(st.filter((s) => s.label === "exploratory" || s.label === "both")),
    S2: stw(st.filter((s) => s.label === "exploitative" || s.label === "both")),
    S3: stw(st.filter((s) => s.is_priority)),
    S4: { n: new Set(st.map((s) => s.doc)).size, unit: "source", note: `${contra} contradiction${contra === 1 ? "" : "s"}` },
    X1: figN(figs, ["rnd", "revenue"]),
    X2: c(items(F3.new_to_firm)),
    X3: figN(figs, ["new_business_share"]),
    X4: c(items(F3.new_capability_investments)),
    Y1: c(items(F3.efficiency_programmes)),
    Y2: c(one(F3.capex_orientation)),
    Y3: c(items(F3.incremental_launches)),
    Y4: figN(figs, ["dividends", "buyback", "pat"]),
    A1: c(F4.exploratory_unit?.form ? one(F4.exploratory_unit) : []),
    A2: c(items(F4.autonomy_attributes)),
    A3: c(items(F4.integration_attributes)),
    A4: c(items(F4.recent_changes)),
    B1: c(one(F4.centralization)),
    B2: c(one(F4.formalization)),
    B3: c(one(F4.horizontal_coordination)),
    B4: c(items(F4.job_postings), { unit: "posting" }),
  };
}
