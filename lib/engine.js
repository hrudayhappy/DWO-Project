// Scoring and diagnosis engine. All judgements here are fixed rules taken from the
// report (Tables 3, 5, 7, 9 and 10 and Appendix A). No AI is involved in this file.

import { INDICATORS } from "./indicators.js";

const CONF_ORDER = ["insufficient", "low", "medium", "high"];

// ---------- helpers ----------
const verifiedOnly = (evs) => (Array.isArray(evs) ? evs : evs ? [evs] : []).filter((e) => e && e.verified);
const sourceKey = (e) => (e.doc === "WEB" ? "WEB:" + (e.url || "") : e.doc);

function confidenceOf(evidence, { contradiction = false } = {}) {
  const evs = verifiedOnly(evidence);
  if (evs.length === 0) return "insufficient";
  if (contradiction) return "low";
  if (evs.every((e) => e.type === "inference")) return "low";
  const sources = new Set(evs.map(sourceKey));
  return sources.size >= 2 ? "high" : "medium";
}
const minConfidence = (list) => {
  const valid = list.filter(Boolean);
  if (!valid.length) return "insufficient";
  return valid.reduce((a, b) => (CONF_ORDER.indexOf(a) <= CONF_ORDER.indexOf(b) ? a : b));
};
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
const num = (v) => {
  if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
  const n = Number(String(v).replace(/[,₹%\s]/g, ""));
  return isNaN(n) ? null : n;
};

function band(value, cuts) {
  // cuts: array of [upperBoundExclusive, score]; last entry catches the rest
  for (const [ub, s] of cuts) if (value < ub) return s;
  return cuts[cuts.length - 1][1];
}

function listEvidence(items) {
  return (items || []).flatMap((i) => verifiedOnly(i.evidence));
}
function keepVerified(items) {
  return (items || []).filter((i) => verifiedOnly(i.evidence).length > 0);
}
function valueField(f) {
  if (!f || num(f.value) === null) return null;
  const ev = verifiedOnly(f.evidence);
  if (!ev.length) return null;
  return { value: num(f.value), evidence: ev, basis: f.basis };
}
function enumField(f, allowed) {
  if (!f || !allowed.includes(f.value)) return null;
  const ev = verifiedOnly(f.evidence);
  if (!ev.length) return null;
  return { value: f.value, evidence: ev };
}

function ind(id, score, { value = "", items = [], evidence = [], note = "", confidence } = {}) {
  const conf = score == null && confidence === undefined ? "insufficient" : confidence || confidenceOf(evidence);
  return { id, ...INDICATORS[id], score: score == null ? null : round1(score), value, items, evidence: verifiedOnly(evidence), confidence: score == null ? confidence || "insufficient" : conf, note };
}

// Framework-level 60 per cent rule
function enoughEvidence(indicators) {
  const rated = indicators.filter((i) => i.score != null && ["medium", "high"].includes(i.confidence));
  return indicators.length > 0 && rated.length / indicators.length >= 0.6;
}

