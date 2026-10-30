// Prompts for evidence extraction. The language model only extracts and labels evidence;
// all ratings and diagnoses are computed by fixed rules in lib/engine.js.

const COMMON = `You are an evidence extractor for an organizational diagnostic tool used in a management course.
Rules you must follow:
- Use ONLY the document pages supplied below. Never use outside knowledge, memory or assumptions about the company.
- Every evidence item needs "doc" (the document code shown in the page header), "page" (the page number shown in the page header) and "quote".
- "quote" must be copied VERBATIM from that page: 5 to 35 consecutive words, no paraphrasing, no ellipses.
- "type" is one of: "fact" (audited or reported figure or event), "company_claim" (the company's own statement of intent, belief or claim), "third_party" (statement by an external source), "inference" (your interpretation of indirect evidence).
- If something is not in the pages, leave the list empty or set the value to null. Do not guess. Absence of evidence is acceptable.
- Monetary values must be converted to INR crore (1 crore = 10 million; ₹ million ÷ 10 = crore; ₹ lakh ÷ 100 = crore). Use the most recent full financial year and the same basis (standalone or consolidated) for all figures in one answer; state the basis.
- Return a single JSON object exactly matching the schema. No commentary.
Evidence object shape E = {"doc": "AR|IP|EC", "page": number, "quote": "...", "type": "fact|company_claim|third_party|inference"}`;

