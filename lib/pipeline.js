"use client";
// Client-side pipeline: read PDFs, select pages, call the server for extraction,
// verify quotations, fill gaps with web search. Scoring happens in lib/engine.js.

import { selectPages } from "./sections";
import { verifyEvidence } from "./verify";

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

async function post(url, body, passcode) {
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
  revenue_crore: "Revenue", rnd_crore: "R&D spend", pat_crore: "Profit after tax", dividends_crore: "Dividends", buyback_crore: "Buyback",
  royalty_crore: "Royalty to parent", export_share_pct: "Export share", firm_ev_share_pct: "EV share", markets_served: "Markets served",
  new_business_share_pct: "New-business share", capex_orientation: "Capital spending", centralization: "Centralisation", formalization: "Formalisation",
  horizontal_coordination: "Coordination", new_business_profitable: "New-business profit", exploratory_unit: "Exploratory unit",
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
const WEB_BUCKET = { job_postings: "F4", recent_changes: "F4", disruptions: "F1", new_capability_investments: "F3", new_business_share_pct: "F3" };

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

  // 5. Fill gaps with web search
  const has = (list) => (list || []).some((i) => (i.evidence || []).some((e) => e.verified));
  const hasVal = (f) => f && f.value != null && (f.evidence || []).some((e) => e.verified);
  const co = context.company || "";
  const unit = extraction.F4?.exploratory_unit?.name;
  const queries = [`${co} careers job description ${unit || "electric vehicle"} roles`, `${co} job openings manufacturing operations engineer`];
  if (!has(extraction.F4?.recent_changes)) queries.push(`${co} reorganisation new business unit 2026`);
  if (!hasVal(extraction.F3?.new_business_share_pct)) queries.push(`${co} electric vehicle share of sales FY26`);
  else if (!has(extraction.F1?.disruptions)) queries.push(`${co} supply chain disruption 2026`);
  let web = { results: [] };
  stopIfCancelled();
  if (co) {
    const step = log.start(`Searching the web for ${queries.length} missing or supporting inputs`);
    onEvent({ type: "web", queries });
    try {
      web = await post("/api/search", { queries }, passcode);
      for (const r of web.results || []) webText[r.url] = `${r.title}\n${r.content}`;
      const x = verifyTree(web.extraction || {}, lookup, stats);
      extraction.F4 = { ...extraction.F4, job_postings: x.job_postings || [], recent_changes: [...(extraction.F4?.recent_changes || []), ...(x.recent_changes || [])] };
      extraction.F1 = { ...extraction.F1, disruptions: [...(extraction.F1?.disruptions || []), ...(x.disruptions || [])] };
      extraction.F3 = { ...extraction.F3, new_capability_investments: [...(extraction.F3?.new_capability_investments || []), ...(x.new_capability_investments || [])] };
      if (!hasVal(extraction.F3?.new_business_share_pct) && hasVal(x.new_business_share_pct)) extraction.F3.new_business_share_pct = x.new_business_share_pct;
      onEvent({ type: "webFound", results: (web.results || []).map((r) => ({ title: r.title, url: r.url })), chips: Object.entries(WEB_BUCKET).flatMap(([k, fw]) => quotesIn(x[k], fw, [], FIELD_LABEL[k])) });
      log.done(step, `Searched the web: ${(web.results || []).length} results, ${(x.job_postings || []).length} job postings classified`);
    } catch (e) {
      errors.push(`web search: ${e.message}`);
      log.fail(step, `Web search failed: ${e.message}`);
      onEvent({ type: "webFailed", message: e.message });
    }
  }
  log.done(log.start("Checking quotations"), `Checked quotations: ${stats.verified} of ${stats.total} verified; ${stats.total - stats.verified} discarded`);
  onEvent({ type: "checked", total: stats.total, verified: stats.verified });

  return { extraction, stats, pagesUsed, webResults: web.results || [], errors, docsRead: docs.map((d) => ({ id: d.id, pages: d.pages.length })) };
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

export function initialFigures(extraction) {
  const out = {};
  for (const f of FIGURES) {
    const field = extraction[f.src[0]]?.[f.src[1]];
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
