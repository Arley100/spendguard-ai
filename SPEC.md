# SpendGuard AI: Build Spec

**Status:** authoritative. This document is the agreement between Tom and the coding agent.
**Rule of the road:** every build step must map to a line in this spec. Anything not described here is scope creep and gets cut on sight. When in doubt, the agent stops and asks rather than adding.

---

## 0. Why this exists

This is a portfolio project, not a product and not a hackathon submission. There is no deadline. The single goal is to be the candidate who walks up to a Brim Financial hiring contact with a built, working thing that obviously understands their domain, instead of one of 300 applications.

Success is not breadth. Success is two features done beautifully, carrying data insights that almost nobody else who attempts this will find, presented so a non-technical finance manager grasps the value in five minutes. The Brim brief says this in its own words: depth and polish beat breadth.

The way to stand out is the opposite of cramming in features. It is fewer things, done with judgment, built on real findings in the data.

---

## 1. What we are building (one sentence)

A tool that loads a real anonymized SMB card statement, separates genuine merchant spending from account noise, lets a finance manager ask plain-English questions and get trustworthy answers, and turns the company's written expense policy into a live "where policy and reality diverge" view with a human-in-the-loop review queue.

---

## 2. Scope: build exactly this

**Foundation (built first, everything depends on it)**
- Load the provided spreadsheet into one local store (see Section 4).
- Classify every row as either **merchant spend** or **account activity** using the rules in the data contract. This classification is the backbone; do not skip it.

**Feature A: Talk to your data**
- A finance manager types a question in plain English. The system answers with the right visualization (chart, table, or short summary) plus a one or two sentence narration.
- Must handle follow-ups that reason across categories, time periods, and merchants without re-explaining context.
- Every number in the answer comes from a query against the store. The model never computes a figure. See Section 5.

**Feature B: Policy Reality Check and Risk Review**
- A "policy reality" panel that shows, with real counts, where the written policy and actual spending diverge (the headline being the $50 pre-authorization rule against the measured reality).
- A review queue that separates **documentation required** (normal-looking spend that the policy says needs a receipt or pre-auth) from **high-risk review** (duplicate-charge candidates and same-merchant same-day clusters), using tiered routing: low clears, medium asks for documentation, high routes to an approver.
- A **policy simulation** control: a threshold slider that recomputes flag counts live, so the user can see the tradeoff between catching risk and creating noise.

**Deliverables**
- The working app (runnable with one documented command).
- `README.md` (problem, the key insights, how to run, honest assumptions note).
- `ARCHITECTURE.md` (one diagram, a paragraph each on the layers).
- `ASSUMPTIONS.md` (what is real vs simulated; the truth rule; risk-not-accusation language).
- A 60 to 90 second screen recording. Script skeleton is in Section 10.

---

## 3. Anti-scope: do NOT build

This section does as much work as Section 2. The agent fills silence with scaffolding, so the silence is filled here on purpose.

- Do **not** add a second data source. One spreadsheet, one store.
- Do **not** introduce Postgres, MongoDB, Snowflake, S3, Docker, or Docker Compose.
- Do **not** build a data-source adapter layer with multiple implementations. One clean loading function is the seam; one implementation only.
- Do **not** build an AI-provider abstraction layer. One provider, called directly.
- Do **not** add authentication, user accounts, or roles.
- Do **not** build receipt matching or receipt OCR. There are no receipts in the data; faking the core of a feature is dishonest, not impressive.
- Do **not** create more than the three markdown docs listed in Section 2 plus the README.
- Do **not** add CI pipelines, Semgrep, Gitleaks, Playwright, test suites beyond a few unit tests on the classification and policy logic, or a SOC 2 / security checklist. This is a demo, and enterprise ceremony on a solo demo reads as junior, not rigorous.
- Do **not** make it a multi-package monorepo.
- Do **not** add a new dependency, framework, or runtime mid-build. If you believe one is needed, **stop and ask first.**
- Do **not** gold-plate. When a feature meets its acceptance criteria in Section 6, stop.

If a proposed change is not traceable to a line in Section 2 or 6, it is out.

---

## 4. Data contract (authoritative semantics)

These facts were established by inspecting the actual file. Treat them as ground truth. Do not re-derive, guess, or let the model infer the meaning of columns.

