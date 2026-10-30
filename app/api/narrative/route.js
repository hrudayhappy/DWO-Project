import { PROMPTS } from "@/lib/prompts";
import { gemini, checkPasscode, isMock } from "@/lib/server";

export const maxDuration = 60;

export async function POST(req) {
  const denied = checkPasscode(req);
  if (denied) return denied;
  try {
    const { summaryInput } = await req.json();
    if (isMock()) return Response.json({ summary: "This is a sample summary produced in test mode. With a Gemini key configured, the tool writes a three-paragraph summary of the four framework outputs and the diagnostic flags here." });
    const { json } = await gemini({ system: PROMPTS.NARRATIVE, prompt: JSON.stringify(summaryInput), maxOutputTokens: 1500 });
    return Response.json({ summary: json.summary || "" });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}
