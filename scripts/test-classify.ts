import { loadDatabase } from "../lib/loader";
import { applyClassification, merchantSpendTotal, cwbPaymentTotalInMerchantSpend } from "../lib/classify";
import { Database } from "sql.js";
import path from "path";

const EXPECTED_SPEND = 1510738.52;
const EXPECTED_MERCHANT_ROWS = 4147;
const EXPECTED_TOTAL_ROWS = 4235;
const TOLERANCE = 0.01;

let failed = false;
function check(label: string, cond: boolean, detail: string) {
  if (cond) { console.log(`PASS: ${label}`); }
  else { console.error(`FAIL: ${label} (${detail})`); failed = true; }
}

function countIn(db: Database, cls: string, like: string): number {
  return db.exec(
    `SELECT COUNT(*) FROM classified WHERE classification='${cls}' AND "Transaction Description" LIKE '%${like}%'`
  )[0].values[0][0] as number;
}

async function main() {
  const db = await loadDatabase(path.join("data", "transactions.xlsx"));
  applyClassification(db);

  // 1. Merchant-spend total matches the contract.
  const total = merchantSpendTotal(db);
  check("merchant_spend total = 1510738.52", Math.abs(total - EXPECTED_SPEND) <= TOLERANCE, `got ${total}`);

  // 2. Merchant-spend row count is exact.
  const msRows = db.exec(`SELECT COUNT(*) FROM classified WHERE classification='merchant_spend'`)[0].values[0][0] as number;
  check(`merchant_spend row count = ${EXPECTED_MERCHANT_ROWS}`, msRows === EXPECTED_MERCHANT_ROWS, `got ${msRows}`);

  // 3. The two classes partition the whole table (no row lost or double-counted).
  const aaRows = db.exec(`SELECT COUNT(*) FROM classified WHERE classification='account_activity'`)[0].values[0][0] as number;
  check(`classes sum to ${EXPECTED_TOTAL_ROWS}`, msRows + aaRows === EXPECTED_TOTAL_ROWS, `got ${msRows + aaRows}`);

  // 4. Known account-activity types land in account_activity, never in merchant_spend.
  for (const t of ["CWB EFT PAYMENT", "INTEREST", "REDEMPTION"]) {
    const inAA = countIn(db, "account_activity", t);
    const inMS = countIn(db, "merchant_spend", t);
    check(`${t} present in account_activity`, inAA > 0, `account_activity count ${inAA}`);
    check(`${t} absent from merchant_spend`, inMS === 0, `merchant_spend count ${inMS}`);
  }

  // 5. CWB dollars do not leak into merchant_spend total.
  check("CWB EFT PAYMENT excluded from merchant_spend total", cwbPaymentTotalInMerchantSpend(db) === 0, "nonzero leak");

  db.close();
  if (failed) { console.error("Some classification checks FAILED."); process.exit(1); }
  console.log("All classification checks passed.");
}
main().catch((e) => { console.error("TEST ERROR:", e); process.exit(1); });