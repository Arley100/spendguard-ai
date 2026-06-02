import { loadDatabase } from "../lib/loader";
import { applyClassification, merchantSpendTotal, cwbPaymentTotalInMerchantSpend } from "../lib/classify";
import path from "path";

const EXPECTED_SPEND = 1510738.52;
const TOLERANCE = 0.01;

async function main() {
  const db = await loadDatabase(path.join("data", "transactions.xlsx"));
  applyClassification(db);

  let failed = false;

  const total = merchantSpendTotal(db);
  if (Math.abs(total - EXPECTED_SPEND) > TOLERANCE) {
    console.error(`FAIL: merchant_spend total ${total} != expected ${EXPECTED_SPEND}`);
    failed = true;
  } else {
    console.log(`PASS: merchant_spend total = ${total}`);
  }

  const cwbInSpend = cwbPaymentTotalInMerchantSpend(db);
  if (cwbInSpend !== 0) {
    console.error(`FAIL: CWB EFT PAYMENT leaked into merchant_spend: ${cwbInSpend}`);
    failed = true;
  } else {
    console.log("PASS: CWB EFT PAYMENT excluded from merchant_spend");
  }

  db.close();
  if (failed) process.exit(1);
  console.log("All classification checks passed.");
}
main().catch((e) => { console.error("TEST ERROR:", e); process.exit(1); });