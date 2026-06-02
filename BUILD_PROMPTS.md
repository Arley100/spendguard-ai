# SpendGuard AI: Build Prompts

How to use this: feed one ticket at a time to your AI assistant. Each is self-contained and references `SPEC.md` (the contract). After each ticket, run the **Test** yourself before you send the next one. That gate is the whole point: it is what keeps the build from drifting.

**One ticket equals one commit.** The rhythm per ticket is: the AI builds it and stops, you run the **Test** locally, and only if it passes do you commit and push. A green commit in your history then always means "I saw this work." Use commit messages of the form `ticket N: short description`. Pushing is your action, not the AI's, because the push is the gate. Do **Ticket 0** first to make the repo and deploy pipeline green before any feature exists.

Paste the **Standing preamble** once at the start of any new session, then send tickets in order.

---

## Standing preamble (paste once per session)

> You are helping build SpendGuard AI. `SPEC.md` in the repo root is the contract. Read it fully before doing anything. Rules for every ticket I send:
> 1. Build only what the current ticket asks. Nothing extra.
> 2. Do not add a dependency, service, runtime, or feature that is not in the ticket without asking me first.
> 3. Every dollar figure, count, and flag comes from the database, never from you (SPEC Section 5).
> 4. If something breaks, fix it inside the current ticket's scope only. Do not refactor unrelated code or pull in a new tool to work around it. If you are stuck after two attempts, stop and explain the problem to me.
> 5. When the ticket's checklist passes, stop, tell me exactly how to test it, and wait. Do not start the next ticket.
> 6. After I confirm the test passed, you may stage the changes and propose a commit message in the form `ticket N: short description`. I run the push myself.

---

## Ticket -1: Evidence Pack (before any setup; not a product feature)

> Before touching code, run manual queries on the real data locally and lock the story. Produce a short private note (not committed) selecting: one spend vs account-activity insight, one policy-reality or control-gap insight, one review candidate with its evidence rows, and one insight you rejected because the data could not support it. This is story selection, not building: it decides which insights the demo and README are built around. Much of it is already established (the spend split, the roughly 66% policy gap, the permit false-positive trap); this step is to confirm those on the data yourself and pick the single most memorable one to lead with.

**Test:** you can state, in one sentence each, the three insights you will feature and the one you honestly ruled out. Nothing is committed.

---

## Ticket 0: Repo and deploy pipeline (do this first)

> Set up the delivery pipeline before any feature exists. Create a GitHub repo under github.com/Arley100 and connect it locally. Add a `.gitignore` that excludes `node_modules/`, `.next/`, `.env*`, the generated SQLite database file, and `/data/transactions.xlsx`. Do not commit the dataset: it is Brim's anonymized data, and the README will document where to place it. Do commit a small synthetic demo seed (about 30 to 50 rows, same columns, fake merchants, shaped to show the same patterns as the real data); the public deploy runs on this while the real data stays local. Do the account steps yourself (creating the repo, connecting Vercel, any tokens); the AI writes the .gitignore and the command checklist but is never handed your credentials. Connect the repo to a deploy target (Vercel for the Next.js stack) so that every push auto-deploys. Make an initial commit and push it.
>
> This ticket can be done by hand or merged with Ticket 1's first push, but the pipeline must be green before features begin.

**Test:** the initial commit is on GitHub, the deploy target shows a successful build (even of an empty project), and `git status` confirms the data file and `.env` are not tracked. Proving the deploy green now is the failure mode that bit you at MPC Hacks; fix it here where it is trivial.

---

## Ticket 1: Scaffold

> Create the minimal app skeleton. Stack: Next.js (App Router, TypeScript), an in-memory SQLite store using a WASM build such as sql.js (so it runs identically locally and on Vercel, whose filesystem is read-only and where native modules are fragile), Recharts for charts, the Anthropic API for narration later (with a no-key fallback, see Ticket 6). One repo, one deployable unit (SPEC Section 8). It must run with a single documented command and render an empty shell with the title "SpendGuard AI" and a placeholder area for the dashboard. No features yet. Place the real spreadsheet locally at `/data/transactions.xlsx` (gitignored); the committed synthetic seed from Ticket 0 is what the deploy uses.
>
> (If I tell you to use Python instead, swap this to FastAPI + SQLite serving a small frontend, still one deployable unit. Otherwise use the stack above.)

**Test:** the dev command serves a page that loads with no console errors and shows the app title.

---

## Ticket 2: Data loader and DB seed