- The file is a card **account statement**, 4,235 rows, 14 columns, covering 2025-08-06 to 2026-03-27.
- **Amounts are already in CAD.** `Transaction Amount` is the posted CAD figure. `Conversion Rate` is the FX rate that was applied; `Transaction Amount / Conversion Rate` recovers the original foreign amount. Canadian (domestic) rows show `Conversion Rate = 0`, meaning no conversion. Sum `Transaction Amount` directly; do not multiply by the rate.
- **`Merchant Category Code` (MCC) presence is the discriminator.** A row with an MCC is a real **merchant purchase** (spend). A row with no MCC is **account activity**: card payments, fees, interest, or rewards redemptions. Account activity is NOT spend and must be excluded from spend totals.
- **`Debit or Credit`** distinguishes charges (Debit) from payments and refunds (Credit). The large `CWB EFT PAYMENT` rows are Credits: payments to the card, not expenses. There are 6 of them totaling roughly $1.18M. They must never appear in a spend figure.
- **`Transaction Code`** is a transaction-type code with 9 values (3001 dominates at 4,136 rows). It is NOT an employee, card, or department identifier.
- **There is no employee, department, budget, receipt, approval, or status field.** Any of these used in the product are **simulated** and must be labeled as such in the UI and in `ASSUMPTIONS.md`.
- **Merchant names are raw and messy** (store numbers, city, and state baked into the string). They must be normalized before any vendor grouping or consolidation view.
- **Dates only, no timestamps.** Same-day ordering is not available.
- **Real merchant spend is about $1,510,738.52 across 4,147 Debit-with-MCC rows.** Use this as the sanity check that the classification is correct.

Key MCCs present (for category mapping; this is a heavy-haul trucking fleet): 9399 government services (permits and government fees), 5541 and 5542 fuel, 4784 tolls and bridges, 7542 car washes, 5046 commercial equipment, 5533 auto parts, 4816 computer network and information services.

**Column reference**

| Column | Meaning | Use |
| --- | --- | --- |
| Transaction Code | Transaction-type code (9 values) | Do not treat as employee/card ID |
| Transaction Description | Raw merchant/line text | Display, parsing for normalization |
| Transaction Category | Internal category code | Low value without a key; prefer MCC |
| Posting date / Transaction Date | Dates only | Time-series grouping |
| Merchant Info DBA Name | Raw merchant name | Normalize before grouping |
| Transaction Amount | Posted amount in CAD | Sum directly for spend |
| Debit or Credit | Charge vs payment/refund | Spend = Debit only |
| Merchant Category Code | ISO MCC | Category backbone; presence = real purchase |
| Merchant City / Country / Postal / State | Location | Geography views, context |
| Conversion Rate | Applied FX (0 = domestic) | Informational; do not re-multiply amount |

---

## 5. The truth rule (non-negotiable)

**The store computes every dollar figure, count, total, trend, and flag. The model never produces a number.**

- The model's job is to read query results and explain, prioritize, narrate, and recommend in words.
- Every claim the model makes must be backed by a query result that is shown to the user as evidence (the rows or the aggregate that support it).
- The pattern is always: ask the store "calculate fuel spend by month," get the numbers back, then the model says "fuel spend rose 18% in Q4, driven by these three merchants; two charges below need a second look." The model never answers "how much did we spend on fuel" from its own head.
- This is the single most important reliability property of the project and is the first thing a finance reviewer will trust or distrust.
- The app must work with the model turned off. If no API key is present, structured queries and charts still run and narration falls back to deterministic templates, with the UI noting that AI narration is disabled. Because the numbers come from the store and not the model, this graceful degradation is a feature, not a patch: it is the reliability the truth rule buys, made visible.

---

## 6. Feature specs and acceptance criteria

### Feature A: Talk to your data

**Flow:** natural-language question, the system forms a query plan, the store executes it, the model narrates the result and the UI renders the fitting visualization.

**Behavior:**
- Handles aggregate questions ("what did we spend on fuel last quarter"), comparisons ("how does that compare to permits"), and follow-ups that keep prior context.
- Picks a sensible visualization: bar or line for comparisons and trends, table for itemized lists, a single number with one sentence for simple totals.
- Spend questions operate on merchant spend only (Debit-with-MCC), never on account activity, unless the user explicitly asks about payments or fees.

**Done when:**
- Three representative questions and one follow-up each return correct numbers (matching a hand-checked query) with a fitting visualization and a one or two sentence narration.
- Asking a spend question never includes CWB payments, fees, or redemptions in the figure.
- The narration contains no number that is absent from the underlying query result.

### Feature B: Policy Reality Check and Risk Review

