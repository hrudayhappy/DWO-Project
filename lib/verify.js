// Quote verification: every evidence card must point to text that actually appears on
// the cited page (or in the cited web result). Cards that fail are discarded.

export function normalise(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/[^a-z0-9%₹.,'"\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(s) {
  return normalise(s).replace(/[.,'"]/g, " ").split(" ").filter(Boolean);
}

// Returns true when the quote is found verbatim, or when most of its word sequence is
// present (PDF text extraction often reorders table cells and breaks lines).
export function quoteMatches(quote, pageText) {
  const q = normalise(quote);
  if (!q || q.length < 4) return false;
  const p = normalise(pageText);
  if (p.includes(q)) return true;
  const qw = words(quote);
  const pw = words(pageText);
  if (qw.length === 0) return false;
  if (qw.length <= 3) return qw.every((w) => pw.includes(w));
  // share of quote trigrams present in the page
  const grams = new Set();
  for (let i = 0; i + 2 < pw.length; i++) grams.add(pw[i] + " " + pw[i + 1] + " " + pw[i + 2]);
  let hit = 0, total = 0;
  for (let i = 0; i + 2 < qw.length; i++) {
    total++;
    if (grams.has(qw[i] + " " + qw[i + 1] + " " + qw[i + 2])) hit++;
  }
  if (total === 0) return false;
  if (hit / total >= 0.6) return true;
  // fall back to word coverage for short or table-like quotes
  const pset = new Set(pw);
  const cover = qw.filter((w) => pset.has(w)).length / qw.length;
  return cover >= 0.85 && qw.length <= 12;
}

// lookup: function (doc, page) -> text | null ; for web evidence, page is the URL
export function verifyEvidence(ev, lookup) {
  if (!ev || !ev.quote) return { ...ev, verified: false, reason: "No quotation supplied" };
  if (ev.doc === "IND" || ev.doc === "USER") return { ...ev, verified: true };
  const text = lookup(ev.doc, ev.doc === "WEB" ? ev.url : Number(ev.page));
  if (text == null) {
    // the model may cite a neighbouring page number; try adjacent pages
    if (ev.doc !== "WEB") {
      for (const d of [-1, 1, -2, 2]) {
        const t = lookup(ev.doc, Number(ev.page) + d);
        if (t && quoteMatches(ev.quote, t)) return { ...ev, page: Number(ev.page) + d, verified: true };
      }
    }
    return { ...ev, verified: false, reason: "Cited page not found" };
  }
  if (quoteMatches(ev.quote, text)) return { ...ev, verified: true };
  if (ev.doc !== "WEB") {
    for (const d of [-1, 1]) {
      const t = lookup(ev.doc, Number(ev.page) + d);
      if (t && quoteMatches(ev.quote, t)) return { ...ev, page: Number(ev.page) + d, verified: true };
    }
  }
  return { ...ev, verified: false, reason: "Quotation not found on the cited page" };
}
