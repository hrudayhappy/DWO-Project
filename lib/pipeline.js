"use client";
// Client-side pipeline: read PDFs, select pages, call the server for extraction,
// verify quotations, fill gaps with web search. Scoring happens in lib/engine.js.

import { selectPages } from "./sections";
import { verifyEvidence } from "./verify";
import { cacheGet, cacheKey, cacheSet } from "./store";

export async function readPdf(file, onProgress) {
  const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    let s = "";
    for (const it of tc.items) s += it.str + (it.hasEOL ? "\n" : " ");
    pages.push({ page: i, text: s.replace(/[ \t]+/g, " ") });
    if (onProgress && (i % 10 === 0 || i === doc.numPages)) onProgress(i, doc.numPages);
    page.cleanup();
  }
  return pages;
}

// Same request, same answer: responses are kept in the browser so a refresh or a second run
// on the same documents does not call the AI again.
async function post(url, body, passcode) {
  const key = cacheKey(url, body);
  const hit = await cacheGet(key);
  if (hit !== undefined) return hit;
  const data = await send(url, body, passcode);
  cacheSet(key, data);
  return data;
}

async function send(url, body, passcode) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-app-passcode": passcode || "" },
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// Walk an extraction result and verify every evidence object in place.
function verifyTree(node, lookup, stats) {
  if (Array.isArray(node)) return node.map((n) => verifyTree(n, lookup, stats));
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === "evidence") {
        const list = (Array.isArray(v) ? v : v ? [v] : []).map((e) => {
          const r = verifyEvidence(e, lookup);
          stats.total++; if (r.verified) stats.verified++; else stats.rejected.push(r);
          return r;
        });
        out[k] = list;
      } else out[k] = verifyTree(v, lookup, stats);
    }
    return out;
  }
  return node;
}

function verifyStatements(statements, lookup, stats) {
  return (statements || []).map((s) => {
    const r = verifyEvidence({ ...s, type: s.type || "company_claim" }, lookup);
    stats.total++; if (r.verified) stats.verified++; else stats.rejected.push(r);
    return r;
  });
}

const FW_LABEL = { F1: "environment", F2: "strategy", F3: "behaviour", F4: "structure" };

// Flatten an extraction result into the quotations it contains, for the reading screen.
const FIELD_LABEL = {
  revenue_crore: "Revenue", employees: "Employees", rnd_crore: "R&D spend", pat_crore: "Profit after tax", dividends_crore: "Dividends", buyback_crore: "Buyback",
  royalty_crore: "Royalty to parent", export_share_pct: "Export share", firm_ev_share_pct: "EV share", markets_served: "Markets served",
  new_business_share_pct: "New-business share", capex_orientation: "Capital spending", centralization: "Centralisation", formalization: "Formalisation",
  horizontal_coordination: "Coordination", new_business_profitable: "New-business profit", exploratory_unit: "Exploratory unit",
  incorporated_year: "Incorporated", job_postings: "Job posting", recent_changes: "Recent change", disruptions: "Disruption",
};
const HEAD_KEYS = ["name", "category", "description", "item", "title", "attribute"];
const chip = (e, fw, head) => ({ fw, doc: e.doc, page: e.page, url: e.url, title: e.title, quote: e.quote, verified: !!e.verified, reason: e.reason, head: head || "" });
export function quotesIn(node, fw, out = [], head) {
  if (Array.isArray(node)) { node.forEach((n) => quotesIn(n, fw, out, head)); return out; }
  if (node && typeof node === "object") {
    const own = HEAD_KEYS.map((k) => node[k]).find((v) => typeof v === "string" && v);
    const h = own || head;
    for (const [k, v] of Object.entries(node)) {
      if (k === "evidence") (Array.isArray(v) ? v : v ? [v] : []).forEach((e) => out.push(chip(e, fw, h)));
      else if (v && typeof v === "object") quotesIn(v, fw, out, FIELD_LABEL[k] || h);
    }
  }
  return out;
}