> Write one seed function that loads the configured source (the real `/data/transactions.xlsx` locally, or the committed synthetic seed on the deploy) into an in-memory SQLite table `transactions`, with column types matching SPEC Section 4. One loader, one implementation, selected by config or environment, not two pipelines. Load the data faithfully; do not transform or interpret meaning yet. On completion (running locally on the real data), print a summary: total row count, min and max transaction date, and the Debit vs Credit counts.

**Test:** on the real local data, the summary prints 4235 rows, dates 2025-08-06 to 2026-03-27, roughly 4180 Debit and 55 Credit. The synthetic seed loads through the same function without error.

---

## Ticket 3: Spend vs account-activity classification

> Add a derived classification per SPEC Section 4. A row is `merchant_spend` when it is a Debit AND has a Merchant Category Code. Everything else is `account_activity` (card payments, fees, interest, point redemptions). Implement this as a column or a view. Write one small unit test asserting that total `merchant_spend` is approximately 1,510,738.52 CAD and that the CWB EFT PAYMENT credits are excluded from it.

**Test:** the computed merchant-spend total matches about $1,510,738.52, and the unit test passes.

---

## Ticket 4: Core query functions

> Write deterministic query functions (no AI involved). All operate on `merchant_spend` only: total spend; spend by category, mapping MCC to human labels (for example 5541 and 5542 to Fuel, 9399 to Permits and Government, 4784 to Tolls, 7542 to Washes, 5533 to Auto Parts); spend by month; and top N merchants using normalized merchant names (strip store numbers, city, and state from the raw DBA string before grouping).

**Test:** spot-check Fuel spend and one month's total against a manual SQL query I run; category labels show the trucking categories.

---

## Ticket 5: Risk candidate queries

> Write deterministic functions (no AI) that return, each with its supporting evidence rows: the count and percentage of merchant purchases over $50; duplicate-charge candidates (identical normalized merchant + amount + date), ranked highest first; and same-merchant same-day clusters. Operate on `merchant_spend` only (Debit-with-MCC), not the raw statement, so fees and payments are excluded. Make the ranking MCC-aware: repeated permits, tolls, weigh-scales, and crossings (MCC 9399 and 4784) are normal fleet activity, so down-rank them and prioritize repeats at non-operational merchants. Put an item near the top only if it passes a stricter test: same normalized merchant, same amount, same date, a non-operational MCC, with evidence visible. Attach a confidence caveat noting the data has no employee, card, or timestamp field, so a same-day repeat may be different drivers. If nothing clears the bar, return an honest empty result rather than padding it. These are candidates for review, not accusations.

**Test:** over-$50 among merchant purchases is about 66% (roughly 2735 of 4147); about 150 exact-duplicate groups and 595 clusters before down-ranking; the permit and toll repeats are recognizable and pushed down the ranking, not surfaced as top risks.

---

## Ticket 6: Talk-to-data backend (the truth rule)

> Build the endpoint behind Feature A (SPEC Section 6A and the truth rule in Section 5). Flow: the model translates the user's question into a constrained JSON intent (metric, group-by dimension, filter, date range) chosen only from the metrics built in Tickets 4 and 5. My code runs the matching parameterized query. Then the model writes a one or two sentence narration of the numbers the query returned. The model must never write SQL and never produce a number itself. If a question does not map to a known intent, return a graceful message naming what it can answer (spend by category, by month, by merchant, policy and risk). Keep short conversation context so follow-ups work without re-stating. If no API key is present, the structured queries still run and charts still render; narration falls back to deterministic templates and the UI notes that AI narration is off. The app must never hard-fail for a missing key.

**Test:** three representative questions plus one follow-up each return numbers matching a query I check by hand; the narration contains no number that is not in the result; a nonsense question degrades gracefully instead of inventing an answer.

---

## Ticket 7: Talk-to-data UI

> Build the Feature A panel: a chat-style input, rendering the fitting visualization from the structured result (bar or line for comparisons and trends, table for itemized lists, a single number with one sentence for simple totals), plus the narration. Support follow-ups. Use the semantic palette in SPEC Section 7 and nothing decorative.

**Test:** asking the same questions in the UI renders correct charts and narration, and a follow-up keeps context.

---

## Ticket 8: Policy reality panel

> Build the policy reality panel (SPEC Section 6B). State the relevant Brim policy rules in plain language (over $50 needs pre-auth and a receipt; corporate cards not for personal use; alcohol only when dining with a customer; tips capped 15 to 20%; no traffic or parking tickets or personal-use rentals). Then show the measured reality against the headline rule, all numbers pulled live from the query layer: the share of charges over $50 and what that implies operationally.

