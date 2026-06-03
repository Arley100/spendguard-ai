import { Database } from "sql.js";
import { normalizeMerchant } from "./queries";

export interface EvidenceRow {
  merchant: string;   // raw DBA name, preserved for transparency
  amount: number;
  date: string;
  description: string;
}

export interface Over50Result {
  debitCount: number;
  over50Count: number;
  percentage: number; // share of debits over $50, one decimal
}

export interface DuplicateGroup {
  merchant: string;      // normalized merchant key
  amount: number;
  date: string;
  count: number;
  rawNames: string[];    // distinct raw DBA names folded into this group
  rows: EvidenceRow[];
}

export interface ClusterGroup {
  merchant: string;      // raw DBA name (tighter: same physical location)
  date: string;
  count: number;
  total: number;
  rows: EvidenceRow[];
}

// Share of Debits over $50. Computed on ALL debits per Ticket 5 ("Debits over
// $50", target 2736 of 4180). Feeds the policy-reality panel; the Brim policy
// applies to charges, so the debit denominator is the correct one.
export function debitsOver50(db: Database): Over50Result {
  const debitCount = db.exec(
    `SELECT COUNT(*) FROM transactions WHERE "Debit or Credit" = 'Debit'`
  )[0].values[0][0] as number;
  const over50Count = db.exec(
    `SELECT COUNT(*) FROM transactions WHERE "Debit or Credit" = 'Debit' AND CAST("Transaction Amount" AS REAL) > 50`
  )[0].values[0][0] as number;
  const percentage = Math.round((over50Count / debitCount) * 1000) / 10;
  return { debitCount, over50Count, percentage };
}

// Exact-duplicate candidates per Ticket 5: identical NORMALIZED merchant +
// amount + date, among merchant purchases. Normalizing folds store-number
// variants of one chain together; raw names are preserved in evidence and in
// rawNames so a reviewer sees exactly what was merged. Candidates for review.
export function duplicateCandidates(db: Database): DuplicateGroup[] {
  const all = db.exec(`
    SELECT "Merchant Info DBA Name", CAST("Transaction Amount" AS REAL),
           "Transaction Date", "Transaction Description"
    FROM classified WHERE classification = 'merchant_spend';
  `);
  if (!all[0]) return [];

  const groups = new Map<string, { merchant: string; amount: number; date: string; rows: EvidenceRow[]; rawNames: Set<string> }>();
  for (const r of all[0].values) {
    const raw = r[0] as string;
    const amount = r[1] as number;
    const date = r[2] as string;
    const norm = normalizeMerchant(raw);
    const key = `${norm}|${amount}|${date}`;
    const g = groups.get(key) ?? { merchant: norm, amount, date, rows: [], rawNames: new Set<string>() };
    g.rows.push({ merchant: raw, amount, date, description: r[3] as string });
    g.rawNames.add(raw);
    groups.set(key, g);
  }

  return [...groups.values()]
    .filter((g) => g.rows.length >= 2)
    .map((g) => ({
      merchant: g.merchant,
      amount: g.amount,
      date: g.date,
      count: g.rows.length,
      rawNames: [...g.rawNames],
      rows: g.rows,
    }))
    .sort((a, b) => b.count - a.count || b.amount - a.amount);
}

// Same-merchant same-day clusters: 2+ charges at one RAW merchant (same
// physical location) on one day, among merchant purchases. Raw grouping is
// deliberate: normalizing chains would merge different truck-stop locations
// visited the same day, which is normal fleet route behavior, not a signal.
// Weaker than exact duplicates; ranked below them. Candidates, not accusations.
export function sameDayClusters(db: Database): ClusterGroup[] {
  const all = db.exec(`
    SELECT "Merchant Info DBA Name", CAST("Transaction Amount" AS REAL),
           "Transaction Date", "Transaction Description"
    FROM classified WHERE classification = 'merchant_spend';
  `);
  if (!all[0]) return [];

  const groups = new Map<string, { merchant: string; date: string; rows: EvidenceRow[] }>();
  for (const r of all[0].values) {
    const raw = r[0] as string;
    const date = r[2] as string;
    const key = `${raw}|${date}`;
    const g = groups.get(key) ?? { merchant: raw, date, rows: [] };
    g.rows.push({ merchant: raw, amount: r[1] as number, date, description: r[3] as string });
    groups.set(key, g);
  }

  return [...groups.values()]
    .filter((g) => g.rows.length >= 2)
    .map((g) => ({
      merchant: g.merchant,
      date: g.date,
      count: g.rows.length,
      total: Math.round(g.rows.reduce((s, r) => s + r.amount, 0) * 100) / 100,
      rows: g.rows,
    }))
    .sort((a, b) => b.count - a.count || b.total - a.total);
}
// Policy-simulation curve: for each $10 step from $50 to $500, the number of
// Debits strictly over that threshold. Every value is computed by the store
// (same strict > comparison as debitsOver50), so the slider only ever displays
// store-computed counts; the client interpolates nothing, it looks up.
export interface ThresholdPoint {
  threshold: number;
  count: number;
}

export function thresholdCurve(db: Database): ThresholdPoint[] {
  const points: ThresholdPoint[] = [];
  for (let t = 50; t <= 500; t += 10) {
    const c = db.exec(
      `SELECT COUNT(*) FROM transactions
       WHERE "Debit or Credit" = 'Debit' AND CAST("Transaction Amount" AS REAL) > ?`,
      [t]
    )[0].values[0][0] as number;
    points.push({ threshold: t, count: c });
  }
  return points;
}