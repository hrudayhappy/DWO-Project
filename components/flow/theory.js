// What each framework is, what it looks for in the documents, and how a signal is read.
// The wording follows lib/indicators.js and the rules in lib/engine.js.
import { BUCKET } from "./buckets";

export const LENSES = [
  {
    fw: "F1", name: "Environmental uncertainty", basis: "Duncan; Daft and Uppal",
    question: "What does the environment demand?",
    idea: "An environment is uncertain when it is complex (many different things to deal with) and changes quickly. The more uncertain it is, the more a company needs to explore as well as exploit, and the more organic its structure needs to be.",
    groups: [
      { title: "Complexity", items: [
        { id: "C1", name: "Product and technology scope", look: "Vehicle segments and powertrains in the portfolio", reads: "More segments and powertrains, more complex" },
        { id: "C2", name: "Geographic scope", look: "Share of volume exported and countries served", reads: "Wider reach, more complex" },
        { id: "C3", name: "External dependencies", look: "Distinct categories of risk the company discloses", reads: "More categories, more complex" },
      ] },
      { title: "Change", items: [
        { id: "U1", name: "Technological change", look: "The industry's EV growth and the company's own EV share", reads: "Faster shift to electric, more dynamic" },
        { id: "U2", name: "Regulatory change", look: "Policy changes reported in the last two years", reads: "More changes, more dynamic" },
        { id: "U3", name: "External disruptions", look: "Shortages, tariffs, conflicts or cyber incidents in the year", reads: "More disruptions, more dynamic" },
      ] },
    ],
  },
  {
    fw: "F2", name: "Miles and Snow strategy types", basis: "Miles and Snow",
    question: "What does management say it will do?",
    idea: "Companies tend to follow one of four strategies. Prospectors look for new products and markets, Defenders protect their niche through efficiency, Analyzers do both, and Reactors have no consistent strategy. Management's own statements show which one it intends.",
    groups: [
      { title: "Statements of intent", items: [
        { id: "S1", name: "Exploratory intent", look: "Statements committing to new products, technologies or markets", reads: "A high share points to a Prospector" },
        { id: "S2", name: "Exploitative intent", look: "Statements about cost, efficiency, margins or defending share", reads: "A high share points to a Defender" },
        { id: "S3", name: "Declared priorities", look: "The priorities set out for the coming year", reads: "Show where management's attention goes" },
        { id: "S4", name: "Consistency", look: "Whether the report, the presentation and the call tell the same story", reads: "Contradictions or too few statements point to a Reactor" },
      ] },
    ],
  },
  {
    fw: "F3", name: "Exploration and exploitation", basis: "March",
    question: "What does the company actually do?",
    idea: "Exploration is search and experiment: new products, technologies and markets, with uncertain and distant returns. Exploitation is refinement and efficiency in what already exists, with quick and certain returns. Doing too much of either leads to a trap.",
    groups: [
      { title: "Exploration", items: [
        { id: "X1", name: "R&D intensity", look: "R&D spending as a share of revenue", reads: "Higher, more exploration" },
        { id: "X2", name: "New to the company", look: "Products, technologies or markets the company did not have before", reads: "More of them, more exploration" },
        { id: "X3", name: "Revenue from new businesses", look: "Share of sales from new businesses such as EVs", reads: "Higher, exploration is paying off" },
        { id: "X4", name: "New capabilities", look: "Acquisitions, new subsidiaries and technology partnerships", reads: "More or larger, more exploration" },
      ] },
      { title: "Exploitation", items: [
        { id: "Y1", name: "Efficiency programmes", look: "Named cost, quality or productivity programmes", reads: "Formal and quantified, more exploitation" },
        { id: "Y2", name: "Capacity for current models", look: "How much capital spending expands capacity for existing products", reads: "Most of it, more exploitation" },
        { id: "Y3", name: "Incremental launches", look: "Facelifts, variants and refreshes of existing models", reads: "Many of them, more exploitation" },
        { id: "Y4", name: "Payouts to shareholders", look: "Dividends and buybacks as a share of profit", reads: "High payouts, the core is being harvested" },
      ] },
    ],
  },
  {
    fw: "F4", name: "Organisation design", basis: "Burns and Stalker; Daft and Uppal; O'Reilly and Tushman",
    question: "Is the company built for both?",
    idea: "A mechanistic organisation has a tall hierarchy, decisions kept at the top, many written rules and departments that work apart. It is efficient. An organic one is flat, delegated and works across teams. It adapts and learns. An ambidextrous company keeps new businesses in a separate, autonomous unit and joins it to the core at the top.",
    groups: [
      { title: "Mechanistic or organic core", items: [
        { id: "B1", name: "Who decides", look: "Whether decisions stay at the top or are delegated to unit heads", reads: "At the top is mechanistic; delegated is organic" },
        { id: "B2", name: "Rules and procedures", look: "Reliance on written rules, standard procedures, TPM", reads: "Many rules is mechanistic; few is organic" },
        { id: "B3", name: "Coordination across teams", look: "Cross-functional teams and flatter structures", reads: "Weak is mechanistic; strong is organic" },
        { id: "B4", name: "How jobs are written", look: "The language of the company's job postings", reads: "Compliance and reporting lines is mechanistic; autonomy and ambiguity is organic" },
      ] },
      { title: "Ambidextrous design", items: [
        { id: "A1", name: "A separate unit", look: "A business unit or subsidiary for new businesses", reads: "A separate subsidiary is the strongest separation" },
        { id: "A2", name: "Its autonomy", look: "Own legal entity, leader, brand, profit and loss, outside investors", reads: "More of these, more autonomy" },
        { id: "A3", name: "Integration at the top", look: "Reports to the group CEO, shared directors, platforms or priorities", reads: "More of these, better joined to the core" },
        { id: "A4", name: "Recent changes", look: "Units created, spun off or brought back in the last two years", reads: "A unit brought back triggers a maturity check" },
      ] },
    ],
  },
].map((l) => ({ ...l, color: BUCKET[l.fw].color, short: BUCKET[l.fw].name }));