// ---------- Framework 1 ----------
function framework1(x, profile) {
  const segs = keepVerified(x.segments);
  const pts = keepVerified(x.powertrains);
  let C1;
  if (segs.length + pts.length === 0) C1 = ind("C1", null);
  else {
    const n = Math.max(1, segs.length + pts.length - 1);
    C1 = ind("C1", band(n, [[2, 1], [3, 2], [5, 3], [6, 4], [Infinity, 5]]), {
      value: `${segs.length} segment${segs.length === 1 ? "" : "s"}, ${pts.length} powertrain${pts.length === 1 ? "" : "s"}`,
      items: [...segs.map((s) => "Segment: " + s.name), ...pts.map((p) => "Powertrain: " + p.name)],
      evidence: [...listEvidence(segs), ...listEvidence(pts)],
    });
  }

  const exp = valueField(x.export_share_pct);
  const mkts = valueField(x.markets_served);
  let C2;
  if (!exp && !mkts) C2 = ind("C2", null);
  else {
    const s1 = exp ? band(exp.value, [[5, 1], [10, 2], [25, 3], [Infinity, 5]]) : 0;
    const s2 = mkts ? band(mkts.value, [[10, 1], [20, 2], [60, 3], [100, 4], [Infinity, 5]]) : 0;
    C2 = ind("C2", Math.max(s1, s2), {
      value: [exp ? `Exports ${exp.value}% of volume` : null, mkts ? `${mkts.value} markets` : null].filter(Boolean).join("; "),
      evidence: [...(exp?.evidence || []), ...(mkts?.evidence || [])],
    });
  }

  const risks = keepVerified(x.risk_categories);
  const distinctRisks = [...new Set(risks.map((r) => String(r.category).toLowerCase()))];
  const C3 = risks.length
    ? ind("C3", band(distinctRisks.length, [[4, 1], [5, 2], [7, 3], [8, 4], [Infinity, 5]]), {
        value: `${distinctRisks.length} risk categories`, items: distinctRisks, evidence: listEvidence(risks),
      })
    : ind("C3", null);

  const indRating = band(profile.evGrowth.value, [[10, 1], [25, 2], [50, 3], [Infinity, 5]]);
  const firmEv = valueField(x.firm_ev_share_pct);
  const firmRating = firmEv ? band(firmEv.value, [[2, 1], [10, 2], [20, 3], [30, 4], [Infinity, 5]]) : null;
  const U1 = ind("U1", firmRating == null ? indRating : (indRating + firmRating) / 2, {
    value: `Industry EV growth ${profile.evGrowth.value}% (rating ${indRating})` + (firmEv ? `; firm EV share ${firmEv.value}% (rating ${firmRating})` : "; firm EV share not found"),
    evidence: [...profile.evGrowth.evidence.map((e) => ({ ...e, verified: true })), ...(firmEv?.evidence || [])],
    note: firmEv ? "" : "Rated on the industry component only.",
  });

  const companyReg = keepVerified(x.regulatory_changes);
  const regCount = profile.regulatoryChanges.length;
  const U2 = ind("U2", band(regCount, [[2, 1], [4, 3], [Infinity, 5]]), {
    value: `${regCount} material changes in the industry profile`,
    items: [...profile.regulatoryChanges.map((r) => r.description), ...companyReg.map((r) => "Reported by the company: " + r.description)],
    evidence: [...profile.regulatoryChanges.map((r) => ({ ...r.evidence, verified: true })), ...listEvidence(companyReg)],
  });

  const dis = keepVerified(x.disruptions);
  const U3 = dis.length
    ? ind("U3", band(dis.length, [[1, 1], [3, 3], [Infinity, 5]]), {
        value: `${dis.length} disruptions reported`, items: dis.map((d) => d.description), evidence: listEvidence(dis),
      })
    : ind("U3", null);

  const complexityInd = [C1, C2, C3];
  const changeInd = [U1, U2, U3];
  const indicators = [...complexityInd, ...changeInd];
  const cScores = complexityInd.filter((i) => i.score != null).map((i) => i.score);
  const uScores = changeInd.filter((i) => i.score != null).map((i) => i.score);
  const ok = enoughEvidence(complexityInd) && enoughEvidence(changeInd);
  const complexity = round1(avg(cScores));
  const change = round1(avg(uScores));
  let quadrant = null, implication = "";
  if (ok) {
    const hiC = complexity >= 3, hiU = change >= 3;
    if (!hiC && !hiU) { quadrant = "Low"; implication = "Efficiency is rewarded and limited exploration is required."; }
    if (hiC && !hiU) { quadrant = "Low-moderate"; implication = "Efficiency remains primary, supported by selective exploration."; }
    if (!hiC && hiU) { quadrant = "Moderate-high"; implication = "Adaptability and sustained exploration are required."; }
    if (hiC && hiU) { quadrant = "High"; implication = "High levels of both exploration and exploitation are required, implying a need for ambidexterity."; }
  }
  return {
    id: "F1", status: ok ? "ok" : "insufficient", indicators,
    scores: { complexity, change },
    output: ok ? `${quadrant} uncertainty` : "Not enough evidence",
    quadrant, implication,
    rule: "Complexity and change are the averages of their indicators; below 3 is low, 3 or above is high (Table 3).",
    confidence: ok ? minConfidence(indicators.filter((i) => i.score != null).map((i) => i.confidence)) : "insufficient",
  };
}