export async function runPipeline({ files, preread = {}, context, passcode, log, onEvent = () => {}, isCancelled = () => false }) {
  // 1. Read documents (reuse pages already read when the file was added)
  const docs = [];
  for (const [id, file] of Object.entries(files)) {
    if (!file) continue;
    const label = { AR: "annual report", IP: "investor presentation", EC: "earnings-call transcript" }[id];
    if (preread[id]?.length) {
      log.done(log.start(`Reading the ${label}`), `Read the ${label} (${preread[id].length} pages)`);
      docs.push({ id, pages: preread[id] });
      continue;
    }
    const step = log.start(`Reading the ${label}`);
    const pages = await readPdf(file, (i, n) => log.update(step, `Reading the ${label}: page ${i} of ${n}`));
    log.done(step, `Read the ${label} (${pages.length} pages)`);
    docs.push({ id, pages });
  }
  onEvent({ type: "docs", docs: docs.map((d) => ({ id: d.id, pages: d.pages.length })) });
  const profile = { incorporated: findIncorporation(docs) };
  const stopIfCancelled = () => { if (isCancelled()) throw new Error("CANCELLED"); };
  const pageText = {};
  for (const d of docs) { pageText[d.id] = {}; for (const p of d.pages) pageText[d.id][p.page] = p.text; }
  const webText = {};
  const lookup = (doc, page) => (doc === "WEB" ? webText[page] ?? null : pageText[doc]?.[page] ?? null);

  // 2–4. Find sections, extract, verify
  const extraction = {};
  const stats = { total: 0, verified: 0, rejected: [] };
  const pagesUsed = {};
  const errors = [];
  for (const fw of ["F1", "F2", "F3", "F4"]) {
    stopIfCancelled();
    const pages = selectPages(docs, fw);
    pagesUsed[fw] = pages.map((p) => `${p.doc} p.${p.page}`);
    const step = log.start(`Extracting ${FW_LABEL[fw]} evidence from ${pages.length} relevant pages`);
    onEvent({ type: "scan", fw, pages: pages.map((p) => ({ doc: p.doc, page: p.page })) });
    try {
      const { result, model } = await post("/api/extract", { framework: fw, pages, context }, passcode);
      const before = stats.verified;
      let r = result || {};
      if (fw === "F2") r = { ...r, statements: verifyStatements(r.statements, lookup, stats), contradictions: verifyTree(r.contradictions || [], lookup, stats) };
      else r = verifyTree(r, lookup, stats);
      extraction[fw] = r;
      onEvent({ type: "found", fw, chips: fw === "F2" ? [...(r.statements || []).map((st) => chip(st, "F2", st.label)), ...quotesIn(r.contradictions, "F2")] : quotesIn(r, fw) });
      log.done(step, `Extracted ${FW_LABEL[fw]} evidence: ${stats.verified - before} verified quotations${model ? ` (${model})` : ""}`);
    } catch (e) {
      extraction[fw] = {};
      errors.push(`${FW_LABEL[fw]}: ${e.message}`);
      log.fail(step, `Could not extract ${FW_LABEL[fw]} evidence: ${e.message}`);
      onEvent({ type: "failed", fw, message: e.message });
    }
  }

  // 5. Fill what the documents did not have from the web, in up to two rounds
  stopIfCancelled();
  const fy = reportYear(docs);
  const web = await fillFromWeb({ extraction, profile, context, fy, passcode, lookup, webText, stats, errors, log, onEvent, stopIfCancelled });
  log.done(log.start("Checking quotations"), `Checked quotations: ${stats.verified} of ${stats.total} verified; ${stats.total - stats.verified} discarded`);
  onEvent({ type: "checked", total: stats.total, verified: stats.verified });

  return { extraction, profile, stats, pagesUsed, webResults: web.results, web: web.report, fy, errors, docsRead: docs.map((d) => ({ id: d.id, pages: d.pages.length })) };
}

// ---------- Web search for missing inputs ----------
const verifiedIn = (evs) => (Array.isArray(evs) ? evs : evs ? [evs] : []).some((e) => e && e.verified);
const valueFound = (f) => !!f && f.value != null && f.value !== "" && verifiedIn(f.evidence);
const itemsFound = (list) => (list || []).filter((i) => verifiedIn(i?.evidence)).length;

