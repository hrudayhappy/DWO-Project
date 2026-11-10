// Section identification: deterministic keyword scoring that locates the pages each
// framework needs. Indian listed companies must publish these sections (leadership
// letters, R&D disclosure in the Board's Report, risk management, list of subsidiaries,
// cash flow statement), so the same keywords work across companies.

const NEEDS = {
  letters: { weight: 3, keep: 6, terms: ["message from the chairman", "chairman's message", "message from the managing director", "letter to shareholders", "yours sincerely", "warm regards", "dear shareholders", "dear members", "chairman's letter", "chairman’s letter", "message from", "managing director", "ceo's message", "md & ceo", "looking ahead", "way forward", "our priorities", "priorities for"] },
  outlook: { weight: 2, terms: ["outlook", "strategy", "strategic", "priorit", "focus areas", "looking ahead", "growth", "new launches", "future"] },
  portfolio: { weight: 2, terms: ["product portfolio", "segment", "powertrain", "electric", " ev ", "cng", "hybrid", "petrol", "diesel", "motorcycle", "three-wheeler", "passenger vehicle", "commercial vehicle", "scooter", "suv"] },
  exports: { weight: 2, terms: ["export", "countries", "international business", "overseas", "global markets", "markets served"] },
  risk: { weight: 2, terms: ["principal risk", "key risk", "risk management", "risks and concerns", "mitigation", "risk of", "geopolitical", "commodity", "supply chain", "disruption", "tariff", "rare earth", "cyber"] },
  rnd: { weight: 5, terms: ["expenditure incurred on research", "expenditure on research", "research and development", "r&d expenditure", "r&d spend", "technology absorption", "patents"] },
  financials: { weight: 3, terms: ["revenue from operations", "profit after tax", "profit for the year", "dividend paid", "dividends paid", "buyback", "buy-back", "purchase of property, plant", "payments for property, plant", "royalty", "net sales", "capital expenditure", "capex"] },
  launches: { weight: 2, terms: ["launch", "launched", "introduced", "new model", "facelift", "variant", "refresh", "new brand", "unveil", "entered", "entry into"] },
  efficiency: { weight: 2, terms: ["cost reduction", "cost optimisation", "cost optimization", "value engineering", "productivity", "tpm", "kaizen", "lean", "efficiency", "localisation", "localization"] },
  investments: { weight: 2, terms: ["acquisition", "acquired", "stake", "joint venture", "partnership", "memorandum of understanding", "mou", "invested in", "investment in", "subsidiary"] },
  structure: { weight: 3, terms: ["subsidiar", "aoc-1", "form aoc", "includes:", "message from md", "md & ceo", "wholly owned", "business unit", "president", "chief executive", "executive officer", "management team", "reorgani", "restructur", "demerger", "amalgamat", "chief business officer", "board of directors"] },
  management: { weight: 3, keep: 3, terms: ["president", "chief business officer", "chief technology officer", "chief financial officer", "executive officer", "managing director", "management team", "executive committee", "leadership team", "chief executive"] },
  entities: { weight: 3, terms: ["subsidiar", "wholly owned", "aoc-1", "form aoc", "joint venture", "includes:", "step-down"] },
  pnl: { weight: 3, terms: ["revenue from operations", "profit for the year", "total income", "profit after tax", "net sales"] },
  cashflow: { weight: 3, terms: ["dividend paid", "dividends paid", "buy-back", "buyback", "purchase of property, plant", "payments for property, plant", "payments for purchase of property"] },
  royalty: { weight: 4, terms: ["royalty", "technical know-how", "technology fee"] },
  newbiz: { weight: 2, terms: ["electric vehicle", " ev ", "ev volumes", "ev penetration", "ev share", "market share", "new business", "e-scooter", "electric scooter"] },
  profile: { weight: 2, keep: 2, terms: ["permanent employees", "total employees", "number of employees", "number of permanent employees", "workforce", "headcount", "manpower"] },
  people: { weight: 2, terms: ["human resource", "culture", "cross-functional", "cross functional", "flatter", "agile", "agility", "empower", "decision-making", "decision making", "standard operating", "sop", "delegat", "engagement survey"] },
};