// ---------- Framework 2 ----------
function framework2(x) {
  const st = (x.statements || []).filter((s) => s && s.verified && ["exploratory", "exploitative", "both", "neither"].includes(s.label));
  const classified = st.filter((s) => s.label !== "neither");
  const N = classified.length;
  const nExpl = classified.filter((s) => s.label === "exploratory" || s.label === "both").length;
  const nExpt = classified.filter((s) => s.label === "exploitative" || s.label === "both").length;
  const P = N ? nExpl / N : 0, D = N ? nExpt / N : 0;
  const contradictions = keepVerified(x.contradictions);
  const docs = new Set(st.map((s) => s.doc));

  const mk = (label) => st.filter((s) => s.label === label || (label !== "both" && s.label === "both"));
  const S1 = nExpl ? ind("S1", null, { value: `${nExpl} of ${N} statements (${Math.round(P * 100)}%)`, items: mk("exploratory").map((s) => s.quote), evidence: mk("exploratory"), confidence: confidenceOf(mk("exploratory")) }) : ind("S1", null);
  const S2 = nExpt ? ind("S2", null, { value: `${nExpt} of ${N} statements (${Math.round(D * 100)}%)`, items: mk("exploitative").map((s) => s.quote), evidence: mk("exploitative"), confidence: confidenceOf(mk("exploitative")) }) : ind("S2", null);
  const pri = st.filter((s) => s.is_priority);
  const S3 = ind("S3", null, { value: `${pri.length} declared priorities`, items: pri.map((s) => `${s.quote} (${s.label})`), evidence: pri, confidence: confidenceOf(pri) });
  const S4 = ind("S4", null, {
    value: contradictions.length ? `${contradictions.length} contradictions found` : `No contradictions found across ${docs.size} document(s)`,
    items: contradictions.map((c) => c.description), evidence: listEvidence(contradictions),
    confidence: docs.size >= 2 ? "high" : docs.size === 1 ? "medium" : "insufficient",
  });

  let type = "Indeterminate", rule = "No rule matched; reported with low confidence.";
  if (N < 5 || contradictions.length >= 2) { type = "Reactor"; rule = N < 5 ? "Fewer than five statements of strategic intent were identified." : "Two or more unexplained contradictions across documents."; }
  else if (P >= 0.6 && D < 0.3) { type = "Prospector"; rule = "Exploratory statements ≥ 60% and exploitative < 30%."; }
  else if (D >= 0.6 && P < 0.3) { type = "Defender"; rule = "Exploitative statements ≥ 60% and exploratory < 30%."; }
  else if (P >= 0.3 && D >= 0.3) { type = "Analyzer"; rule = "Exploratory and exploitative statements each ≥ 30%."; }

  const ok = st.length > 0;
  const conf = !ok ? "insufficient" : type === "Indeterminate" ? "low" : docs.size >= 2 ? (N >= 8 ? "high" : "medium") : "medium";
  return {
    id: "F2", status: ok ? "ok" : "insufficient", indicators: [S1, S2, S3, S4],
    scores: { exploratoryShare: Math.round(P * 100), exploitativeShare: Math.round(D * 100), statements: N },
    output: ok ? type : "Not enough evidence", type: ok ? type : null, rule,
    statements: st,
    confidence: !ok ? "insufficient" : type === "Reactor" && N < 5 ? "low" : conf,
  };
}