// Every input the diagnosis uses that the documents can miss. Each names the extraction fields
// it fills, how to tell it is missing, and up to two searches: the second runs only when the
// first round leaves the input missing. Searches for figures read whole passages ("deep").
function gapList(x, profile, co, fy) {
  const L = fy.long, S = fy.short;
  const unit = x.F4?.exploratory_unit?.name;
  const F4 = (k) => x.F4?.[k];
  const val = (fw, key, label, q1, q2, deep = true) => ({ fw, keys: [key], label, missing: () => !valueFound(x[fw]?.[key]), queries: [q1, q2], deep });
  const list = (fw, key, label, min, q1, q2) => ({ fw, keys: [key], label, missing: () => itemsFound(x[fw]?.[key]) < min, queries: [q1, q2], deep: false });
  return [
    val("F3", "revenue_crore", "Revenue", `${co} revenue from operations ${L} crore`, `${co} ${S} annual results revenue net profit`),
    val("F3", "rnd_crore", "R&D spend", `${co} research and development expenditure ${L} crore`, `${co} R&D spend as percentage of revenue ${S}`),
    val("F3", "pat_crore", "Profit after tax", `${co} net profit after tax ${L} crore`, `${co} ${S} results net profit`),
    val("F3", "employees", "Employees", `${co} number of permanent employees ${L}`, `${co} total employees headcount workforce`),
    val("F3", "dividends_crore", "Dividends", `${co} dividend declared for ${L} total payout`, `${co} final dividend per share ${S}`),
    val("F3", "buyback_crore", "Buyback", `${co} share buyback ${L}`, `${co} buyback offer size crore`),
    val("F3", "royalty_crore", "Royalty to a parent", `${co} royalty paid to parent company ${L} crore`, `${co} royalty as percentage of sales technology fee`),
    val("F1", "export_share_pct", "Export share", `${co} exports share of total sales volume ${L}`, `${co} export volumes units ${S}`),
    val("F1", "markets_served", "Countries served", `${co} exports to how many countries`, `${co} global presence number of countries`, false),
    val("F1", "firm_ev_share_pct", "EV share of sales", `${co} electric vehicle share of total sales ${L}`, `${co} EV sales volume ${S} penetration`),
    val("F3", "new_business_share_pct", "New-business share", `${co} revenue share from new businesses electric vehicles ${L}`, `${co} EV revenue contribution percentage ${S}`),
    { fw: "PROFILE", keys: ["incorporated_year"], label: "Year of incorporation", missing: () => !valueFound(profile.incorporated), queries: [`${co} year of incorporation company history`], deep: false },
    list("F1", "segments", "Vehicle segments", 1, `${co} vehicle segments product portfolio`),
    list("F1", "powertrains", "Powertrains", 1, `${co} petrol diesel CNG hybrid electric models`),
    list("F1", "risk_categories", "Risk categories", 3, `${co} key risks risk factors`),
    list("F1", "disruptions", "Disruptions", 1, `${co} supply disruption shortage tariffs ${S}`),
    { fw: "F2", keys: ["statements"], label: "Statements of intent", missing: () => (x.F2?.statements || []).filter((st) => st && st.verified).length < 8, queries: [`${co} managing director strategy outlook priorities ${S}`, `${co} CEO interview growth plans new products efficiency`], deep: false },
    list("F3", "new_to_firm", "New to the company", 1, `${co} first-ever new product launch new market ${S}`),
    list("F3", "new_capability_investments", "New capabilities", 1, `${co} acquisition stake technology partnership ${S}`),
    list("F3", "efficiency_programmes", "Efficiency programmes", 1, `${co} cost reduction programme productivity savings`),
    list("F3", "incremental_launches", "Incremental launches", 1, `${co} facelift new variant launch ${S}`),
    val("F3", "capex_orientation", "Capital spending", `${co} capex plan ${S} capacity expansion new models`, null, false),
    { fw: "F4", keys: ["exploratory_unit"], label: "Unit for new businesses", missing: () => !(F4("exploratory_unit")?.form && verifiedIn(F4("exploratory_unit").evidence)), queries: [`${co} electric vehicle subsidiary business unit`], deep: false },
    { fw: "F4", keys: ["autonomy_attributes", "integration_attributes"], label: "Autonomy and integration of the unit", missing: () => itemsFound(F4("autonomy_attributes")) + itemsFound(F4("integration_attributes")) < 2, queries: [`${co} ${unit || "electric vehicle subsidiary"} CEO board brand investors`], deep: false },
    list("F4", "recent_changes", "Recent changes", 1, `${co} demerger restructuring new subsidiary ${S}`),
    { fw: "F4", keys: ["centralization", "formalization", "horizontal_coordination"], label: "How the core is run", missing: () => ["centralization", "formalization", "horizontal_coordination"].some((k) => !valueFound(F4(k))), queries: [`${co} organisation structure decision making cross-functional teams`], deep: false },
    list("F4", "job_postings", "Job postings", 1, `${co} careers ${unit || "electric vehicle"} job description`, `${co} job openings manufacturing engineer responsibilities`),
  ];
}

