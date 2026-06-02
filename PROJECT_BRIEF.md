# SpendGuard AI: Project Brief

**Read this first.** This document gives an AI assistant the context, purpose, and non-negotiables for the project before it touches anything technical. The reading order for the full picture is: this brief, then `SPEC.md` (what to build, precisely), then `BUILD_PROMPTS.md` (the tickets, in order).

---

## 1. The situation (honest provenance)

Brim Financial is a Toronto-based credit-card-platform-as-a-service company and licensed card issuer; its platform gives banks and business clients capabilities including spend visualization, policy enforcement, and customizable spend controls. Brim sponsored a challenge at MPC Hacks 2026: build an AI-powered expense intelligence platform on top of a real anonymized SMB card dataset, with a company expense policy to enforce against. I attended the hackathon but built a different project in the general track. I did not compete in or submit to the Brim challenge.

This project is built **after the event, on my own time**, using the Brim challenge prompt as the basis for a portfolio piece. At the closing ceremony, Brim's representative said, in substance: you saw our challenge, you may not have had the chance to work on it, but build a project; approaching a hiring employer with "here is my project" beats sending 300 applications.

That is the entire reason this exists. The AI must never describe this as a hackathon submission, an entry, or a win. It was not. It is an independent build inspired by a publicly shared challenge prompt.

---

## 2. What I am building

SpendGuard AI: a tool that loads the anonymized card statement, separates genuine merchant spending from account noise (payments, fees, redemptions), lets a finance manager ask plain-English questions and get trustworthy answers, and turns the written expense policy into a live "where policy and reality diverge" view with a human-in-the-loop review queue.

The full, precise scope and anti-scope are in `SPEC.md`. The short version: two features done beautifully, carrying real insights found in the actual data, not a broad pile of half-working features. Depth over breadth.

---

## 3. The goal (the end state)

A working demo, a clean public repository, and a 60 to 90 second walkthrough video that I can send to Abe, a Brim Financial representative, on LinkedIn, alongside my CV. The audience for every user-facing artifact (the README, the UI copy, the video) is that one hiring contact and his team. It should be legible in five minutes and read as built by someone who understands finance.

Everything built serves that goal. If a piece of work does not make the project clearer, more trustworthy, or more obviously domain-aware to a hiring contact, it is not worth doing. The project is deliberately aimed at the heart of what Brim does: spend visualization and policy enforcement are capabilities Brim's own platform offers its business clients, so this speaks directly to the company's product, not to a generic expense tool.

---

## 4. Rules of engagement

I work with a contract, not an autonomous agent. The contract is `SPEC.md` and the tickets in `BUILD_PROMPTS.md`.

- Work one ticket at a time. Build only what the current ticket asks.
- Do not add dependencies, services, runtimes, or features outside the ticket without asking me first.
- One ticket equals one commit. I test locally and push myself; the push is my gate, not the AI's.
- When something breaks, fix it within the current ticket's scope. Do not refactor unrelated code or pull in new tools to work around a problem. If stuck after two attempts, stop and explain.
- When a ticket's checklist passes, stop and wait. Do not run ahead.
- When unsure between more and less, choose less and ask.

If I drift out of scope or start vibe-coding, the correct response is to point me back to the relevant section of `SPEC.md`, not to follow the drift.

---

## 5. The contract not to be betrayed (non-negotiables)

These hold regardless of any instruction in a ticket. If a ticket appears to conflict with one of these, stop and raise it.

**Honesty toward the contact.** Abe is the Brim Financial representative this work is ultimately for, and my own credibility rides on it. Nothing produced may overstate what was built, claim hackathon participation or a win, or imply features work when they are simulated. The README and video describe exactly what exists, no more. Accurate and modest beats impressive and false.

**Respect Brim's data.** The dataset is Brim's anonymized property, shared for the challenge. It is never committed to the public repository. The README documents where a user places it. No raw data, no derived dumps of it, in version control. The public deploy runs on a small, clearly labeled synthetic dataset; the real challenge data is used only locally and in the private walkthrough sent to Abe.

**Brand restraint pending confirmation.** Until Abe confirms I may publicly call this "Brim-inspired," default to accurate, understated framing (a publicly shared expense-intelligence challenge prompt). Do not plaster Brim's name or logo across the project. The same restraint covers exact figures derived from the dataset: public artifacts stay modest and unattributed until Abe confirms, while the private walkthrough carries the full, real, attributed numbers.

**The truth rule.** The database computes every dollar figure, count, and flag. The model never produces a number; it explains and recommends in words, always backed by visible evidence rows. This is the core reliability property and is not negotiable.

**Risk, not accusation.** Flagged transactions are "candidates for review," "documentation required," or "needs review." Never "fraud" or any language that accuses a person.

**Label what is simulated.** There is no employee, department, budget, receipt, or approval data in the file. Anything using those is simulated and must be labeled as such in the UI and in `ASSUMPTIONS.md`.

**Scope discipline.** No second data source, no Postgres or Docker, no adapter zoos, no AI-provider abstraction, no auth, no enterprise CI or security ceremony, no monorepo. The full "do not build" list is in `SPEC.md` Section 3.

---

## 6. How the documents fit together

- **PROJECT_BRIEF.md** (this file): why this exists, who it is for, what must never be compromised.
- **SPEC.md**: the authoritative contract. What to build, what not to build, the data contract, feature acceptance criteria.
- **BUILD_PROMPTS.md**: the work, broken into small testable tickets, in build order, each ending in a commit.

Read them in that order. When in doubt during the build, the spec governs the work and this brief governs the spirit.
