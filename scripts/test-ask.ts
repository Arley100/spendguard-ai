import { loadDatabase } from "../lib/loader";
import { applyClassification } from "../lib/classify";
import { matchIntent } from "../lib/match";
import { validateIntent } from "../lib/intent";
import { dispatch, QueryResult } from "../lib/dispatch";
import { templateNarrate } from "../lib/narrate";
import { Database } from "sql.js";
import path from "path";

let failed = false;
function check(label: string, cond: boolean, detail: string) {
  if (cond) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label} (${detail})`); failed = true; }
}

// Run the full no-key chain for a question.
function ask(db: Database, question: string): { result: QueryResult; narration: string } {
  const intent = validateIntent(matchIntent(question));
  const result = dispatch(db, intent);
  const narration = templateNarrate(result);
  return { result, narration };
}

// Extract every number-like token from a string (for the "no invented number"
// check). We compare the numbers in the narration against numbers present in
// the result payload. Strips $ and commas so 1,510,738.52 -> 1510738.52.
function numbersIn(text: string): string[] {
  const matches = text.match(/\d[\d,]*\.?\d*/g) ?? [];
  return matches.map((m) => m.replace(/,/g, "")).filter((m) => m.length > 0);
}

async function main() {
  const db = await loadDatabase(path.join("data", "transactions.xlsx"));
  applyClassification(db);

  // --- Q1: total spend (hand-verified 1510738.52) ---
  {
    const { result, narration } = ask(db, "what was our total spend?");
    check("Q1 routes to total_spend", result.metric === "total_spend", result.metric);
    const total = (result.data as { total: number }).total;
    check("Q1 total = 1510738.52", Math.abs(total - 1510738.52) <= 0.01, `got ${total}`);
    check("Q1 narration mentions the total", narration.includes("1,510,738.52"), narration);
  }

  // --- Q2: fuel category (hand-verified 687389.48) ---
  {
    const { result, narration } = ask(db, "how much did we spend on fuel?");
    check("Q2 routes to spend_by_category", result.metric === "spend_by_category", result.metric);
    const row = (result.data as { row: { total: number } | null }).row;
    check("Q2 fuel total = 687389.48", !!row && Math.abs(row.total - 687389.48) <= 0.01, `got ${row?.total}`);
    check("Q2 narration mentions fuel total", narration.includes("687,389.48"), narration);
  }

  // --- Q3: policy over $50 (hand-verified 2736 of 4180, 65.5%) ---
  {
    const { result, narration } = ask(db, "how many charges are over $50 for the policy?");
    check("Q3 routes to policy_over_50", result.metric === "policy_over_50", result.metric);
    const d = result.data as { over50Count: number; debitCount: number; percentage: number };
    check("Q3 over-50 = 2736 of 4180", d.over50Count === 2736 && d.debitCount === 4180, `got ${d.over50Count}/${d.debitCount}`);
    check("Q3 percentage = 65.5", d.percentage === 65.5, `got ${d.percentage}`);
  }

  // --- Q4 (follow-up style): October 2025 month filter (hand-verified 267006.79) ---
  {
    const { result, narration } = ask(db, "what about october 2025?");
    check("Q4 routes to spend_by_month with filter", result.metric === "spend_by_month", result.metric);
    const row = (result.data as { row: { total: number } | null }).row;
    check("Q4 October 2025 = 267006.79", !!row && Math.abs(row.total - 267006.79) <= 0.01, `got ${row?.total}`);
    check("Q4 narration mentions October total", narration.includes("267,006.79"), narration);
  }

  // --- Truth-rule guard: across all four, narration introduces no number not in the result ---
  {
    const questions = [
      "what was our total spend?",
      "how much did we spend on fuel?",
      "how many charges are over $50 for the policy?",
      "what about october 2025?",
    ];
    let cleanAll = true;
    let offender = "";
    for (const question of questions) {
      const { result, narration } = ask(db, question);
      const resultNums = new Set(numbersIn(JSON.stringify(result.data)));
      const narrationNums = numbersIn(narration);
      for (const n of narrationNums) {
        // Allow integers that are clearly counts/labels present in result, and
        // the percentage. The check: every narration number must appear in the
        // serialized result data.
        if (!resultNums.has(n)) { cleanAll = false; offender = `${question} -> "${n}" not in result`; break; }
      }
      if (!cleanAll) break;
    }
    check("narration introduces no number absent from the result", cleanAll, offender);
  }

  // --- Graceful degradation: nonsense returns the capability menu ---
  {
    const { result, narration } = ask(db, "what is the meaning of life?");
    check("nonsense routes to unsupported", result.metric === "unsupported", result.metric);
    check("nonsense returns capability menu", narration.toLowerCase().includes("i can answer"), narration);
  }

  db.close();
  if (failed) { console.error("\nSome talk-to-data checks FAILED."); process.exit(1); }
  console.log("\nAll talk-to-data (no-key path) checks passed.");
}
main().catch((e) => { console.error("TEST ERROR:", e); process.exit(1); });