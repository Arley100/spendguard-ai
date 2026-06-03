import { loadDatabase } from "../lib/loader";
import { applyClassification } from "../lib/classify";
import { totalSpend, spendByCategory, spendByMonth, topMerchants } from "../lib/queries";
import path from "path";

const EXPECTED_TOTAL = 1510738.52;
const EXPECTED_FUEL = 687389.48;
const EXPECTED_OCT = 267006.79;
const TOL = 0.01;

let failed = false;
function check(label: string, cond: boolean, detail: string) {
  if (cond) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label} (${detail})`); failed = true; }
}

async function main() {
  const db = await loadDatabase(path.join("data", "transactions.xlsx"));
  applyClassification(db);

  // Total spend.
  const total = totalSpend(db);
  check("total spend = 1510738.52", Math.abs(total - EXPECTED_TOTAL) <= TOL, `got ${total}`);

  // Category totals sum back to the grand total (no spend lost in bucketing).
  const cats = spendByCategory(db);
  const catSum = Math.round(cats.reduce((s, c) => s + c.total, 0) * 100) / 100;
  check("category totals reconcile to grand total", Math.abs(catSum - EXPECTED_TOTAL) <= 0.05, `got ${catSum}`);

  // Fuel spot-check.
  const fuel = cats.find((c) => c.category === "Fuel");
  check("Fuel category = 687389.48", !!fuel && Math.abs(fuel.total - EXPECTED_FUEL) <= TOL, `got ${fuel?.total}`);

  // Trucking labels are present.
  const labels = cats.map((c) => c.category);
  check("trucking labels present (Fuel, Permits and Government, Tires)",
    ["Fuel", "Permits and Government", "Tires"].every((l) => labels.includes(l)),
    labels.join(", "));

  // Monthly spot-check: October 2025.
  const months = spendByMonth(db);
  const oct = months.find((m) => m.month === "2025-10");
  check("2025-10 spend = 267006.79", !!oct && Math.abs(oct.total - EXPECTED_OCT) <= TOL, `got ${oct?.total}`);

  // Months reconcile to total.
  const monthSum = Math.round(months.reduce((s, m) => s + m.total, 0) * 100) / 100;
  check("monthly totals reconcile to grand total", Math.abs(monthSum - EXPECTED_TOTAL) <= 0.05, `got ${monthSum}`);

  // Normalization collapsed LOVE'S store-number variants into one merchant.
  const allMerch = topMerchants(db, 100);
  const loves = allMerch.filter((m) => m.merchant.includes("LOVE'S"));
  check("LOVE'S variants collapse to a single merchant", loves.length === 1, `found ${loves.length}: ${loves.map((l) => l.merchant).join(" | ")}`);
  check("collapsed LOVE'S has many transactions (normalization worked)", loves[0] !== undefined && loves[0].count > 50, `count ${loves[0]?.count}`);
  check("no top merchant label retains a # store number", allMerch.every((m) => !m.merchant.includes("#")), allMerch.filter((m) => m.merchant.includes("#")).map((m) => m.merchant).join(", "));
  // Top merchant is the Michelin concentration.
  const top = topMerchants(db, 10);
  check("top merchant is Michelin concentration", top.length > 0 && top[0].merchant.includes("MICHELIN"), top[0]?.merchant ?? "none");

  db.close();
  if (failed) { console.error("Some query checks FAILED."); process.exit(1); }
  console.log("All query checks passed.");
}
main().catch((e) => { console.error("TEST ERROR:", e); process.exit(1); });