**Test:** the percentage and count over $50 are computed on merchant purchases (about 66%), correct, and come from the data, not hardcoded.

---

## Ticket 9: Review queue with tiered routing

> Build the review queue (SPEC Section 6B). Three tiers: Cleared (low, auto-cleared), Documentation Required (medium: normal-looking spend over the threshold), High-Risk Review Candidates (high: duplicate-charge candidates and same-merchant same-day clusters). Title the high tier "High-Risk Review Candidates," never "high-risk transactions." Rank exact-amount duplicates above mere same-merchant clusters, and down-rank operational repetition (permits, tolls, weigh-scales, crossings) which is normal for a fleet, so the top of the queue is genuinely unusual activity, not a wall of legitimate permit charges. Show a confidence caveat on each item (no employee, card, or timestamp field, so a same-day repeat may be different drivers). If nothing clears the strict bar from Ticket 5, show an honest empty state ("no strong candidates; here is what was checked") rather than padding it. Each queued item shows its evidence rows and a one-line model explanation of why it is there. Use the wording bank in SPEC Section 9: "candidate," "needs review," "documentation required," never "fraud."

**Test:** the three tiers separate correctly, the high tier is titled "candidates" with a confidence caveat per item, every high item displays its evidence rows, an empty result is shown honestly when nothing qualifies, and no UI text accuses a transaction of fraud.

---

## Ticket 10: Policy simulation slider

> Add the policy simulation control (SPEC Section 6B): a threshold slider from $50 to $500 that live-recomputes how many transactions fall into Documentation Required at that threshold, and states the tradeoff in one sentence (higher threshold means less review noise but smaller items pass unchecked).

**Test:** moving the slider updates the counts without a page reload, and the counts are numerically correct at two different thresholds I pick.

---

## Ticket 11: UI polish

> Polish the UI to SPEC Section 7. Semantic color only (neutral base; one accent reserved for AI insight; green cleared; amber documentation required; red strictly high-risk). Remove any visual that is not answering a real question. Calm, serious finance look, not a flashy dashboard. Make it presentable for a screen recording.

**Test:** visual review against SPEC Section 7; every chart earns its place and color means exactly one thing.

---

## Ticket 12: Documentation

> Write the three docs (SPEC Sections 2 and 11). `README.md`: structure the top as the whole pitch, in this order: what this is; why it matters to Brim; the two insights; watch the 90-second demo; run locally. Everything else sits below. Position it as a focused prototype of a policy-intelligence layer that could sit behind a business-card program (classify spend, expose reliable query results, route review candidates with evidence), not as a generic expense dashboard. An optional sharper subtitle: "Policy Reality Check for Business Card Programs." Keep public artifacts modest and unattributed until Abe confirms public framing: describe what the app computes rather than publishing detailed derived tables, and reserve the full real figures for the private video. `ARCHITECTURE.md`: one diagram plus a paragraph per layer. `ASSUMPTIONS.md`: what is real vs simulated, the truth rule, and the risk-not-accusation language. Do not overclaim; the README is read by a hiring contact, so it must match exactly what was built.

**Test:** read all three; they match the actual build and nothing is oversold.

---

## Ticket 13 (optional, only if 1 to 12 are all passing and polished): Expense Report Generation

> Only start this if every prior ticket passes and the two main features are polished. Build expense report generation (SPEC Section 6, optional feature). The user selects a date range, optionally narrowed to a category or merchant, and gets a report: grouped line items with per-category subtotals and a grand total, each line carrying its policy and risk status reused from Feature B (cleared, documentation required, high-risk). Add a short AI summary that narrates the computed totals (truth rule: the model writes no number). Make it printable or exportable and give it a simple "ready for approval" status. Do not add auth or approval routing. Label the grouping basis and note that employee and trip data are not in the dataset.

**Test:** a chosen date range produces a report whose subtotals and grand total match a query I check by hand; each line shows its policy and risk status; the AI summary invents no number; the report prints or exports cleanly and states its grouping basis.

---

## Final step (yours, not a prompt): the demo

Record the 60 to 90 second walkthrough per SPEC Section 10: headline spend number, the spend-vs-account-activity separation, one plain-English fuel question with a chart, the documentation-required vs high-risk split, one duplicate candidate with evidence, one slider move, close. This is the artifact Abe actually watches, so it is worth a few takes.
