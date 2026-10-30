import { PROMPTS, formatPages, formatContext } from "@/lib/prompts";
import { gemini, checkPasscode, isMock } from "@/lib/server";
import { mockExtract } from "@/lib/mock";

export const maxDuration = 60;

export async function POST(req) {
  const denied = checkPasscode(req);
  if (denied) return denied;
  try {
    const { framework, pages, context } = await req.json();
    if (!PROMPTS[framework]) return Response.json({ error: "Unknown framework." }, { status: 400 });
    if (!Array.isArray(pages) || pages.length === 0) return Response.json({ result: {}, note: "No relevant pages found." });
    if (isMock()) return Response.json({ result: mockExtract(framework, pages), model: "mock" });
    const prompt = `${formatContext(context || {})}\n\nDOCUMENT PAGES:\n\n${formatPages(pages)}`;
    const { json, model } = await gemini({ system: PROMPTS[framework], prompt });
    return Response.json({ result: json, model });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}