// ---------- Framework 3 ----------
function framework3(x, figures, parentTech = false) {
  const fig = (k) => (figures && num(figures[k]?.value) !== null ? figures[k] : null);
  const rev = fig("revenue"), rnd = fig("rnd"), pat = fig("pat"), div = fig("dividends"), buy = fig("buyback"), roy = fig("royalty");
  const evOf = (f) => (f ? (f.evidence && f.evidence.length ? f.evidence : [{ doc: "USER", quote: `Entered or confirmed by the user: ${f.value}`, type: "fact", verified: true }]) : []);

  let X1;
  if (rev && rnd && num(rev.value) > 0) {
    const pct = (num(rnd.value) / num(rev.value)) * 100;
    X1 = ind("X1", band(pct, [[1, 1], [2, 2], [3.5, 3], [5, 4], [Infinity, 5]]), {
      value: `${pct.toFixed(2)}% (₹${num(rnd.value).toLocaleString("en-IN")} crore of ₹${num(rev.value).toLocaleString("en-IN")} crore)`,
      evidence: [...evOf(rnd), ...evOf(rev)],
    });
  } else X1 = ind("X1", null);

  let parentFlag = null;
  if (roy && rnd && num(roy.value) > num(rnd.value)) {
    parentFlag = `Royalty or technology fees to the parent (₹${num(roy.value).toLocaleString("en-IN")} crore) exceed own R&D spend, so exploration is partly located at the parent. R&D intensity is shown for interpretation but excluded from the exploration score.`;
  } else if (parentTech) {
    parentFlag = "The company depends on a parent for much of its technology, so R&D intensity is shown for interpretation but excluded from the exploration score.";
  }
  if (parentFlag) X1.note = parentFlag;

  const ntf = keepVerified(x.new_to_firm);
  const X2 = ntf.length ? ind("X2", band(ntf.length, [[1, 1], [3, 3], [4, 4], [Infinity, 5]]), { value: `${ntf.length} new-to-firm items`, items: ntf.map((i) => i.item), evidence: listEvidence(ntf) }) : ind("X2", null);

  const nb = valueField(x.new_business_share_pct);
  const X3 = nb ? ind("X3", band(nb.value, [[2, 1], [5, 2], [15, 3], [30, 4], [Infinity, 5]]), { value: `${nb.value}% of ${nb.basis || "sales"}`, evidence: nb.evidence }) : ind("X3", null);

  const inv = keepVerified(x.new_capability_investments);
  const X4 = inv.length ? ind("X4", inv.length >= 2 || inv.some((i) => i.major) ? 5 : 3, { value: `${inv.length} investments`, items: inv.map((i) => i.item + (i.major ? " (major)" : "")), evidence: listEvidence(inv) }) : ind("X4", null);

  const eff = keepVerified(x.efficiency_programmes);
  const Y1 = eff.length ? ind("Y1", eff.some((e) => e.quantified || e.strategic_priority) ? 5 : 3, { value: `${eff.length} programmes`, items: eff.map((e) => e.item + (e.quantified ? " (quantified)" : "") + (e.strategic_priority ? " (strategic priority)" : "")), evidence: listEvidence(eff) }) : ind("Y1", null);

  const cap = enumField(x.capex_orientation, ["new_technology", "mixed", "existing_capacity"]);
  const Y2 = cap ? ind("Y2", { new_technology: 1, mixed: 3, existing_capacity: 5 }[cap.value], { value: { new_technology: "Little spent on capacity for current models", mixed: "Moderate share on current models", existing_capacity: "Mostly capacity for current models" }[cap.value], evidence: cap.evidence }) : ind("Y2", null);

  const inc = keepVerified(x.incremental_launches);
  const Y3 = inc.length ? ind("Y3", band(inc.length, [[2, 1], [3, 2], [6, 3], [8, 4], [Infinity, 5]]), { value: `${inc.length} refreshes or variants`, items: inc.map((i) => i.item), evidence: listEvidence(inc) }) : ind("Y3", null);

  let Y4;
  if (pat && num(pat.value) > 0 && (div || buy)) {
    const paid = (num(div?.value) || 0) + (num(buy?.value) || 0);
    const pct = (paid / num(pat.value)) * 100;
    Y4 = ind("Y4", band(pct, [[15, 1], [30, 2], [50, 3], [75, 4], [Infinity, 5]]), { value: `${pct.toFixed(0)}% of profit after tax`, evidence: [...evOf(div), ...evOf(buy), ...evOf(pat)] });
  } else Y4 = ind("Y4", null, { note: pat && num(pat.value) <= 0 ? "Profit after tax is zero or negative; payout ratio not meaningful." : "" });

  const X = parentFlag ? [X2, X3, X4] : [X1, X2, X3, X4], Y = [Y1, Y2, Y3, Y4];
  const ok = enoughEvidence(X) && enoughEvidence(Y);
  const XI = round1(avg(X.filter((i) => i.score != null).map((i) => i.score)));
  const YI = round1(avg(Y.filter((i) => i.score != null).map((i) => i.score)));
  let cls = null, meaning = "";
  if (ok) {
    const gap = XI - YI;
    if (XI >= 3.5 && YI >= 3.5 && Math.abs(gap) < 0.75) { cls = "Ambidextrous"; meaning = "The firm pursues both modes at a high level."; }
    else if (gap >= 0.75) { cls = "Exploration-oriented"; meaning = "Exposure to the failure trap if the core business is neglected."; }
    else if (-gap >= 0.75) { cls = "Exploitation-oriented"; meaning = "Exposure to the success trap if the environment is changing."; }
    else { cls = "Balanced at a modest level"; meaning = "Neither mode is pursued intensively."; }
  }
  return {
    id: "F3", status: ok ? "ok" : "insufficient", indicators: [X1, X2, X3, X4, ...Y],
    scores: { exploration: XI, exploitation: YI },
    output: ok ? cls : "Not enough evidence", classification: cls, meaning, parentFlag,
    rule: "Exploration and exploitation scores are the averages of their indicators, read together using Table 7.",
    confidence: ok ? minConfidence([...X, ...Y].filter((i) => i.score != null).map((i) => i.confidence)) : "insufficient",
  };
}