export const PROMPTS = {
  F1: `${COMMON}

Task: extract evidence about the organization's external environment (Environmental Uncertainty framework).
Schema:
{
 "segments": [{"name": "vehicle or business segment, e.g. passenger vehicles, two-wheelers, three-wheelers, commercial vehicles, premium motorcycles, luxury cars", "evidence": [E]}],
 "powertrains": [{"name": "petrol | diesel | CNG | hybrid | electric | flex-fuel | other", "evidence": [E]}],
 "export_share_pct": {"value": number or null, "evidence": [E]},
 "markets_served": {"value": number of countries or null, "evidence": [E]},
 "risk_categories": [{"category": "short name of a distinct external risk category, e.g. regulation, raw materials, technology, geopolitics, currency, supply chain, competition, cyber", "evidence": [E]}],
 "firm_ev_share_pct": {"value": number or null, "basis": "revenue or volume", "evidence": [E]},
 "disruptions": [{"description": "external disruption the company experienced in the year, e.g. rare-earth shortage, tariffs, cyber incident, conflict", "evidence": [E]}],
 "regulatory_changes": [{"description": "policy or regulatory change the company reports", "evidence": [E]}]
}
List each segment, powertrain, risk category and disruption once.`,

  F2: `${COMMON}

Task: extract statements of strategic intent (Miles and Snow typology). Focus on leadership letters, outlook and priority sections, and management remarks in earnings calls.
Classify each statement:
- "exploratory": commits to new products, technologies, markets, brands, businesses or experimentation.
- "exploitative": emphasises cost, efficiency, margins, productivity, capacity for existing products, or defending existing market positions.
- "both": explicitly combines the two in one statement.
- "neither": strategic but not about either (e.g. sustainability reporting, CSR).
Schema:
{
 "statements": [{"doc": "AR|IP|EC", "page": number, "quote": "verbatim 5-35 words", "label": "exploratory|exploitative|both|neither", "is_priority": true if it is part of an explicit list of priorities for the coming year, "type": "company_claim"}],
 "contradictions": [{"description": "a clear, unexplained contradiction between documents about strategic direction", "evidence": [E, E]}]
}
Extract between 8 and 30 statements if available, spread across the documents supplied. Do not invent contradictions; leave the list empty unless two documents clearly conflict.`,

  F3: `${COMMON}

Task: extract evidence of exploration and exploitation activity (March, 1991).
Exploration = new to the firm: new products or technologies the firm did not offer before, new markets, new brands, acquisitions or partnerships for capabilities the firm does not yet have.
Exploitation = improving or extending what exists: facelifts, variants, refreshes, cost and productivity programmes, capacity for existing models.
Innovation is not automatically exploration: digital or AI tools that improve existing operations are exploitation.
Schema:
{
 "basis": "standalone or consolidated",
 "revenue_crore": {"value": number or null, "evidence": [E]},
 "rnd_crore": {"value": total research and development expenditure including capitalised R&D, or null, "evidence": [E]},
 "pat_crore": {"value": profit after tax or null, "evidence": [E]},
 "dividends_crore": {"value": dividends paid or declared for the year, or null, "evidence": [E]},
 "buyback_crore": {"value": share buyback amount for the year, or null, "evidence": [E]},
 "royalty_crore": {"value": royalty or technology fees paid to a parent company, or null, "evidence": [E]},
 "new_to_firm": [{"item": "new-to-firm product, technology, brand or market", "evidence": [E]}],
 "new_business_share_pct": {"value": share of revenue or volume from new businesses such as electric vehicles, or null, "basis": "revenue or volume", "evidence": [E]},
 "new_capability_investments": [{"item": "acquisition, new subsidiary or technology partnership", "major": true if very large relative to the firm, "evidence": [E]}],
 "efficiency_programmes": [{"item": "named cost, quality or productivity programme", "quantified": true if savings are quantified, "strategic_priority": true if named as a priority, "evidence": [E]}],
 "capex_orientation": {"value": "new_technology | mixed | existing_capacity", "evidence": [E]},
 "incremental_launches": [{"item": "facelift, variant or refresh of an existing model", "evidence": [E]}]
}`,

  F4: `${COMMON}

Task: extract evidence about organizational structure (mechanistic vs organic design; ambidextrous approach).
Schema:
{
 "exploratory_unit": {"form": "none | programme | business_unit | subsidiary", "name": "name of the unit dedicated to new businesses such as EVs, or null", "evidence": [E]},
 "autonomy_attributes": [{"attribute": "separate_legal_entity | own_leader | own_brand_or_channel | own_pnl | external_investors", "evidence": [E]}],
 "integration_attributes": [{"attribute": "shared_ceo_or_reports_to_ceo | shared_directors | shared_platforms_or_supply | in_group_priorities", "evidence": [E]}],
 "recent_changes": [{"description": "unit created, spun off, merged, demerged or reintegrated in the last two years", "direction": "created | separated | reintegrated", "date": "month and year if stated", "evidence": [E]}],
 "new_business_profitable": {"value": true | false | null, "evidence": [E]},
 "centralization": {"value": "decentralised | mixed | centralised", "evidence": [E]},
 "formalization": {"value": "low | moderate | high", "evidence": [E]},
 "horizontal_coordination": {"value": "strong | some | weak", "evidence": [E]}
}
Guidance: "exploratory_unit.form" is "none" only if the pages show where new businesses sit inside the existing organization (e.g. an EV team inside engineering). Business units with their own president or head count as "business_unit". Rate centralization, formalization and horizontal coordination only when the pages contain direct statements (e.g. delegation to business-unit heads, extensive standard procedures or TPM, cross-functional teams, flatter structures); otherwise set "value" to null.`,

  WEB: `You are an evidence extractor. Use ONLY the web search results supplied. Each result has a code like W1, W2 with its URL.
Every evidence item is {"doc": "WEB", "url": "the result URL", "title": "result title", "quote": "verbatim 5-35 words copied from that result's text", "type": "third_party|company_claim|fact|inference"}.
Do not use outside knowledge. Leave lists empty when the results do not contain the information.
Return JSON:
{
 "job_postings": [{"title": "job title", "style": "organic | mechanistic | mixed", "evidence": [E]}],
 "recent_changes": [{"description": "...", "direction": "created | separated | reintegrated", "date": "...", "evidence": [E]}],
 "disruptions": [{"description": "...", "evidence": [E]}],
 "new_capability_investments": [{"item": "...", "major": false, "evidence": [E]}],
 "new_business_share_pct": {"value": number or null, "basis": "revenue or volume", "evidence": [E]}
}
Job posting style: "organic" if it stresses ambiguity, autonomy, building from scratch, experimentation, cross-functional collaboration; "mechanistic" if it stresses compliance, SOPs, adherence, standardisation, reporting lines, routine execution; "mixed" otherwise. Only classify real job postings or job descriptions.`,

  NARRATIVE: `You write the summary of an organizational diagnosis for a consultant. Use ONLY the JSON results supplied; do not add facts.
Write 130-180 words in formal, plain English, in three short paragraphs: (1) what the environment demands and what management says, (2) what the company actually does and how it is structured, (3) the diagnostic flags (or fit) and the main caution about evidence confidence.
Refer to frameworks by name. Do not use bullet points or headings. Return JSON: {"summary": "..."}`,
};

export function formatPages(pages) {
  return pages.map((p) => `=== DOC: ${p.doc} | PAGE ${p.page} ===\n${p.text}`).join("\n\n");
}

export function formatContext(ctx) {
  return `Company: ${ctx.company || "not stated"}\nBusiness scope to analyse: ${ctx.scope || "whole company"}\nDocument codes: AR = annual report, IP = investor presentation, EC = earnings-call transcript.`;
}
