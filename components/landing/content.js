// Words for the three regions of the balance line. Colours match THEMES in scenes.js.
export const REGIMES = [
  {
    key: "explore",
    zone: "Failure trap",
    name: "Exploration · organic design",
    joiner: "or", mark: "?",
    verdict: ["Failure trap.", "Endless search, and little of it is ever put to use."],
    colors: { field: "#6a1e2c", accent: "#ff8a76", ink: "#3a1218" },
    scenes: [
      ["E1", "Structure", "Organic design", "One flat level. Every department talks to every other and to the CEO directly, so information moves fast and in every direction."],
      ["E2", "Focus", "R&D and growth", "Scientists in coats and goggles at the bench. Most money and attention go into new products, and growth follows."],
      ["E3", "The catch", "High costs, high waste", "Most of the cost goes to R&D, and the line throws out a pile of rejects. Efficiency is low."],
    ],
  },
  {
    key: "ambi",
    zone: "Ambidextrous",
    name: "Ambidextrous · both, on purpose",
    joiner: "and", mark: ".",
    verdict: ["Ambidextrous.", "A steady core and a free-roaming frontier, joined at the top."],
    colors: { field: "#0f4d3e", accent: "#6ff0bf", ink: "#123a30" },
    scenes: [
      ["A1", "Structure", "One company, two designs", "The company stands in the middle. On its left an organic unit decides quickly in a flat circle; on its right a mechanistic unit runs five levels deep."],
      ["A2", "Focus", "One budget, two engines", "R&D and manufacturing run in parallel, and the budget flows equally to both."],
    ],
  },
  {
    key: "exploit",
    zone: "Success trap",
    name: "Exploitation · mechanistic design",
    joiner: "or", mark: "?",
    verdict: ["Success trap.", "Refining what already works while the market moves on."],
    colors: { field: "#14306b", accent: "#8fd0ff", ink: "#101e40" },
    scenes: [
      ["X1", "Structure", "Mechanistic design", "The tower rises beside its five-level hierarchy. Reports climb slowly, level by level, and instructions come back down."],
      ["X2", "Focus", "Efficiency", "Identical units at a steady rhythm. Costs are low and almost nothing is wasted."],
      ["X3", "The catch", "Ideas parked halfway", "Cost savings climb quickly to the top. The R&D idea stalls halfway and is parked for the future."],
    ],
  },
];

// The ambidextrous band runs from 40% to 60% of the line.
export const zoneOf = (v) => (v < 0.4 ? 0 : v <= 0.6 ? 1 : 2);
export const ZONE_CENTRES = [0.18, 0.5, 0.82];