**Policy reality panel.**
- States the relevant policy rules in plain language, sourced from the Brim policy: expenses over $50 require pre-authorization and a receipt; corporate cards may not be used for personal expenses; alcohol is not reimbursable unless dining with a customer; tips capped at 15 to 20%; traffic, parking tickets, and personal-use rentals are never reimbursed. Of these, only the $50 threshold (and, loosely, alcohol via merchant category) is cleanly checkable against the available transaction fields; the rest need receipts, guest names, or purchase intent the data does not contain. State all rules for context, but have the engine act on what is checkable and present the rest as "requires documentation" rather than pretending to verify them.
- Shows the measured reality against the headline rule: about 66% of merchant purchases (roughly 2,735 of 4,147 Debit-with-MCC rows) exceed $50, so the literal policy would require manager pre-auth on two-thirds of a fleet's transactions, which is the divergence worth surfacing. Compute this on merchant purchases, not the raw statement, so card fees and payments do not distort it.

**Review queue with tiered routing.**
- **Documentation required (medium):** normal-looking spend over the policy threshold. Low risk, but the policy wants a receipt or pre-auth on record.
- **High-risk review (high):** duplicate-charge candidates (identical merchant + amount + day) and same-merchant same-day clusters, computed on merchant purchases only (roughly 150 exact-duplicate groups and 595 clusters; recompute live). These are **candidates surfaced for human review with evidence, not accusations of fraud.** Critical domain nuance: for a trucking fleet, repeated permits, tolls, weigh-scales, and border crossings (MCC 9399 and 4784) are normal operational activity and dominate the raw duplicate signal, so down-rank them. Label this tier "High-Risk Review Candidates," never "high-risk transactions," and show a confidence caveat on each item: the dataset has no employee, card, or timestamp field, so some same-day repeats may be different drivers or trucks at one vendor. Only rank an item near the top if it passes a stricter test: same normalized merchant, same amount, same date, a non-operational MCC, with evidence rows visible. If nothing clears that bar, say so plainly; an honest "no strong candidates, here is what we checked" is more credible than a queue padded with normal activity. Surfacing hundreds of legitimate permit charges as suspicious is exactly the false-positive trap a naive tool falls into, and avoiding it is the point.
- **Cleared (low):** everything else, auto-cleared.
- Each queued item shows its evidence rows and a one-line model explanation of why it is here.

**Policy simulation control.**
- A threshold slider (for example $50 up to $500) that recomputes, live, how many transactions fall into "documentation required" at that threshold.
- Shows the tradeoff in words: raising the threshold cuts review noise but lets smaller items through.

**Done when:**
- The policy reality panel shows the correct measured percentage and count over $50.
- The queue correctly separates the three tiers, and every high-risk item displays its evidence rows.
- Moving the slider updates the counts without a page reload and the change is numerically correct.
- Nothing in the UI calls a transaction "fraud"; the language is "candidate," "needs review," "documentation required."

### Optional, only if Features A and B are fully polished: Expense Report Generation

A finance manager selects a scope (a date range, optionally narrowed to a category or merchant) and the system generates a report: grouped line items with per-category subtotals and a grand total, each line carrying its policy and risk status from Feature B (cleared, documentation required, or high-risk review), plus a short AI-written summary. The report is cleanly printable or exportable and has a "ready for approval" state.

Why this over pre-approval: it groups real transactions that exist in the data and reuses Feature B's engine, so it is honest and composes cleanly. Pre-approval would need simulated employees, budgets, and history; this does not.

Grounding and honesty: grouping is by period and category, because the dataset has no employee, trip, or department metadata. Label that plainly; do not invent trips or employees. All totals are computed deterministically (the truth rule); the AI writes only the summary. Do not add authentication or real approval routing (anti-scope); the approval state is a simple status, not a workflow.

**Done when:**
- Selecting a date range produces a report whose category subtotals and grand total match a hand-checked query.
- Every line shows its policy and risk status, reusing Feature B's logic rather than duplicating it.
- The AI summary contains no number absent from the computed report.
- The report is printable or exportable, and a label states the grouping basis and that employee and trip data are not in the dataset.

Do not start this until A and B meet every criterion above.

---

## 7. Design constraints

- The user is a non-technical finance manager. The brief's standard is "visualizations that clarify, not decorate."
- Fewer, load-bearing visuals. No wall of fifteen KPI tiles, no decorative donut charts. Every chart must answer a question someone would actually ask.
- Color carries meaning and nothing else: a neutral base, one accent reserved for AI-generated insight, green for cleared, amber for documentation required, red reserved strictly for high-risk review. If a color does not mean one of those, it is not used.
- Clean and calm, closer to a serious finance tool than a flashy dashboard.

