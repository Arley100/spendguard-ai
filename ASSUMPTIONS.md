# Assumptions and limitations

This document states plainly what is real, what is not, how the tool is kept honest, and where its known soft spots are. The intent is that a reader can trust every number the tool shows precisely because the places it cannot be certain are written down here rather than hidden.

## The truth rule

Every dollar figure, count, percentage, and flag in SpendGuard is computed by the deterministic logic layer (real SQL over the dataset), never by the language model. The model's only job is to narrate a result the engine has already produced. On the talk-to-data path, the model's narration passes through a guard that checks every number in its sentence against the computed result; if the model introduces a figure the data does not support, the narration is rejected and a verified template sentence is shown instead, labeled with a Computed pill rather than an AI pill. The guard checks numeric faithfulness, not phrasing, so it does not catch a mischaracterizing word, and it is deliberately strict, so it will sometimes reject a correct AI sentence and fall back to the template. That tradeoff is intentional: the user is structurally protected from seeing a fabricated number, at the cost of occasionally showing the plainer template wording.

## Real versus simulated data

The dataset is the dummy sample data Brim Financial provided for its sponsored challenge at MPC Hacks 2026. It is anonymized, merchant-level transaction data generated for a public hackathon, with no real customer or production data and no cardholder identity. The expense policy used for the policy checks is the sample policy document provided with the same challenge. The committed synthetic CSV used as a deployment fallback is small, obviously fake data that exists only so the app degrades gracefully when the real file is absent; when it is in use, the interface says so.

## Risk language: candidates, not accusations

Nothing in the tool calls anything fraud. Duplicate charges and same-day merchant clusters are surfaced as candidates for human review, with their evidence rows attached and a one-line reason. The data has no employee, card, or timestamp field, so the tool cannot tell whether a same-day repeat is one card used several times or several cards used once, and it does not pretend to. Every flag is something a person decides on; the tool surfaces and explains, it does not judge.

## Known limitations

**Category coverage.** Spend is grouped by merchant category code into readable labels (Fuel, Permits and Government, Tires, and so on). A block of roughly 470 transactions, about $119,450.92, carries no usable category code and is reported in an Other bucket rather than guessed at. Grouping by category code is a best-effort mapping, not an audited chart of accounts.

**Merchant normalization.** Merchant names arrive ragged, with store numbers and formatting variants, so the tool normalizes them before grouping. This is why the shipped risk counts (150 exact-duplicate groups, 595 same-day clusters) are lower than a naive count on the raw names would give (159 and 618): normalization correctly folds variants of the same merchant together. Normalization is best-effort and a few unusual labels may not fold perfectly.

**Operational down-ranking by category code.** The review queue down-ranks permit, toll, and government-crossing repeats as routine fleet operations, identified primarily by merchant category code (9399 and 4784) with a small keyword fallback for permit-named merchants that carry an off-category code. Because the signal is the category code, a miscoded merchant can be misfiled: one roadhouse in the data is coded as a toll and is therefore treated as operational. The principled choice was to let the code speak rather than hand-tune around individual rows.

**Tier overlap.** Cleared and Documentation required partition the debits by the $50 rule and are mutually exclusive. High-risk review is a separate lens, not a third slice: it counts candidate groups, many of whose transactions are already counted in the two tiers above. The three numbers are different units and are not meant to sum.

**Currency.** Amounts are treated as already in the statement currency; where a conversion rate is present it reflects an applied foreign-exchange rate, and domestic charges carry a rate of zero. The tool does not re-derive exchange rates.

## Dependency advisories

Two npm advisories are knowingly accepted and not patched. The `xlsx` (SheetJS) package carries a high advisory for prototype pollution and regular-expression denial of service; it is accepted because the tool parses only a single trusted local file, never user-uploaded or networked input, which is the vector those issues require. A moderate advisory reaches `postcss` transitively through the Next.js build toolchain; it affects build-time tooling only, not the running app, and the available fix is a breaking framework downgrade, so it is left to resolve on a future Next.js upgrade rather than forced now.

## Deliberate non-goals

This is two features built well, not a broad platform. There is intentionally no second data source, no external database, no authentication, no AI-provider abstraction, no receipt matching, and no continuous-integration pipeline. Those were judged to be effort that would not serve the goal of showing focused, domain-aware work, and were left out on purpose.