const LIST_NAME = (i) => String(i?.name || i?.category || i?.item || i?.description || i?.attribute || i?.title || "").toLowerCase().trim();

// Put what the web found into the extraction, only where the documents had nothing.
function mergeWeb(x, profile, fw, key, found) {
  if (found == null) return 0;
  if (fw === "PROFILE") {
    if (valueFound(profile.incorporated) || !valueFound(found)) return 0;
    const y = Number(String(found.value).slice(0, 4));
    if (!(y > 1800 && y <= new Date().getFullYear())) return 0;
    profile.incorporated = { value: y, evidence: found.evidence.filter((e) => e.verified) };
    return 1;
  }
  const cur = x[fw]?.[key];
  x[fw] = x[fw] || {};
  if (Array.isArray(found)) {
    const keep = key === "statements" ? found.filter((st) => st && st.verified) : found.filter((i) => verifiedIn(i?.evidence));
    const seen = new Set((cur || []).map(key === "statements" ? (st) => st.quote : LIST_NAME));
    const add = keep.filter((i) => { const k = key === "statements" ? i.quote : LIST_NAME(i); if (seen.has(k)) return false; seen.add(k); return true; });
    x[fw][key] = [...(cur || []), ...add];
    return add.length;
  }
  const filled = key === "exploratory_unit" ? (f) => !!f?.form && verifiedIn(f.evidence) : valueFound;
  if (filled(cur) || !filled(found)) return 0;
  x[fw][key] = { ...found, evidence: found.evidence.filter((e) => e.verified) };
  return 1;
}

const WEB_FW = (gaps) => Object.fromEntries(gaps.flatMap((g) => g.keys.map((k) => [k, g.fw === "PROFILE" ? "F3" : g.fw])));

