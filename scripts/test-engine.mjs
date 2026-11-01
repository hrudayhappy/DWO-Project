import { runDiagnosis } from "../lib/engine.js";
import { INDUSTRY_PROFILES } from "../lib/industryProfile.js";
const P = INDUSTRY_PROFILES["indian-automobiles"];
const E = (doc, page) => [{ doc, page, quote: "q", type: "fact", verified: true }];
const L = (n, doc = "AR") => Array.from({ length: n }, (_, i) => ({ item: "x" + i, name: "n" + i, category: "c" + i, description: "d" + i, evidence: E(doc, i + 1) }));
const base = {
  F1: { segments: L(3), powertrains: L(4, "IP"), export_share_pct: { value: 30, evidence: E("AR", 3) }, risk_categories: L(8), firm_ev_share_pct: { value: 25, evidence: E("IP", 2) }, disruptions: L(3) },
  F2: { statements: [...Array(6)].map((_, i) => ({ doc: i % 2 ? "AR" : "EC", page: i, quote: "q", label: "exploratory", verified: true })).concat([...Array(4)].map((_, i) => ({ doc: "AR", page: i, quote: "q", label: "exploitative", verified: true }))) },
  F3: { new_to_firm: L(0), new_business_share_pct: { value: 1, evidence: E("IP", 5) }, new_capability_investments: L(0), efficiency_programmes: [{ item: "TPM", quantified: true, evidence: E("AR", 9) }], capex_orientation: { value: "existing_capacity", evidence: E("AR", 10) }, incremental_launches: L(9), new_to_firm: L(1) },
  F4: { exploratory_unit: { form: "none", evidence: E("AR", 42) }, centralization: { value: "centralised", evidence: E("AR", 3) }, formalization: { value: "high", evidence: E("AR", 4) }, horizontal_coordination: { value: "weak", evidence: E("AR", 5) } },
};
const figs = { revenue: { value: 100000, evidence: E("AR", 1) }, rnd: { value: 500, evidence: E("AR", 2) }, pat: { value: 10000, evidence: E("AR", 3) }, dividends: { value: 9000, evidence: E("AR", 4) }, royalty: { value: 3000, evidence: E("AR", 5) } };
let r = runDiagnosis(base, figs, P);
const show = (r, t) => console.log("\n==", t, "\n", Object.values(r.frameworks).map((f) => `${f.id}: ${f.output} [${f.confidence}] ${JSON.stringify(f.scores)}`).join("\n "), "\n flags:", r.flags.map((f) => `${f.flag} (${f.confidence})`).join(", ") || "none", "\n verdict:", r.verdict, "\n parent:", r.frameworks.F3.parentFlag);
show(r, "Case A: high uncertainty, exploitation-heavy, analyzer claims, mechanistic, no unit");
const B = JSON.parse(JSON.stringify(base));
B.F3 = { new_to_firm: L(4), new_business_share_pct: { value: 35, evidence: E("IP", 5) }, new_capability_investments: L(2), efficiency_programmes: L(1), capex_orientation: { value: "mixed", evidence: E("AR", 10) }, incremental_launches: L(3) };
B.F4 = { exploratory_unit: { form: "subsidiary", name: "EV Co", evidence: E("AR", 9) }, autonomy_attributes: ["separate_legal_entity", "own_leader", "own_brand_or_channel"].map((a) => ({ attribute: a, evidence: E("AR", 9) })), integration_attributes: ["shared_ceo_or_reports_to_ceo", "shared_platforms_or_supply"].map((a) => ({ attribute: a, evidence: E("AR", 25) })), recent_changes: [], centralization: { value: "mixed", evidence: E("AR", 3) }, formalization: { value: "moderate", evidence: E("AR", 4) } };
show(runDiagnosis(B, { ...figs, rnd: { value: 5500, evidence: E("AR", 2) }, royalty: null }, P), "Case B: separate EV subsidiary, exploration-led");
const C = JSON.parse(JSON.stringify(B));
C.F4.recent_changes = [{ description: "EV unit merged into two-wheeler BU", direction: "reintegrated", evidence: E("EC", 3) }];
C.F4.new_business_profitable = { value: true, evidence: E("EC", 4) };
show(runDiagnosis(C, figs, P), "Case C: reintegration after maturity");
show(runDiagnosis({ F1: {}, F2: {}, F3: {}, F4: {} }, {}, P), "Case D: empty evidence (stress test)");
const Ecase = JSON.parse(JSON.stringify(B));
Ecase.F2 = { statements: [...Array(7)].map((_, i) => ({ doc: i % 2 ? "AR" : "EC", page: i, quote: "q", label: "exploitative", verified: true })).concat([...Array(3)].map((_, i) => ({ doc: "AR", page: i, quote: "q", label: "neither", verified: true }))) };
show(runDiagnosis(Ecase, { ...figs, rnd: { value: 5500, evidence: E("AR", 2) }, royalty: null }, P), "Case E: Defender claims with exploration-led behaviour (reverse gap)");