// ---------- Framework 4 ----------
function framework4(x, f3x) {
  const unit = x.exploratory_unit && verifiedOnly(x.exploratory_unit.evidence).length ? x.exploratory_unit : null;
  const form = unit?.form;
  const A1 = unit && ["none", "programme", "business_unit", "subsidiary"].includes(form)
    ? ind("A1", { none: 1, programme: 1, business_unit: 3, subsidiary: 5 }[form], { value: { none: "No dedicated unit", programme: "Programme only", business_unit: "Dedicated business unit", subsidiary: "Separate subsidiary" }[form] + (unit.name ? `: ${unit.name}` : ""), evidence: unit.evidence })
    : ind("A1", null);
  const unitExists = A1.score != null && A1.score >= 3;

  const aut = keepVerified(x.autonomy_attributes);
  const autSet = [...new Set(aut.map((a) => a.attribute))];
  const integ = keepVerified(x.integration_attributes);
  const intSet = [...new Set(integ.map((a) => a.attribute))];
  const A2 = !unitExists ? ind("A2", null, { note: "Not applicable: no separate exploratory unit identified." })
    : ind("A2", band(autSet.length, [[2, 1], [4, 3], [Infinity, 5]]), { value: `${autSet.length} of 5 attributes`, items: autSet.map(prettyAttr), evidence: listEvidence(aut), confidence: autSet.length ? undefined : "low" });
  const A3 = !unitExists ? ind("A3", null, { note: "Not applicable: no separate exploratory unit identified." })
    : ind("A3", band(intSet.length, [[1, 1], [3, 3], [Infinity, 5]]), { value: `${intSet.length} of 4 attributes`, items: intSet.map(prettyAttr), evidence: listEvidence(integ), confidence: intSet.length ? undefined : "low" });

  const changes = keepVerified(x.recent_changes);
  const reint = changes.filter((c) => c.direction === "reintegrated");
  const A4 = ind("A4", null, { value: changes.length ? `${changes.length} recent structural changes` : "None found", items: changes.map((c) => `${c.description}${c.date ? " (" + c.date + ")" : ""} – ${c.direction}`), evidence: listEvidence(changes), confidence: changes.length ? confidenceOf(listEvidence(changes)) : "insufficient" });

  const cen = enumField(x.centralization, ["decentralised", "mixed", "centralised"]);
  const B1 = cen ? ind("B1", { decentralised: 1, mixed: 3, centralised: 5 }[cen.value], { value: cap1(cen.value), evidence: cen.evidence }) : ind("B1", null);
  const frm = enumField(x.formalization, ["low", "moderate", "high"]);
  const B2 = frm ? ind("B2", { low: 1, moderate: 3, high: 5 }[frm.value], { value: cap1(frm.value), evidence: frm.evidence }) : ind("B2", null);
  const hc = enumField(x.horizontal_coordination, ["strong", "some", "weak"]);
  const B3 = hc ? ind("B3", { strong: 1, some: 3, weak: 5 }[hc.value], { value: cap1(hc.value), evidence: hc.evidence }) : ind("B3", null);
  const jobs = keepVerified(x.job_postings).filter((j) => ["organic", "mechanistic", "mixed"].includes(j.style));
  let B4;
  if (jobs.length >= 3) {
    const org = jobs.reduce((s, j) => s + (j.style === "organic" ? 1 : j.style === "mixed" ? 0.5 : 0), 0) / jobs.length * 100;
    B4 = ind("B4", band(100 - org, [[30, 1], [45, 2], [55, 3], [70, 4], [Infinity, 5]]), { value: `${org.toFixed(0)}% organic across ${jobs.length} postings`, items: jobs.map((j) => `${j.title || "Posting"} (${j.style})`), evidence: listEvidence(jobs) });
  } else B4 = ind("B4", null, { note: jobs.length ? `Only ${jobs.length} posting(s) found; at least three are needed.` : "" });

  const B = [B1, B2, B3, B4];
  const coreOk = enoughEvidence(B);
  const core = coreOk ? round1(avg(B.filter((i) => i.score != null).map((i) => i.score))) : null;
  const coreLabel = core == null ? "Not enough evidence" : core <= 2.5 ? "Organic" : core >= 3.5 ? "Mechanistic" : "Mixed";

  const aRated = unitExists ? [A1, A2, A3] : [A1];
  const designOk = A1.score != null && enoughEvidence(aRated);
  let mode = null, meaning = "";
  const autonomous = A2.score != null && A2.score >= 3;
  const integrated = A3.score != null && A3.score >= 3;
  const nbShare = num(f3x?.new_business_share_pct?.value);
  const profitable = x.new_business_profitable && verifiedOnly(x.new_business_profitable.evidence).length ? x.new_business_profitable.value : null;
  if (designOk || reint.length) {
    if (reint.length) {
      mode = "Sequential adjustment";
      meaning = nbShare != null && nbShare >= MATURITY_SHARE && profitable !== false
        ? `The exploratory business was reintegrated after reaching ${MATURITY_SHARE}% of sales, which is consistent with maturity${profitable === true ? " (profitability confirmed)" : " (profitability not disclosed)"}.`
        : "The exploratory business was reintegrated before maturity could be confirmed; the move may be premature.";
    } else if (unitExists && autonomous && integrated) { mode = "Structural ambidexterity"; meaning = "The design supports both modes."; }
    else if (unitExists && autonomous && !integrated) { mode = "Risk of isolation"; meaning = "The unit may be unable to draw on the resources of the core business."; }
    else if (unitExists && !autonomous) { mode = "Risk of constraint"; meaning = "Routines and controls of the core business may restrict the unit."; }
    else if (!unitExists && core != null && core <= 2.5) { mode = "Contextual ambidexterity"; meaning = "The same units balance both modes."; }
    else { mode = "No ambidextrous design"; meaning = "No structural provision protects exploration."; }
  }
  return {
    id: "F4", status: mode ? "ok" : "insufficient", indicators: [A1, A2, A3, A4, ...B],
    scores: { core, coreLabel }, unitExists,
    output: mode || "Not enough evidence", mode, meaning,
    rule: "The ambidextrous design indicators give the form of ambidexterity (Table 9); the core-design indicators give a score from 1 (organic) to 5 (mechanistic).",
    confidence: mode ? minConfidence([A1, ...(unitExists ? [A2, A3] : [])].filter((i) => i.score != null).map((i) => i.confidence)) : "insufficient",
  };
}
const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const ATTR = {
  separate_legal_entity: "Separate legal entity", own_leader: "Dedicated leader", own_brand_or_channel: "Own brand or channel", own_pnl: "Separate profit and loss", external_investors: "External investors",
  shared_ceo_or_reports_to_ceo: "Common chief executive or reports to the group CEO", shared_directors: "Shared directors", shared_platforms_or_supply: "Shared platforms or supply base", in_group_priorities: "Named in group priorities",
};
// Share of sales at which a reintegrated new business is treated as mature (adjustable parameter)
export const MATURITY_SHARE = 10;
const prettyAttr = (a) => ATTR[a.attribute] || a.attribute;