async function fillFromWeb({ extraction: x, profile, context, fy, passcode, lookup, webText, stats, errors, log, onEvent, stopIfCancelled }) {
  const co = context.company || "";
  const report = { tried: [], filled: [], missing: [], keys: {} };
  const allResults = [];
  if (!co) return { results: allResults, report };
  const gaps = gapList(x, profile, co, fy);
  const fwOf = WEB_FW(gaps);
  const ctx = { company: co, scope: context.scope, fy: `${fy.long} (April ${fy.label.slice(0, 4)} to March ${Number(fy.label.slice(0, 4)) + 1})` };

  for (const round of [0, 1]) {
    const open = gaps.filter((g) => g.queries[round] && g.missing());
    if (!open.length) continue;
    if (round === 0) report.tried = open.map((g) => g.label);
    // four searches per request keeps each one well inside the server's time limit
    const batches = [];
    for (let i = 0; i < open.length; i += 4) batches.push(open.slice(i, i + 4));
    const step = log.start(round === 0 ? `Searching the web for ${open.length} inputs the documents did not have` : `Trying other searches for ${open.length} inputs still missing`);
    let found = 0;
    for (const [bi, batch] of batches.entries()) {
      stopIfCancelled();
      const queries = batch.map((g) => ({ q: g.queries[round], deep: g.deep }));
      const fields = [...new Set(batch.flatMap((g) => g.keys))];
      onEvent({ type: "web", round, batch: bi, batches: batches.length, queries: queries.map((q) => q.q), need: batch.map((g) => g.label) });
      try {
        const res = await post("/api/search", { queries, fields, context: ctx }, passcode);
        for (const r of res.results || []) { webText[r.url] = `${r.title}\n${r.content}`; if (!allResults.some((a) => a.url === r.url)) allResults.push({ title: r.title, url: r.url }); }
        const raw = res.extraction || {};
        const { statements, ...rest } = raw;
        const got = verifyTree(rest, lookup, stats);
        if (statements) got.statements = verifyStatements(statements.map((st) => ({ ...st, doc: "WEB" })), lookup, stats);
        const chips = [];
        for (const g of batch) for (const k of g.keys) {
          const n = mergeWeb(x, profile, g.fw, k, got[k]);
          found += n;
          if (n) chips.push(...(k === "statements" ? got.statements.filter((st) => st.verified).map((st) => chip(st, "F2", st.label)) : quotesIn(got[k], fwOf[k], [], FIELD_LABEL[k])));
        }
        onEvent({ type: "webFound", round, results: (res.results || []).map((r) => ({ title: r.title, url: r.url })), chips });
      } catch (e) {
        errors.push(`web search: ${e.message}`);
        onEvent({ type: "webFailed", round, message: e.message });
        if (/not set|rejected|access code/i.test(e.message)) { log.fail(step, `Web search failed: ${e.message}`); return finish(); }
      }
    }
    log.done(step, `Searched the web: ${found} inputs or items added`);
  }
  return finish();

  function finish() {
    for (const g of gaps) {
      const searched = report.tried.includes(g.label);
      const still = g.missing();
      for (const k of g.keys) report.keys[k] = searched ? (still ? "missing" : "filled") : "documents";
      if (searched) (still ? report.missing : report.filled).push(g.label);
    }
    return { results: allResults, report };
  }
}

// The financial year the documents describe, read from the opening pages of the annual
// report (e.g. "2025-26"). If it cannot be read, the last financial year that has ended.
function reportYear(docs) {
  const counts = new Map();
  const ar = docs.find((d) => d.id === "AR") || docs[0];
  for (const p of (ar?.pages || []).slice(0, 8)) for (const m of p.text.matchAll(/\b(20\d{2})\s?[-–]\s?(\d{2})\b/g)) {
    const a = Number(m[1]), b = Number(m[2]);
    if ((a + 1) % 100 === b) counts.set(a, (counts.get(a) || 0) + 1);
  }
  let start = [...counts.entries()].sort((p, q) => q[1] - p[1] || q[0] - p[0])[0]?.[0];
  const now = new Date();
  if (!start || start + 1 > now.getFullYear()) start = (now.getMonth() >= 4 ? now.getFullYear() : now.getFullYear() - 1) - 1;
  const yy = String(start + 1).slice(2);
  return { long: `FY${start}-${yy}`, short: `FY${yy}`, label: `${start}-${yy}` };
}

// Year of incorporation from the Corporate Identity Number every Indian company prints in its
// annual report (characters 9 to 12 of the CIN are the year). Reports also print the CINs of
// subsidiaries and registrars, so the one that appears most often is taken. No AI needed.
const CIN = /\b[LU]\d{5}[A-Z]{2}(\d{4})[A-Z]{3}\d{6}\b/g;
function findIncorporation(docs) {
  const now = new Date().getFullYear(), seen = new Map();
  for (const d of docs) for (const p of d.pages) for (const m of p.text.matchAll(CIN)) {
    const year = Number(m[1]);
    if (year < 1850 || year > now) continue;
    const s = seen.get(m[0]) || { n: 0, year, doc: d.id, page: p.page, quote: p.text.slice(Math.max(0, m.index - 60), m.index + m[0].length + 20).replace(/\s+/g, " ").trim() };
    s.n += d.id === "AR" ? 2 : 1; seen.set(m[0], s);
  }
  const best = [...seen.values()].sort((a, b) => b.n - a.n)[0];
  if (!best) return { value: null, evidence: [] };
  return { value: best.year, evidence: [{ doc: best.doc, page: best.page, quote: best.quote, type: "fact", verified: true }] };
}