---

## 8. Architecture (cheap signals only)

- **One app, one repo, one deploy target.** The thing that historically breaks these projects is infrastructure glue, not feature code, so minimize the surface that can fail.
- **Pick one stack up front and do not switch mid-build.** Recommended default, chosen for low glue and good UI: a single full-stack app (Next.js App Router) with server-side query routes, **SQLite** seeded from the spreadsheet at setup (DuckDB is an acceptable alternative if the agent prefers analytics ergonomics; pick one, not both), a charting library already common in that ecosystem, and the chosen AI provider called directly server-side. If Tom prefers a Python core, FastAPI plus SQLite or DuckDB serving a small frontend is acceptable, but still one deployable unit.
- **Separate `core/` from `demo/`.** Core holds the classification, policy logic, risk logic, and query layer. Demo holds the seed step and any simulated employee or budget data. The README states plainly which is which.
- **One data-loading seam.** A single function that reads the source into the store. This is the only nod to future swappability; it has exactly one implementation.
- Keep secrets out of the repo. Provide a `.env.example`. That is the entire security bar for this project.
- **Demo data and deployment.** The public deploy must actually run, so it uses a small (about 30 to 50 rows), clearly labeled synthetic dataset committed to the repo; the real challenge data is used only locally and in the private video. This is not a second pipeline: one loading function reads whichever seed is configured. Because Vercel functions have a read-only filesystem and native modules can be fragile there, use an in-memory SQLite seeded at startup and prefer a WASM build (for example sql.js) so the same code runs locally and on the deploy with no native-binding surprises. Design the synthetic fixture to exhibit the same shapes as the real data (a mix over and under $50, a couple of duplicate candidates, some operational permit and toll repeats) so the public demo represents the real features faithfully.

---

## 9. Product wording bank

Use this vocabulary consistently across the UI labels, the README, and any message to the Brim contact. Precise finance language does more for perceived seniority than any framework.

merchant spend; account activity; out-of-policy spend; documentation required; high-risk review; duplicate-charge candidate; split or repeat-merchant candidate; policy reality; control gap; evidence rows; human-in-the-loop approval; AI recommendation with evidence; surfaced for review (not "flagged as fraud").

---

## 10. Rules of engagement for the agent

**Build in this order, and pause for review after each step. Do not run ahead.**

1. Scaffold the minimal app and confirm it runs and renders an empty shell. Review.
2. Build the data loader and the merchant-spend vs account-activity classification. Verify the classification reproduces the ~$1,510,738.52 spend total. Review.
3. Build the query layer (the deterministic functions that compute totals, trends, category breakdowns, and the risk candidate sets). Review.
4. Build Feature A against its acceptance criteria. Review.
5. Build Feature B against its acceptance criteria. Review.
6. Polish the UI to the Section 7 constraints. Write the README, ARCHITECTURE.md, ASSUMPTIONS.md. Review.
7. (Only if time and A and B are perfect) the optional expense report generation feature.

**Standing rules:**
- Every change maps to a line in this spec. If it does not, do not make it; raise it instead.
- Never add a dependency, runtime, or service without asking first.
- When a feature meets its acceptance criteria, stop building it.
- When unsure between "more" and "less," choose less and ask.
- Numbers come from the store, never the model (Section 5). This is not negotiable.

**Demo recording skeleton (60 to 90 seconds), built around the differentiated insight, not the chatbot:** open by separating real merchant spend from payments and fees (about 10s); one plain-English fuel question as a supporting beat, not the headline (about 10s); then the centerpiece (about 40s): the policy reality (a literal $50 rule would flag two-thirds of a fleet's spend), the false-positive control (why a naive tool drowns in legitimate permit and toll repeats and how this avoids it), and one genuine review candidate with its evidence; move the threshold slider once (about 10s); close on the platform-relevant framing (about 10s). The headline is "a policy engine that does not flag normal fleet operations as suspicious," not "chat with your expenses."

---

## 11. Out of scope, but named on purpose (the honest "what's next")

State this in the README rather than building it. Knowing what production would require signals more maturity than half-building it: persistence and real ingestion, real employee, department, and budget data feeding the pre-approval and forecasting features, receipt capture and matching, alerting, an audit trail of decisions, and authentication. The current build is a focused demonstration of the core engines and the data insights, designed so those engines could accept real metadata later.
