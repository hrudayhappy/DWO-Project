export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json({
    gemini: Boolean(process.env.GEMINI_API_KEY),
    tavily: Boolean(process.env.TAVILY_API_KEY),
    passcodeRequired: Boolean(process.env.APP_PASSCODE),
    mock: process.env.MOCK_AI === "1",
  });
}
