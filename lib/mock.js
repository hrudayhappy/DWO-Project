// Mock extractor used only when MOCK_AI=1 (for testing without API keys).
// It quotes real sentences from the supplied pages so that quote verification still runs.

function sentences(pages, re, max = 6) {
  const out = [];
  for (const p of pages) {
    const parts = p.text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/);
    for (const s of parts) {
      if (re.test(s) && s.length > 40 && s.length < 400) {
        const w = s.split(" ").slice(0, 25).join(" ");
        out.push({ doc: p.doc, page: p.page, quote: w, type: "company_claim" });
        if (out.length >= max) return out;
      }
    }
  }
  return out;
}
const one = (pages, re) => sentences(pages, re, 1);

export function mockExtract(framework, pages) {
  if (framework === "F1") {
    const ev = one(pages, /electric|EV/i);
    return {
      segments: [{ name: "passenger vehicles", evidence: one(pages, /passenger vehicle/i) }, { name: "exports", evidence: one(pages, /export/i) }],
      powertrains: [{ name: "petrol", evidence: one(pages, /petrol/i) }, { name: "electric", evidence: ev }, { name: "CNG", evidence: one(pages, /CNG/i) }],
      export_share_pct: { value: 15, evidence: one(pages, /export/i) },
      markets_served: { value: 100, evidence: one(pages, /countries/i) },
      risk_categories: ["regulation", "raw materials", "technology", "geopolitics", "supply chain", "currency"].map((c) => ({ category: c, evidence: one(pages, new RegExp(c.split(" ")[0], "i")) })),
      firm_ev_share_pct: { value: 12, basis: "volume", evidence: ev },
      disruptions: sentences(pages, /disrupt|shortage|tariff|conflict/i, 2).map((e) => ({ description: e.quote.slice(0, 60), evidence: [e] })),
      regulatory_changes: [],
    };
  }
  if (framework === "F2") {
    const ex = sentences(pages, /new|launch|enter|electric|future/i, 8).map((e) => ({ ...e, label: "exploratory", is_priority: false }));
    const ep = sentences(pages, /cost|efficien|margin|profitab|capacity/i, 6).map((e) => ({ ...e, label: "exploitative", is_priority: true }));
    return { statements: [...ex, ...ep], contradictions: [] };
  }
  if (framework === "F3") {
    return {
      basis: "standalone",
      revenue_crore: { value: 50000, evidence: one(pages, /revenue/i) },
      rnd_crore: { value: 900, evidence: one(pages, /research and development|R&D/i) },
      pat_crore: { value: 5000, evidence: one(pages, /profit/i) },
      employees: { value: null, evidence: [] }, // left for the web search to fill
      dividends_crore: { value: 2000, evidence: one(pages, /dividend/i) },
      buyback_crore: { value: null, evidence: [] },
      royalty_crore: { value: null, evidence: [] },
      new_to_firm: sentences(pages, /launch|new/i, 3).map((e) => ({ item: e.quote.slice(0, 50), evidence: [e] })),
      new_business_share_pct: { value: 12, basis: "volume", evidence: one(pages, /electric|EV/i) },
      new_capability_investments: sentences(pages, /acqui|partnership|stake/i, 1).map((e) => ({ item: e.quote.slice(0, 50), major: false, evidence: [e] })),
      efficiency_programmes: sentences(pages, /cost|productiv|efficien/i, 2).map((e) => ({ item: e.quote.slice(0, 50), quantified: false, strategic_priority: true, evidence: [e] })),
      capex_orientation: { value: "mixed", evidence: one(pages, /capacity|capital/i) },
      incremental_launches: sentences(pages, /variant|facelift|refresh|upgrade/i, 4).map((e) => ({ item: e.quote.slice(0, 50), evidence: [e] })),
    };
  }
  if (framework === "F4") {
    return {
      exploratory_unit: { form: "subsidiary", name: "EV subsidiary", evidence: one(pages, /subsidiar/i) },
      autonomy_attributes: [{ attribute: "separate_legal_entity", evidence: one(pages, /subsidiar/i) }, { attribute: "own_leader", evidence: one(pages, /chief|president/i) }],
      integration_attributes: [{ attribute: "shared_ceo_or_reports_to_ceo", evidence: one(pages, /managing director|chief executive/i) }],
      recent_changes: sentences(pages, /reorgani|restructur|demerg|amalgam/i, 1).map((e) => ({ description: e.quote.slice(0, 60), direction: "created", date: "", evidence: [e] })),
      new_business_profitable: { value: null, evidence: [] },
      centralization: { value: "mixed", evidence: one(pages, /decision|delegat/i) },
      formalization: { value: "high", evidence: one(pages, /TPM|standard|procedure/i) },
      horizontal_coordination: { value: "some", evidence: one(pages, /cross-functional|cross functional|collaborat/i) },
    };
  }
  return {};
}

// Fills every requested field except buyback and royalty, so that the "not found after
// searching" path is exercised too.
const MOCK_VALUES = { revenue_crore: 52000, rnd_crore: 950, pat_crore: 4800, employees: 41000, dividends_crore: 1800, export_share_pct: 14, markets_served: 70, firm_ev_share_pct: 11, new_business_share_pct: 11, incorporated_year: 1945, capex_orientation: "mixed", centralization: "mixed", formalization: "high", horizontal_coordination: "some" };
export function mockWeb(results, fields = []) {
  let i = 0;
  const ev = () => { const r = results[i++ % results.length]; return { doc: "WEB", url: r.url, title: r.title, quote: r.content.split(" ").slice(0, 15).join(" "), type: "third_party" }; };
  const out = {};
  for (const f of fields) {
    if (f in MOCK_VALUES) out[f] = { value: MOCK_VALUES[f], year: "FY2025-26", evidence: [ev()] };
    else if (f === "buyback_crore" || f === "royalty_crore") out[f] = { value: null, evidence: [] };
    else if (f === "exploratory_unit") out[f] = { form: "subsidiary", name: "EV subsidiary", evidence: [ev()] };
    else if (f === "statements") out[f] = ["exploratory", "exploitative", "both"].map((label) => ({ ...ev(), type: "company_claim", label, is_priority: false }));
    else if (f === "job_postings") out[f] = results.slice(0, 4).map((r, k) => ({ title: r.title, style: k % 2 ? "mechanistic" : "organic", evidence: [ev()] }));
    else if (f === "autonomy_attributes") out[f] = [{ attribute: "own_leader", evidence: [ev()] }];
    else if (f === "integration_attributes") out[f] = [{ attribute: "shared_directors", evidence: [ev()] }];
    else out[f] = [{ name: `${f.replace(/_/g, " ")} from the web`, item: `${f.replace(/_/g, " ")} from the web`, category: "cyber", description: `${f.replace(/_/g, " ")} from the web`, evidence: [ev()] }];
  }
  return out;
}

export function mockSearch(query) {
  return [1, 2, 3, 4].map((i) => ({ title: `Sample result ${i} for ${query}`, url: `https://example.com/${encodeURIComponent(query)}/${i}`, content: `This is sample search content number ${i} describing roles that require cross-functional collaboration and comfort with ambiguity for ${query}.` }));
}
