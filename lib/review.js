// The review step: list every piece of extracted evidence by framework so the user can leave
// items out or correct a classification before the rules in lib/engine.js score them.
// Leaving an item out marks its quotations as not verified, which the engine already ignores.

const PRETTY = {
  separate_legal_entity: "A separate legal entity", own_leader: "Its own leader", own_brand_or_channel: "Its own brand or sales channel",
  own_pnl: "Its own profit and loss", external_investors: "Outside investors",
  shared_ceo_or_reports_to_ceo: "Reports to the group CEO", shared_directors: "Shares directors with the group",
  shared_platforms_or_supply: "Shares platforms or supply chain", in_group_priorities: "Part of the group's priorities",
};
const FORM = { none: "inside the existing organisation", programme: "a programme", business_unit: "a business unit", subsidiary: "a subsidiary" };
const CAPEX = { new_technology: "Little goes to capacity for current models", mixed: "A moderate share goes to capacity for current models", existing_capacity: "Most goes to capacity for current models" };
const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : "");

const FIELDS = {
  F1: [
    { key: "segments", title: "Segments", head: (i) => i.name },
    { key: "powertrains", title: "Powertrains", head: (i) => i.name },
    { key: "markets_served", one: true, title: "Markets served", head: (f) => (f.value != null ? `${f.value} countries` : null) },
    { key: "risk_categories", title: "Risk categories", head: (i) => i.category },
    { key: "disruptions", title: "Disruptions in the year", head: (i) => i.description },
    { key: "regulatory_changes", title: "Regulatory changes", head: (i) => i.description },
  ],
  F2: [
    { key: "statements", title: "Statements of intent", kind: "statement" },
    { key: "contradictions", title: "Contradictions between documents", head: (i) => i.description },
  ],
  F3: [
    { key: "new_to_firm", title: "New to the firm", head: (i) => i.item },
    { key: "new_capability_investments", title: "Acquisitions and partnerships", head: (i) => `${i.item}${i.major ? " (major)" : ""}` },
    { key: "efficiency_programmes", title: "Efficiency programmes", head: (i) => i.item },
    { key: "incremental_launches", title: "Facelifts and variants", head: (i) => i.item },
    { key: "capex_orientation", one: true, title: "Capital spending", head: (f) => CAPEX[f.value] },
  ],
  F4: [
    { key: "exploratory_unit", one: true, title: "Where new businesses sit", head: (f) => (f.form ? `${f.name ? f.name + ", " : ""}${FORM[f.form] || f.form}` : null) },
    { key: "autonomy_attributes", title: "Independence of that unit", head: (i) => PRETTY[i.attribute] || i.attribute },
    { key: "integration_attributes", title: "Links to the core business", head: (i) => PRETTY[i.attribute] || i.attribute },
    { key: "recent_changes", title: "Recent changes to the structure", head: (i) => `${i.description}${i.date ? ` (${i.date})` : ""}` },
    { key: "centralization", one: true, title: "Decision making", head: (f) => (f.value ? cap(f.value) : null) },
    { key: "formalization", one: true, title: "Rules and procedures", head: (f) => (f.value ? `${cap(f.value)} formalisation` : null) },
    { key: "horizontal_coordination", one: true, title: "Coordination across teams", head: (f) => (f.value ? `${cap(f.value)} coordination` : null) },
    { key: "new_business_profitable", one: true, title: "New business profitability", head: (f) => (f.value === true ? "The new business is profitable" : f.value === false ? "The new business is not yet profitable" : null) },
    { key: "job_postings", title: "Job postings", kind: "job" },
  ],
};

const verified = (evs) => (Array.isArray(evs) ? evs : evs ? [evs] : []).filter((e) => e && e.verified);

// { F1: [{ title, kind, items: [{ key, head, evidence, label, priority, style }] }], ... }
export function reviewGroups(extraction) {
  const out = {};
  for (const [fw, fields] of Object.entries(FIELDS)) {
    const x = extraction[fw] || {};
    out[fw] = fields.map((f) => {
      const items = [];
      if (f.kind === "statement") {
        (x.statements || []).forEach((s, i) => { if (s && s.verified) items.push({ key: `${fw}|statements|${i}`, head: null, evidence: [s], label: s.label, priority: !!s.is_priority }); });
      } else if (f.one) {
        const node = x[f.key];
        const ev = verified(node?.evidence);
        const head = node && f.head(node);
        if (ev.length && head) items.push({ key: `${fw}|${f.key}`, head, evidence: ev });
      } else {
        (x[f.key] || []).forEach((it, i) => {
          const ev = verified(it?.evidence);
          if (!ev.length) return;
          items.push({ key: `${fw}|${f.key}|${i}`, head: f.kind === "job" ? it.title : f.head(it), evidence: ev, style: f.kind === "job" ? it.style : undefined });
        });
      }
      return { title: f.title, kind: f.kind || "item", items };
    }).filter((g) => g.items.length);
  }
  return out;
}

export const emptyReview = () => ({ off: {}, label: {}, style: {} });

export function applyReview(extraction, review) {
  const x = JSON.parse(JSON.stringify(extraction));
  const nodeAt = (key) => key.split("|").reduce((n, k) => (n == null ? n : n[k]), x);
  for (const key of Object.keys(review.off).filter((k) => review.off[k])) {
    const node = nodeAt(key);
    if (!node) continue;
    if (key.includes("|statements|")) { node.verified = false; node.reason = "Left out by the user"; }
    else node.evidence = (Array.isArray(node.evidence) ? node.evidence : node.evidence ? [node.evidence] : []).map((e) => ({ ...e, verified: false, reason: "Left out by the user" }));
  }
  for (const [key, label] of Object.entries(review.label)) { const n = nodeAt(key); if (n) n.label = label; }
  for (const [key, style] of Object.entries(review.style)) { const n = nodeAt(key); if (n) n.style = style; }
  return x;
}
