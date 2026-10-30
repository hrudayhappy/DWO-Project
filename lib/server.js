// Server-side helpers: Gemini and Tavily calls, passcode check, mock mode for testing.
// API keys are read from environment variables and never sent to the browser.

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3-flash-preview", "gemini-2.5-flash-lite", "gemini-2.5-flash"];
let workingModel = null;

export function checkPasscode(req) {
  const required = process.env.APP_PASSCODE;
  if (!required) return null;
  const given = req.headers.get("x-app-passcode") || "";
  if (given !== required) return Response.json({ error: "The access code is missing or incorrect." }, { status: 401 });
  return null;
}

export const isMock = () => process.env.MOCK_AI === "1";

function parseJson(text) {
  let t = String(text || "").trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  try { return JSON.parse(t); } catch {}
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a !== -1 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch {} }
  throw new Error("The AI response was not valid JSON.");
}

export async function gemini({ system, prompt, maxOutputTokens = 8192 }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set on the server.");
  const configured = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : [];
  const candidates = [...new Set([workingModel, ...configured, ...FALLBACK_MODELS].filter(Boolean))];
  let lastErr = null;
  for (const model of candidates) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens, responseMimeType: "application/json" },
        }),
      });
      if (res.status === 404 || res.status === 400 || res.status === 403) {
        const body = await res.text();
        const modelProblem = res.status === 404 || /model|not found|not supported|unsupported|permission/i.test(body);
        if (res.status === 400 && /api key/i.test(body)) throw new Error("The Gemini API key was rejected. Check GEMINI_API_KEY in the hosting settings.");
        if (!modelProblem) throw new Error(`Gemini rejected the request (${res.status}): ${body.slice(0, 200)}`);
        lastErr = new Error(`Model ${model} unavailable (${res.status}): ${body.slice(0, 200)}`);
        break; // try the next model
      }
      if (res.status === 429 || res.status === 503) {
        lastErr = new Error(`Model ${model} is busy or the free-tier limit was reached (${res.status}).`);
        await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`Gemini error ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = await res.json();
      const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
      workingModel = model;
      return { json: parseJson(text), model };
    }
  }
  throw lastErr || new Error("No Gemini model could be reached.");
}

export async function tavily(query) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("TAVILY_API_KEY is not set on the server.");
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query, max_results: 5, search_depth: "basic", include_answer: false }),
  });
  if (!res.ok) throw new Error(`Tavily error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data.results || []).map((r) => ({ title: r.title, url: r.url, content: r.content || "" }));
}