// ---------- diagnosis (Table 10) ----------
export const RECOMMENDATIONS = {
  "Exploration deficit": [
    { option: "Create a separate venture unit for new businesses", benefits: "Protects exploratory work from the efficiency targets and approval routines of the core business.", risks: "The unit may become isolated or duplicate core capabilities.", tradeoffs: "Speed and freedom for the new business against coordination cost and short-term profit dilution.", assumptions: "Leadership is willing to fund a unit whose returns are uncertain and distant." },
    { option: "Set aside a protected budget for new technologies within the core", benefits: "Uses existing capabilities, channels and brand while signalling commitment to exploration.", risks: "Core routines and quarterly targets may crowd out the protected budget over time.", tradeoffs: "Lower set-up cost against weaker protection from the core's priorities.", assumptions: "Senior management can shield the budget from short-term cost pressure." },
    { option: "Partner with or acquire a firm that already has the capability", benefits: "Gives faster access to technologies the firm does not yet possess.", risks: "Integration failure and cultural clash; dependence on an external partner.", tradeoffs: "Speed of entry against control and cost of acquisition.", assumptions: "Suitable partners or targets exist at an acceptable price." },
  ],
  "Exploration excess": [
    { option: "Prune the exploratory portfolio to the most promising bets", benefits: "Releases resources for the core business, which the environment rewards.", risks: "Cutting options that later become valuable.", tradeoffs: "Near-term efficiency against long-term optionality.", assumptions: "The environment is likely to remain stable." },
    { option: "Introduce stage-gate funding for new initiatives", benefits: "Ties continued funding to evidence of progress.", risks: "Formal gates can slow genuinely promising projects.", tradeoffs: "Discipline against speed.", assumptions: "Milestones for exploratory work can be defined credibly." },
  ],
  "Espoused–enacted gap": [
    { option: "Align resource allocation with the stated strategy", benefits: "Makes the stated strategy credible to investors and employees.", risks: "Higher spending on exploration may dilute margins in the short term.", tradeoffs: "Credibility of the strategy against short-term profitability.", assumptions: "Management genuinely intends to pursue the stated strategy." },
    { option: "Revise the stated strategy to reflect actual priorities", benefits: "Removes the credibility gap without changing operations.", risks: "Signals reduced ambition to the market.", tradeoffs: "Consistency against perceived growth prospects.", assumptions: "The current allocation suits the environment." },
    { option: "Set explicit exploration targets in top-management performance measures", benefits: "Links incentives to the stated strategy.", risks: "Targets may be gamed or met superficially.", tradeoffs: "Accountability against flexibility.", assumptions: "Exploratory outcomes can be measured meaningfully." },
  ],
  "Unsupported exploration": [
    { option: "Give exploratory activity a dedicated structure with its own leadership", benefits: "Makes exploration sustainable rather than dependent on individual champions.", risks: "Set-up cost and possible duplication.", tradeoffs: "Durability against cost and complexity.", assumptions: "Exploratory activity is large enough to justify a separate structure." },
    { option: "Build integrating roles or a senior steering group linking new and core businesses", benefits: "Coordinates resources without full separation.", risks: "Integrators may lack authority over the core.", tradeoffs: "Coordination against speed of decisions.", assumptions: "Senior managers can arbitrate between competing demands." },
  ],
  "Underused structure": [
    { option: "Strengthen the mandate and funding of the exploratory unit", benefits: "Converts structural provision into exploratory output.", risks: "Additional investment may not produce results.", tradeoffs: "Commitment against financial risk.", assumptions: "The unit has the capability to use additional resources." },
    { option: "Merge the unit back into the core if its purpose has lapsed", benefits: "Removes overhead and simplifies the structure.", risks: "Loss of the protected space for future exploration.", tradeoffs: "Simplicity against future optionality.", assumptions: "Exploration is no longer a priority for the environment the firm faces." },
  ],
  "Structural misfit": [
    { option: "Create separate exploratory units linked to senior management", benefits: "Applies the ambidextrous approach to a highly uncertain environment.", risks: "Coordination cost and possible conflict with the core.", tradeoffs: "Adaptability against efficiency.", assumptions: "Leadership can integrate separated units at the top." },
    { option: "Decentralise selected decisions and reduce formal approval layers", benefits: "Increases responsiveness of the core organization.", risks: "Loss of control and consistency in the core.", tradeoffs: "Speed against standardisation.", assumptions: "Managers below the top have the information and capability to decide." },
    { option: "Introduce cross-functional teams for new-product development", benefits: "Improves horizontal coordination without a full restructuring.", risks: "Matrix-type tensions over authority.", tradeoffs: "Coordination against clarity of reporting lines.", assumptions: "Functional heads will release staff to cross-functional work." },
  ],
};

