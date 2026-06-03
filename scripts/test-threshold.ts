import { loadDatabase } from "../lib/loader";
import { applyClassification } from "../lib/classify";
import { debitsOver50, thresholdCurve } from "../lib/risk";
import { Database } from "sql.js";
import path from "path";

let failed = false;
function check(label: string, cond: boolean, detail: string) {
  if (cond) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label} (${detail})`); failed = true; }
}

// Independent hand-check: count debits strictly over a threshold, directly.
function countOver(db: Database, t: number): number {
  return db.exec(
    `SELECT COUNT(*) FROM transactions WHERE "Debit or Credit"='Debit' AND CAST("Transaction Amount" AS REAL) > ?`,
    [t]
  )[0].values[0][0] as number;
}

async function main() {
  const db = await loadDatabase(path.join("data", "transactions.xlsx"));
  applyClassification(db);

  const curve = thresholdCurve(db);
  const o = debitsOver50(db);

  check("curve spans $50 to $500 in $10 steps (46 points)", curve.length === 46, `got ${curve.length}`);
  check("first point is $50", curve[0].threshold === 50, `got ${curve[0].threshold}`);
  check("last point is $500", curve[curve.length - 1].threshold === 500, `got ${curve[curve.length - 1].threshold}`);

  // The $50 point must equal the policy panel's over-50 count exactly.
  check("curve at $50 = debitsOver50 count (2736)", curve[0].count === o.over50Count && curve[0].count === 2736, `got ${curve[0].count}`);

  // Monotonic non-increasing: a higher threshold can never flag MORE items.
  let monotonic = true;
  for (let i = 1; i < curve.length; i++) if (curve[i].count > curve[i - 1].count) { monotonic = false; break; }
  check("curve is monotonically non-increasing", monotonic, "a higher threshold flagged more");

  // Two independent spot-checks the user can re-pick.
  const at100 = curve.find((p) => p.threshold === 100)!.count;
  const at250 = curve.find((p) => p.threshold === 250)!.count;
  check("curve at $100 matches a direct count", at100 === countOver(db, 100), `curve ${at100} vs direct ${countOver(db, 100)}`);
  check("curve at $250 matches a direct count", at250 === countOver(db, 250), `curve ${at250} vs direct ${countOver(db, 250)}`);
  console.log(`   (for reference: over $100 = ${at100}, over $250 = ${at250})`);

  db.close();
  if (failed) { console.error("\nSome threshold-curve checks FAILED."); process.exit(1); }
  console.log("\nAll threshold-curve checks passed.");
}
main().catch((e) => { console.error("TEST ERROR:", e); process.exit(1); });