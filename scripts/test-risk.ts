import { loadDatabase } from "../lib/loader";
import { applyClassification } from "../lib/classify";
import { debitsOver50, duplicateCandidates, sameDayClusters } from "../lib/risk";
import { normalizeMerchant } from "../lib/queries";
import path from "path";

const EXPECTED_DEBITS = 4180;
const EXPECTED_OVER50 = 2736;
const EXPECTED_PCT = 65.5;
const EXPECTED_DUP_GROUPS = 150;
const EXPECTED_CLUSTERS = 595;

let failed = false;
function check(label: string, cond: boolean, detail: string) {
  if (cond) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label} (${detail})`); failed = true; }
}

async function main() {
  const db = await loadDatabase(path.join("data", "transactions.xlsx"));
  applyClassification(db);

  // Over-$50 on all debits (Ticket 5 wording, target 2736 of 4180).
  const o = debitsOver50(db);
  check(`debit count = ${EXPECTED_DEBITS}`, o.debitCount === EXPECTED_DEBITS, `got ${o.debitCount}`);
  check(`over-$50 count = ${EXPECTED_OVER50}`, o.over50Count === EXPECTED_OVER50, `got ${o.over50Count}`);
  check(`over-$50 percentage = ${EXPECTED_PCT}`, o.percentage === EXPECTED_PCT, `got ${o.percentage}`);

  // Duplicates: normalized merchant + amount + date.
  const dups = duplicateCandidates(db);
  check(`exact-duplicate groups = ${EXPECTED_DUP_GROUPS}`, dups.length === EXPECTED_DUP_GROUPS, `got ${dups.length}`);
  check("duplicate groups ranked by count descending", dups.every((g, i) => i === 0 || dups[i - 1].count >= g.count), "not sorted");
  check("each duplicate group carries its evidence rows", dups.every((g) => g.rows.length === g.count), "row count mismatch");
  check("duplicate group key is the normalized merchant", dups.every((g) => g.rows.every((r) => normalizeMerchant(r.merchant) === g.merchant)), "normalized key mismatch");
  check("duplicate rows share amount and date", dups.every((g) => g.rows.every((r) => r.amount === g.amount && r.date === g.date)), "amount/date mismatch");
  check("duplicate groups expose raw names folded in", dups.every((g) => g.rawNames.length >= 1), "rawNames missing");

  // Clusters: raw merchant + date (tighter, same physical location).
  const clusters = sameDayClusters(db);
  check(`same-day clusters = ${EXPECTED_CLUSTERS}`, clusters.length === EXPECTED_CLUSTERS, `got ${clusters.length}`);
  check("each cluster carries its evidence rows", clusters.every((c) => c.rows.length === c.count), "row count mismatch");
  check("cluster rows share raw merchant and date", clusters.every((c) => c.rows.every((r) => r.merchant === c.merchant && r.date === c.date)), "merchant/date mismatch");

  db.close();
  if (failed) { console.error("Some risk checks FAILED."); process.exit(1); }
  console.log("All risk checks passed.");
}
main().catch((e) => { console.error("TEST ERROR:", e); process.exit(1); });