const INTERNAL_CHECKS = {
  "Exploration deficit": "Internal budget allocation between new and existing businesses, and the targets applied to exploratory projects.",
  "Exploration excess": "Returns on exploratory projects to date and the pipeline of projects nearing commercialisation.",
  "Espoused–enacted gap": "Board-approved capital plans and how management incentives are linked to the stated strategy.",
  "Unsupported exploration": "Who owns exploratory initiatives, how they are funded and how they report.",
  "Underused structure": "The actual mandate, budget and staffing of the exploratory unit.",
  "Structural misfit": "Decision rights, approval layers and how quickly the core organization responds to change.",
};

function diagnose(F1, F2, F3, F4) {
  const flags = [];
  const add = (flag, compared, condition, meaning, frameworks) => {
    flags.push({ flag, compared, condition, meaning, confidence: minConfidence(frameworks.map((f) => f.confidence)), frameworks: frameworks.map((f) => f.id), recommendations: RECOMMENDATIONS[flag], internalCheck: INTERNAL_CHECKS[flag] });
  };
  const ok = (f) => f.status === "ok";
  const XI = F3.scores.exploration;
  if (ok(F1) && ok(F3)) {
    if (["High", "Moderate-high"].includes(F1.quadrant) && XI <= 2.5) add("Exploration deficit", "Environment and behaviour", `${F1.quadrant} uncertainty and an exploration score of 2.5 or below`, "Exposure to the success trap", [F1, F3]);
    if (F1.quadrant === "Low" && F3.classification === "Exploration-oriented") add("Exploration excess", "Environment and behaviour", "Low uncertainty and an exploration-oriented profile", "Resources committed to exploration that the environment does not reward", [F1, F3]);
  }
  if (ok(F2) && ok(F3) && ["Prospector", "Analyzer"].includes(F2.type) && F3.classification === "Exploitation-oriented")
    add("Espoused–enacted gap", "Stated strategy and behaviour", `${F2.type} strategy with an exploitation-oriented profile`, "Stated strategy is not reflected in resource allocation", [F2, F3]);
  if (ok(F2) && ok(F3) && F2.type === "Defender" && F3.classification === "Exploration-oriented")
    add("Espoused–enacted gap", "Stated strategy and behaviour", "Defender strategy with an exploration-oriented profile", "Resources are committed to exploration that the stated strategy does not acknowledge", [F2, F3]);
  if (ok(F3) && ok(F4)) {
    if (XI >= 3.5 && F4.mode === "No ambidextrous design") add("Unsupported exploration", "Behaviour and structure", "Exploration score of 3.5 or above without an ambidextrous design", "Exploratory activity lacks structural protection and may not be sustained", [F3, F4]);
    if (F4.unitExists && XI <= 2.5) add("Underused structure", "Behaviour and structure", "Separate exploratory unit with an exploration score of 2.5 or below", "Structural provision is not matched by exploratory activity", [F3, F4]);
  }
  if (ok(F1) && F4.scores.core != null && ["High", "Moderate-high"].includes(F1.quadrant) && F4.scores.core >= 3.5 && !F4.unitExists)
    add("Structural misfit", "Environment and structure", `${F1.quadrant} uncertainty, a mechanistic core and no separate exploratory unit`, "Organization design is inconsistent with environmental demands", [F1, F4]);

  const complete = [F1, F2, F3, F4].every(ok);
  let verdict;
  if (flags.length) verdict = `${flags.length} misfit${flags.length > 1 ? "s" : ""} identified`;
  else if (complete) verdict = "Fit: the four dimensions are consistent";
  else verdict = "Partial diagnosis: no misfit found among the dimensions with enough evidence";
  return { flags, verdict, complete };
}

// ---------- entry point ----------
export function runDiagnosis(extraction, figures, profile, { parentTech = false } = {}) {
  const F1 = framework1(extraction.F1 || {}, profile);
  const F2 = framework2(extraction.F2 || {});
  const F3 = framework3(extraction.F3 || {}, figures, parentTech);
  const F4 = framework4(extraction.F4 || {}, extraction.F3 || {});
  const d = diagnose(F1, F2, F3, F4);
  return { frameworks: { F1, F2, F3, F4 }, ...d };
}
