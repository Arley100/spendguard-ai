import { Database } from "sql.js";

// Classification per SPEC Section 4:
//   merchant_spend   = a Debit row that has a Merchant Category Code (MCC)
//   account_activity = everything else (card payments, fees, interest, redemptions)
// Implemented as a VIEW so the raw `transactions` table stays a faithful load.
export function applyClassification(db: Database): void {
  db.run(`
    CREATE VIEW IF NOT EXISTS classified AS
    SELECT
      *,
      CASE
        WHEN "Debit or Credit" = 'Debit'
         AND "Merchant Category Code" IS NOT NULL
         AND "Merchant Category Code" != ''
        THEN 'merchant_spend'
        ELSE 'account_activity'
      END AS classification
    FROM transactions;
  `);
}

// Total merchant-spend amount (CAD). Pulls only from the merchant_spend class.
export function merchantSpendTotal(db: Database): number {
  const r = db.exec(`
    SELECT ROUND(SUM(CAST("Transaction Amount" AS REAL)), 2)
    FROM classified
    WHERE classification = 'merchant_spend';
  `);
  return r[0].values[0][0] as number;
}

// Total of CWB EFT PAYMENT rows, used to confirm they are NOT in merchant_spend.
export function cwbPaymentTotalInMerchantSpend(db: Database): number {
  const r = db.exec(`
    SELECT COALESCE(ROUND(SUM(CAST("Transaction Amount" AS REAL)), 2), 0)
    FROM classified
    WHERE classification = 'merchant_spend'
      AND "Transaction Description" LIKE '%CWB EFT PAYMENT%';
  `);
  return r[0].values[0][0] as number;
}