// Phrases that mark low-value pages (sustainability tables, AGM notices, statutory boilerplate)
const NOISE = ["contents", "business responsibility and sustainability", "brsr", "gri standard", "esg databook", "e-voting", "remote e-voting", "notice is hereby given", "scrutinizer", "depository participant", "secretarial audit"];

const FRAMEWORK_NEEDS = {
  F1: ["portfolio", "exports", "risk", "letters"],
  F2: ["letters", "outlook"],
  F3: ["rnd", "pnl", "cashflow", "royalty", "newbiz", "launches", "efficiency", "investments", "profile", "letters"],
  F4: ["structure", "management", "entities", "people", "letters"],
};

// Per-document page caps for each framework, so one long annual report does not crowd out the others.
const CAPS = { AR: 26, IP: 8, EC: 12 };
const MAX_CHARS_PER_PAGE = 5000;
const MAX_CHARS_PER_FRAMEWORK = 130000;

export function scorePage(text, needKeys) {
  const t = " " + text.toLowerCase().replace(/\s+/g, " ") + " ";
  let score = 0;
  for (const key of needKeys) {
    const need = NEEDS[key];
    let hits = 0, distinct = 0;
    for (const term of need.terms) {
      let idx = t.indexOf(term);
      let c = 0;
      while (idx !== -1 && c < 4) { c++; idx = t.indexOf(term, idx + term.length); }
      hits += c;
      if (c) distinct++;
    }
    score += (Math.min(hits, 16) + 2 * distinct) * need.weight;
  }
  // very short pages (covers, dividers) carry little evidence
  if (t.length < 300) score *= 0.3;
  if (NOISE.some((n) => t.includes(n))) score *= 0.35;
  return score;
}

// docs: [{ id: "AR"|"IP"|"EC", pages: [{ page: 1, text: "..." }] }]
// For each need, the two strongest pages per document are always kept, so that a
// framework does not lose (for example) the R&D table to pages that mention many
// keywords loosely. Remaining slots are filled by combined score.
export function selectPages(docs, framework) {
  const needKeys = FRAMEWORK_NEEDS[framework];
  const picked = new Map();
  const keyOf = (d, p) => d + ":" + p;
  for (const doc of docs) {
    const cap = CAPS[doc.id] || 8;
    const local = new Map();
    for (const need of needKeys) {
      doc.pages
        .map((p) => ({ p, s: scorePage(p.text, [need]) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, doc.id === "AR" ? NEEDS[need].keep || 2 : 1)
        .forEach((x) => local.set(x.p.page, { doc: doc.id, page: x.p.page, text: x.p.text, score: 1e9 + x.s }));
    }
    const rest = doc.pages
      .map((p) => ({ doc: doc.id, page: p.page, text: p.text, score: scorePage(p.text, needKeys) }))
      .filter((p) => p.score > 0 && !local.has(p.page))
      .sort((a, b) => b.score - a.score);
    for (const p of rest) { if (local.size >= cap) break; local.set(p.page, p); }
    for (const v of local.values()) picked.set(keyOf(v.doc, v.page), v);
  }
  let total = 0;
  const out = [];
  for (const p of [...picked.values()].sort((a, b) => b.score - a.score)) {
    const text = p.text.slice(0, MAX_CHARS_PER_PAGE);
    if (total + text.length > MAX_CHARS_PER_FRAMEWORK) continue;
    total += text.length;
    out.push({ doc: p.doc, page: p.page, text });
  }
  return out.sort((a, b) => (a.doc === b.doc ? a.page - b.page : a.doc.localeCompare(b.doc)));
}

export const FRAMEWORK_IDS = Object.keys(FRAMEWORK_NEEDS);

// Search terms a framework looks for, used to light up passages on the reading screen.
export function termsFor(framework) {
  const out = new Set();
  for (const key of FRAMEWORK_NEEDS[framework] || []) for (const t of NEEDS[key].terms) { const s = t.trim(); if (s.length >= 4 && !s.includes(":")) out.add(s); }
  return [...out].sort((a, b) => b.length - a.length);
}
