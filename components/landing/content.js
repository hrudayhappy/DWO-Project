// Words for the three regions of the balance line. Each region answers the same three questions:
// how the organisation is structured, how work moves through it, and where that leads.
export const REGIMES = [
  {
    key: "explore",
    zone: "Failure trap",
    zoneNote: "All search, little payoff",
    name: "Exploration",
    joiner: "or", mark: "?",
    verdict: ["Failure trap.", "Endless search, and little of it is ever put to use."],
    cards: [
      { code: "E1", kind: "Structure", title: "A flat network of teams", bullets: [["Cross-functional teams", 2.0], ["Talk sideways, not up", 3.4], ["Decisions where the knowledge is", 4.0]] },
      { code: "E2", kind: "How work moves", title: "Many experiments, few winners", bullets: [["Try many things at once", 2.0], ["Most fail, and that's expected", 4.0], ["Returns are uncertain and late", 5.4]] },
      { code: "E3", kind: "Where it leads", title: "The search never ends", bullets: [["Ideas dropped before they mature", 2.6], ["Costs keep rising", 5.4], ["Nothing reaches scale", 6.4]] },
    ],
  },
  {
    key: "ambi",
    zone: "Ambidextrous",
    zoneNote: "Both, in separate units",
    name: "Ambidextrous",
    joiner: "and", mark: ".",
    verdict: ["Ambidextrous.", "Both at full strength, in separate units, held together at the top."],
    cards: [
      { code: "A1", kind: "Structure", title: "Two units, one top team", bullets: [["Senior team holds both together", 2.0], ["Organic unit explores", 2.4], ["Mechanistic unit runs the core", 2.8]] },
      { code: "A2", kind: "How work moves", title: "Each side works its own way", bullets: [["Different rules for different work", 2.2], ["Top team sets the split", 3.0], ["New unit protected from the core", 3.6]] },
      { code: "A3", kind: "Where it leads", title: "Ideas graduate to the core", bullets: [["Today's profits fund tomorrow's bets", 2.8], ["Proven ideas move to the core", 6.6], ["Ready when the market moves", 7.4]] },
    ],
  },
  {
    key: "exploit",
    zone: "Success trap",
    zoneNote: "All efficiency, no renewal",
    name: "Exploitation",
    joiner: "or", mark: "?",
    verdict: ["Success trap.", "Better and better at yesterday's business while the market moves on."],
    cards: [
      { code: "X1", kind: "Structure", title: "Tall hierarchy, separate silos", bullets: [["Many levels, narrow spans", 1.8], ["Decisions made at the top", 2.2], ["To reach another team: up and back down", 3.2]] },
      { code: "X2", kind: "How work moves", title: "One route, one rulebook", bullets: [["Narrow, specialised roles", 1.8], ["Written rules and procedures", 2.4], ["Same route, same time, low cost per task", 3.4]] },
      { code: "X3", kind: "Where it leads", title: "Better at yesterday's business", bullets: [["Quick, certain returns win", 2.6], ["New ideas stall in the layers", 4.8], ["The market moves on", 6.4]] },
    ],
  },
];

// The ambidextrous band runs from 40% to 60% of the line.
export const zoneOf = (v) => (v < 0.4 ? 0 : v <= 0.6 ? 1 : 2);
export const ZONE_CENTRES = [0.17, 0.5, 0.83];
