import { PROMPTS } from "@/lib/prompts";
import { gemini, tavily, checkPasscode, isMock } from "@/lib/server";
import { mockSearch, mockWeb } from "@/lib/mock";

export const maxDuration = 60;

export async function POST(req) {
  const denied = checkPasscode(req);
  if (denied) return denied;
  try {
    const { queries } = await req.json();
    const qs = (queries || []).slice(0, 4);
    const results = [];
    const seen = new Set();
    for (const q of qs) {
      const rs = isMock() ? mockSearch(q) : await tavily(q);
      for (const r of rs) {
        if (seen.has(r.url)) continue;
        seen.add(r.url);
        results.push({ ...r, query: q });
      }
    }
    if (!results.length) return Response.json({ results: [], extraction: {} });
    if (isMock()) return Response.json({ results, extraction: mockWeb(results) });
    const prompt = results.map((r, i) => `=== W${i + 1} | ${r.url} | ${r.title} ===\n${r.content}`).join("\n\n");
    const { json } = await gemini({ system: PROMPTS.WEB, prompt });
    return Response.json({ results, extraction: json });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}
