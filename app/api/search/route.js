import { webPrompt } from "@/lib/prompts";
import { gemini, tavily, checkPasscode, isMock } from "@/lib/server";
import { mockSearch, mockWeb } from "@/lib/mock";

export const maxDuration = 60;

// One round of web search for a handful of missing inputs: the searches run together, then a
// single AI call reads every result and fills the fields that were asked for.
export async function POST(req) {
  const denied = checkPasscode(req);
  if (denied) return denied;
  try {
    const { queries, fields, context } = await req.json();
    const qs = (queries || []).slice(0, 5).map((q) => (typeof q === "string" ? { q, deep: false } : q));
    const errors = [];
    const lists = await Promise.all(qs.map(({ q, deep }) => (isMock() ? Promise.resolve(mockSearch(q)) : tavily(q, { deep })).then(
      (rs) => rs.map((r) => ({ ...r, query: q })),
      (e) => { errors.push(e.message); return []; },
    )));
    const results = [];
    const seen = new Set();
    for (const r of lists.flat()) {
      if (!r.url || seen.has(r.url)) continue;
      seen.add(r.url);
      results.push(r);
    }
    if (!results.length) {
      if (errors.length === qs.length && errors.length) return Response.json({ error: errors[0] }, { status: 502 });
      return Response.json({ results: [], extraction: {} });
    }
    const wanted = (fields || []).filter(Boolean);
    if (isMock()) return Response.json({ results, extraction: mockWeb(results, wanted) });
    const prompt = results.map((r, i) => `=== W${i + 1} | ${r.url} | ${r.title} ===\n${r.content}`).join("\n\n");
    const { json } = await gemini({ system: webPrompt(wanted, context), prompt });
    return Response.json({ results, extraction: json });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}