// Key figures shown to the user for confirmation before scoring
export const FIGURES = [
  { key: "revenue", label: "Revenue", unit: "₹ crore", src: ["F3", "revenue_crore"] },
  { key: "rnd", label: "Research and development expenditure", unit: "₹ crore", src: ["F3", "rnd_crore"] },
  { key: "pat", label: "Profit after tax", unit: "₹ crore", src: ["F3", "pat_crore"] },
  { key: "dividends", label: "Dividends for the year", unit: "₹ crore", src: ["F3", "dividends_crore"] },
  { key: "buyback", label: "Share buyback", unit: "₹ crore", src: ["F3", "buyback_crore"] },
  { key: "royalty", label: "Royalty or technology fees to a parent", unit: "₹ crore", src: ["F3", "royalty_crore"] },
  { key: "export_share", label: "Exports as a share of volume", unit: "%", src: ["F1", "export_share_pct"] },
  { key: "ev_share", label: "Electric vehicles as a share of sales", unit: "%", src: ["F1", "firm_ev_share_pct"] },
  { key: "new_business_share", label: "New businesses as a share of revenue or volume", unit: "%", src: ["F3", "new_business_share_pct"] },
];

// Company facts shown with the key figures; they describe the company and are not scored.
export const PROFILE_FIGS = [
  { key: "employees", label: "Employees", unit: "people", src: ["F3", "employees"] },
  { key: "incorporated", label: "Year of incorporation", unit: "", src: ["PROFILE", "incorporated"] },
];

export function initialFigures(extraction, profile = {}) {
  const out = {};
  for (const f of [...FIGURES, ...PROFILE_FIGS]) {
    const field = f.src[0] === "PROFILE" ? profile[f.src[1]] : extraction[f.src[0]]?.[f.src[1]];
    const ev = (field?.evidence || []).filter((e) => e.verified);
    const parsed = field && field.value != null ? Number(String(field.value).replace(/[,₹%\s]/g, "")) : NaN;
    const v = !isNaN(parsed) && ev.length ? parsed : null;
    out[f.key] = { value: v == null ? "" : String(v), original: v, evidence: ev };
  }
  return out;
}

// Apply confirmed figures back onto the extraction and build the engine's figures object
export function applyFigures(extraction, figs) {
  const x = JSON.parse(JSON.stringify(extraction));
  const engineFigs = {};
  for (const f of FIGURES) {
    const st = figs[f.key];
    const raw = st.value === "" ? null : Number(st.value);
    const edited = raw !== st.original;
    const evidence = raw == null ? [] : edited || !st.evidence.length
      ? [{ doc: "USER", quote: `Value ${st.original == null ? "entered" : "changed"} by the user: ${raw} ${f.unit}`, type: "fact", verified: true }]
      : st.evidence;
    const field = { value: raw, evidence, basis: x[f.src[0]]?.[f.src[1]]?.basis };
    x[f.src[0]] = { ...(x[f.src[0]] || {}), [f.src[1]]: field };
    if (f.src[0] === "F3" && f.key !== "new_business_share") engineFigs[f.key] = raw == null ? null : { value: raw, evidence };
  }
  return { extraction: x, figures: engineFigs };
}

export async function fetchNarrative(result, context, passcode) {
  const fw = result.frameworks;
  const summaryInput = {
    company: context.company,
    environment: { output: fw.F1.output, complexity: fw.F1.scores.complexity, change: fw.F1.scores.change, confidence: fw.F1.confidence },
    strategy: { output: fw.F2.output, exploratoryShare: fw.F2.scores.exploratoryShare, exploitativeShare: fw.F2.scores.exploitativeShare, confidence: fw.F2.confidence },
    behaviour: { output: fw.F3.output, exploration: fw.F3.scores.exploration, exploitation: fw.F3.scores.exploitation, parentFlag: fw.F3.parentFlag, confidence: fw.F3.confidence },
    structure: { output: fw.F4.output, coreDesign: fw.F4.scores.coreLabel, confidence: fw.F4.confidence },
    flags: result.flags.map((f) => ({ flag: f.flag, condition: f.condition, confidence: f.confidence })),
    verdict: result.verdict,
  };
  const { summary } = await post("/api/narrative", { summaryInput }, passcode);
  return summary;
}
