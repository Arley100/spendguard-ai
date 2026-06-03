import { Database } from "sql.js";

// MCC to human label. Only codes we can label confidently are mapped;
// everything else is bucketed as "Other" rather than guessing.
const MCC_LABELS: Record<string, string> = {
  "5541": "Fuel", "5542": "Fuel",
  "9399": "Permits and Government",
  "5532": "Tires",
  "7538": "Auto Service", "7549": "Auto Service",
  "7542": "Car Washes",
  "5533": "Auto Parts",
  "5045": "Equipment and Supplies", "5046": "Equipment and Supplies", "5085": "Equipment and Supplies",
  "4816": "Network and Information Services",
  "4121": "Tolls and Transport", "4784": "Tolls and Transport",
  "5561": "Trailers",
  "5511": "Auto Dealers",
  "5817": "Software", "5211": "Building Supplies",
  "5812": "Dining", "5814": "Dining",
};

export function labelForMcc(mcc: string | null): string {
  if (mcc === null) return "Other";
  return MCC_LABELS[mcc] ?? "Other";
}

export interface CategoryRow { category: string; total: number; count: number; }
export interface MonthRow { month: string; total: number; count: number; }
export interface MerchantRow { merchant: string; total: number; count: number; }

// Total merchant spend (CAD).
export function totalSpend(db: Database): number {
  const r = db.exec(`
    SELECT ROUND(SUM(CAST("Transaction Amount" AS REAL)), 2)
    FROM classified WHERE classification = 'merchant_spend';
  `);
  return (r[0]?.values[0][0] as number) ?? 0;
}

// Spend grouped by human category label (via MCC). Sorted high to low.
export function spendByCategory(db: Database): CategoryRow[] {
  const r = db.exec(`
    SELECT "Merchant Category Code" AS mcc,
           ROUND(SUM(CAST("Transaction Amount" AS REAL)), 2) AS total,
           COUNT(*) AS n
    FROM classified WHERE classification = 'merchant_spend'
    GROUP BY mcc;
  `);
  if (!r[0]) return [];
  // Fold MCCs into labels (several codes share a label).
  const byLabel = new Map<string, { total: number; count: number }>();
  for (const row of r[0].values) {
    const label = labelForMcc(row[0] as string | null);
    const cur = byLabel.get(label) ?? { total: 0, count: 0 };
    cur.total += row[1] as number;
    cur.count += row[2] as number;
    byLabel.set(label, cur);
  }
  return [...byLabel.entries()]
    .map(([category, v]) => ({ category, total: Math.round(v.total * 100) / 100, count: v.count }))
    .sort((a, b) => b.total - a.total);
}

// Spend grouped by calendar month (YYYY-MM), chronological.
export function spendByMonth(db: Database): MonthRow[] {
  const r = db.exec(`
    SELECT substr("Transaction Date", 1, 7) AS month,
           ROUND(SUM(CAST("Transaction Amount" AS REAL)), 2) AS total,
           COUNT(*) AS n
    FROM classified WHERE classification = 'merchant_spend'
    GROUP BY month ORDER BY month;
  `);
  if (!r[0]) return [];
  return r[0].values.map((row) => ({ month: row[0] as string, total: row[1] as number, count: row[2] as number }));
}

// Normalize a raw DBA name for grouping: uppercase, strip store numbers
// (#1234 and trailing digit runs), collapse whitespace. Best-effort, not exact.
export function normalizeMerchant(name: string): string {
  return name
    .toUpperCase()
    .replace(/#\s*\d+/g, " ")      // "#0687" store numbers
    .replace(/\s+\d{3,}\b/g, " ")  // trailing digit runs like "PILOT 4619"
    .replace(/\s+/g, " ")
    .trim();
}

// Top N merchants by normalized name, by total spend.
export function topMerchants(db: Database, n = 10): MerchantRow[] {
  const r = db.exec(`
    SELECT "Merchant Info DBA Name" AS name,
           CAST("Transaction Amount" AS REAL) AS amt
    FROM classified WHERE classification = 'merchant_spend';
  `);
  if (!r[0]) return [];
  const byMerchant = new Map<string, { total: number; count: number }>();
  for (const row of r[0].values) {
    const norm = normalizeMerchant(row[0] as string);
    const cur = byMerchant.get(norm) ?? { total: 0, count: 0 };
    cur.total += row[1] as number;
    cur.count += 1;
    byMerchant.set(norm, cur);
  }
  return [...byMerchant.entries()]
    .map(([merchant, v]) => ({ merchant, total: Math.round(v.total * 100) / 100, count: v.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, n);
}