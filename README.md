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
2. The PDFs are read **in the browser**. Fixed keyword rules locate the pages each framework needs.
3. Google Gemini reads only those pages and returns evidence cards (quotation, document, page).
4. Every quotation is checked against the cited page; cards that fail are discarded.
5. Missing inputs, such as job postings and recent reorganizations, are searched on the web with Tavily.
6. The user confirms the key figures (revenue, R&D, profit, payouts).
7. Fixed rules rate every indicator, compute the four framework outputs and apply the diagnostic rules. (AI never decides a score)
8. Results show each framework's output, the misfit flags with design options, and a Show Evidence view for every indicator.