// How much verified evidence the extraction holds for each indicator.
const ok = (evs) => (Array.isArray(evs) ? evs : evs ? [evs] : []).some((e) => e && e.verified);
const items = (list) => (list || []).filter((i) => ok(i?.evidence)).length;
const one = (f) => (f && ok(f.evidence) ? 1 : 0);
const has = (figs, k) => (figs?.[k]?.value !== "" && figs?.[k]?.value != null ? 1 : 0);

export function evidenceCounts(x = {}, figs = {}) {
  const F1 = x.F1 || {}, F2 = x.F2 || {}, F3 = x.F3 || {}, F4 = x.F4 || {};
  const st = (F2.statements || []).filter((s) => s && s.verified);
  return {
    C1: { n: items(F1.segments) + items(F1.powertrains) },
    C2: { n: has(figs, "export_share") + one(F1.markets_served) },
    C3: { n: items(F1.risk_categories) },
    U1: { n: has(figs, "ev_share"), note: "plus industry data from IBEF" },
    U2: { n: items(F1.regulatory_changes) },
    U3: { n: items(F1.disruptions) },
    S1: { n: st.filter((s) => s.label === "exploratory" || s.label === "both").length },
    S2: { n: st.filter((s) => s.label === "exploitative" || s.label === "both").length },
    S3: { n: st.filter((s) => s.is_priority).length },
    S4: { n: new Set(st.map((s) => s.doc)).size, unit: "document", note: `${items(F2.contradictions)} contradiction${items(F2.contradictions) === 1 ? "" : "s"}` },
    X1: { n: has(figs, "rnd") + has(figs, "revenue"), of: 2, unit: "figure" },
    X2: { n: items(F3.new_to_firm) },
    X3: { n: has(figs, "new_business_share"), of: 1, unit: "figure" },
    X4: { n: items(F3.new_capability_investments) },
    Y1: { n: items(F3.efficiency_programmes) },
    Y2: { n: one(F3.capex_orientation) },
    Y3: { n: items(F3.incremental_launches) },
    Y4: { n: has(figs, "dividends") + has(figs, "buyback") + has(figs, "pat"), of: 3, unit: "figure" },
    A1: { n: one(F4.exploratory_unit) },
    A2: { n: items(F4.autonomy_attributes) },
    A3: { n: items(F4.integration_attributes) },
    A4: { n: items(F4.recent_changes) },
    B1: { n: one(F4.centralization) },
    B2: { n: one(F4.formalization) },
    B3: { n: one(F4.horizontal_coordination) },
    B4: { n: items(F4.job_postings), unit: "posting" },
  };
}
