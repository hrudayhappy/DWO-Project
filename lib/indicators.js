// Indicator definitions. These mirror Tables 2, 4, 6 and 8 and Appendix A of the report.
// `rule` is shown to the user in the Show Evidence view, so it is written in plain language.

export const FRAMEWORKS = [
  {
    id: "F1",
    short: "Environment",
    question: "What does the environment demand?",
    name: "Environmental Uncertainty",
    basis: "Duncan (1972); Daft and Uppal (2020)",
    colour: "blue",
  },
  {
    id: "F2",
    short: "Strategy",
    question: "What does management say?",
    name: "Miles and Snow Strategic Typology",
    basis: "Miles and Snow (1978)",
    colour: "orange",
  },
  {
    id: "F3",
    short: "Behaviour",
    question: "What does the company actually do?",
    name: "Exploration and Exploitation",
    basis: "March (1991)",
    colour: "green",
  },
  {
    id: "F4",
    short: "Structure",
    question: "Is the organization built for both?",
    name: "Mechanistic and Organic Design; Ambidextrous Approach",
    basis: "Daft and Uppal (2020); O'Reilly and Tushman (2004)",
    colour: "yellow",
  },
];

export const INDICATORS = {
  // ---------------- Framework 1 ----------------
  C1: {
    fw: "F1", group: "Environmental complexity", name: "Product and technology scope",
    definition: "Number of vehicle segments and powertrain technologies in the portfolio",
    rule: "Count of segments plus powertrains, minus one. 1 → rating 1; 2 → 2; 3–4 → 3; 5 → 4; 6 or more → 5.",
  },
  C2: {
    fw: "F1", group: "Environmental complexity", name: "Geographic scope",
    definition: "Proportion of volumes exported and number of international markets served",
    rule: "Higher of two ratings. Exports: below 5% → 1; 5–10% → 2; 10–25% → 3; above 25% → 5. Markets: below 10 → 1; 10–20 → 2; 20–60 → 3; 60–100 → 4; more than 100 → 5.",
  },
  C3: {
    fw: "F1", group: "Environmental complexity", name: "Breadth of external dependencies",
    definition: "Number of distinct categories of external risk disclosed",
    rule: "3 or fewer → 1; 4 → 2; 5–6 → 3; 7 → 4; 8 or more → 5.",
  },
  U1: {
    fw: "F1", group: "Environmental change", name: "Pace of technological change",
    definition: "Growth of electric-vehicle sales in the industry and the firm's own share of electric vehicles",
    rule: "Average of an industry rating (EV growth below 10% → 1; 10–25% → 2; 25–50% → 3; above 50% → 5) and a firm rating (EV share below 2% → 1; 2–10% → 2; 10–20% → 3; 20–30% → 4; above 30% → 5).",
  },
  U2: {
    fw: "F1", group: "Environmental change", name: "Regulatory change",
    definition: "Material policy changes in the preceding two years",
    rule: "0–1 changes → 1; 2–3 → 3; 4 or more → 5.",
  },
  U3: {
    fw: "F1", group: "Environmental change", name: "External disruptions",
    definition: "Disruptions reported by the firm during the year",
    rule: "None → 1; 1–2 → 3; 3 or more → 5.",
  },

  // ---------------- Framework 2 ----------------
  S1: {
    fw: "F2", name: "Exploratory intent",
    definition: "Statements committing the firm to new products, technologies or markets",
    rule: "Each statement classified as exploratory or both counts towards the exploratory share, so the two shares can total more than 100%.",
  },
  S2: {
    fw: "F2", name: "Exploitative intent",
    definition: "Statements emphasising efficiency, margins or defence of existing positions",
    rule: "Each statement classified as exploitative or both counts towards the exploitative share.",
  },
  S3: {
    fw: "F2", name: "Declared priorities",
    definition: "Strategic priorities set out by the firm for the coming year",
    rule: "Priorities are classified in the same way as other statements of intent.",
  },
  S4: {
    fw: "F2", name: "Strategic consistency",
    definition: "Consistency of the strategic narrative across the annual report, investor presentation and earnings call",
    rule: "Two or more unexplained contradictions across documents, or fewer than five statements in total, indicate a Reactor.",
  },

  // ---------------- Framework 3 ----------------
  X1: {
    fw: "F3", group: "Exploration", name: "Research and development intensity",
    definition: "Research and development expenditure as a percentage of revenue",
    rule: "Below 1% → 1; 1–2% → 2; 2–3.5% → 3; 3.5–5% → 4; above 5% → 5.",
  },
  X2: {
    fw: "F3", group: "Exploration", name: "New-to-firm products and markets",
    definition: "Products, technologies or markets new to the firm, excluding refreshes",
    rule: "None → 1; 1–2 → 3; 3 → 4; 4 or more → 5.",
  },
  X3: {
    fw: "F3", group: "Exploration", name: "Revenue from new businesses",
    definition: "Share of revenue or volume from new businesses such as electric vehicles",
    rule: "Below 2% → 1; 2–5% → 2; 5–15% → 3; 15–30% → 4; above 30% → 5.",
  },
  X4: {
    fw: "F3", group: "Exploration", name: "Investment in new capabilities",
    definition: "Acquisitions, new subsidiaries and technology partnerships for new capabilities",
    rule: "None → 1; one investment → 3; several investments, or one major investment → 5.",
  },
  Y1: {
    fw: "F3", group: "Exploitation", name: "Efficiency programmes",
    definition: "Formal programmes for cost reduction or productivity improvement",
    rule: "None → 1; a formal programme → 3; a programme with quantified savings or named as a strategic priority → 5.",
  },
  Y2: {
    fw: "F3", group: "Exploitation", name: "Capacity investment in existing products",
    definition: "Capital expenditure directed at expanding capacity for current models",
    rule: "Share of capital expenditure spent on capacity for current models: little → 1; a moderate share → 3; most of it → 5. Spending on new technologies is counted under investment in new capabilities.",
  },
  Y3: {
    fw: "F3", group: "Exploitation", name: "Incremental product development",
    definition: "Facelifts, variants and refreshes of existing models",
    rule: "0–1 → 1; 2 → 2; 3–5 → 3; 6–7 → 4; 8 or more → 5.",
  },
  Y4: {
    fw: "F3", group: "Exploitation", name: "Shareholder distributions",
    definition: "Dividends and share buybacks as a percentage of profit after tax",
    rule: "Below 15% → 1; 15–30% → 2; 30–50% → 3; 50–75% → 4; above 75% → 5.",
  },

  // ---------------- Framework 4 ----------------
  A1: {
    fw: "F4", group: "Ambidextrous design", name: "Structural separation",
    definition: "A subsidiary, division or business unit dedicated to new businesses",
    rule: "None or only a programme → 1; a dedicated business unit → 3; a separate subsidiary → 5.",
  },
  A2: {
    fw: "F4", group: "Ambidextrous design", name: "Autonomy of the exploratory unit",
    definition: "Separate legal entity, own leader, own brand or channel, own profit and loss, external investors",
    rule: "0–1 attributes present → 1; 2–3 → 3; 4–5 → 5.",
  },
  A3: {
    fw: "F4", group: "Ambidextrous design", name: "Senior-level integration",
    definition: "Common or reporting chief executive, shared directors, shared platforms or supply base, inclusion in group priorities",
    rule: "No attribute present → 1; 1–2 → 3; 3–4 → 5.",
  },
  A4: {
    fw: "F4", group: "Ambidextrous design", name: "Recent structural change",
    definition: "Units created, spun off or reintegrated in the preceding two years",
    rule: "Recorded descriptively, not rated. A reintegration triggers the maturity check.",
  },
  B1: {
    fw: "F4", group: "Design of the core organization", name: "Centralization",
    definition: "Whether decisions are reserved for top management or delegated to business-unit heads",
    rule: "Decentralised → 1; mixed → 3; centralised → 5.",
  },
  B2: {
    fw: "F4", group: "Design of the core organization", name: "Formalization",
    definition: "Reliance on written rules and standard procedures",
    rule: "Low → 1; moderate → 3; high → 5.",
  },
  B3: {
    fw: "F4", group: "Design of the core organization", name: "Horizontal coordination",
    definition: "Use of cross-functional teams and flatter structures",
    rule: "Strong → 1; some → 3; weak → 5 (a higher rating means more mechanistic).",
  },
  B4: {
    fw: "F4", group: "Design of the core organization", name: "Role design in job postings",
    definition: "Share of job postings written in organic rather than mechanistic language",
    rule: "Organic share above 70% → 1; 55–70% → 2; 45–55% → 3; 30–45% → 4; below 30% → 5.",
  },
};

export const DOC_LABELS = {
  AR: "Annual report",
  IP: "Investor presentation",
  EC: "Earnings-call transcript",
  IND: "Industry report",
  WEB: "Web search",
  USER: "Confirmed by user",
};

export const EVIDENCE_TYPES = {
  fact: "Fact",
  company_claim: "Company claim",
  third_party: "Third-party claim",
  inference: "Inference",
};
