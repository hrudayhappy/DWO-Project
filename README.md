# Ambidexterity Analyzer

A web application that diagnoses how well an organization balances exploration and exploitation, using a company's public documents and four organization-theory frameworks:

| Dimension | Framework | Course class |
|---|---|---|
| What does the environment demand? | Environmental Uncertainty (Duncan, 1972; Daft and Uppal, 2020) | Environment and Strategy |
| What does management say? | Miles and Snow strategic typology (1978) | Environment and Strategy |
| What does the company actually do? | Exploration and Exploitation (March, 1991) | Learning |
| Is the organization built for both? | Mechanistic vs organic design; ambidextrous approach (Daft and Uppal, 2020; O'Reilly and Tushman, 2004) | Structure |

Group project for Designing Work Organisations, IIM Lucknow.

## How it works

1. The user uploads the annual report (required), investor presentation and earnings-call transcript (optional) and names the company.
2. The PDFs are read **in the browser**. Fixed keyword rules (`lib/sections.js`) locate the pages each framework needs.
3. Google Gemini reads only those pages and returns evidence cards (quotation, document, page). Prompts are in `lib/prompts.js`.
4. Every quotation is checked against the cited page (`lib/verify.js`); cards that fail are discarded.
5. Missing inputs, such as job postings and recent reorganizations, are searched on the web with Tavily.
6. The user confirms the key figures (revenue, R&D, profit, payouts).
7. Fixed rules (`lib/engine.js`) rate every indicator, compute the four framework outputs and apply the diagnostic rules. **AI never decides a score.**
8. Results show each framework's output, the misfit flags with design options, and a Show Evidence view for every indicator.

Industry-level indicators come from `lib/industryProfile.js` (IBEF Automobiles Industry Report, May 2026). To use the tool for another industry, add a new profile there; the rules stay the same.

## Put it online (about 10 minutes, free)

You need a GitHub account (the code lives in this repository), a Gemini API key from Google AI Studio and a Tavily API key.

1. Go to **vercel.com** and choose **Sign up** → **Continue with GitHub**. Pick the free *Hobby* plan.
2. On the Vercel dashboard choose **Add New… → Project**, find this repository (`DWO-Project`) and click **Import**.
3. Before clicking Deploy, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `GEMINI_API_KEY` | your Gemini key |
   | `TAVILY_API_KEY` | your Tavily key |
   | `APP_PASSCODE` | *(optional but recommended)* a short code, e.g. `dwo2026`. Anyone using the app must enter it, which protects your free API quota. |
   | `GEMINI_MODEL` | *(optional)* a specific model name. If left out, the app tries `gemini-3.5-flash-lite` first and falls back to other free models automatically. |

4. Click **Deploy**. After a minute or two Vercel shows a link like `https://dwo-project.vercel.app`. That is the link to share.
5. Every time new code is pushed to this repository, Vercel redeploys automatically.

To change a key later: Vercel → your project → **Settings → Environment Variables**, edit, then **Deployments → ⋯ → Redeploy**.

## Run it on your own computer (optional)

```bash
npm install
echo "GEMINI_API_KEY=your-key" >> .env.local
echo "TAVILY_API_KEY=your-key" >> .env.local
npm run dev
```

Then open http://localhost:3000. Setting `MOCK_AI=1` in `.env.local` runs the whole flow with simulated AI responses, which is useful for testing without using the API quota.

## Testing the rules

`node scripts/test-engine.mjs` runs the diagnosis engine on four scenarios (exploitation-heavy firm with no exploratory unit, separate EV subsidiary, reintegration after maturity, and an empty-evidence stress test).
