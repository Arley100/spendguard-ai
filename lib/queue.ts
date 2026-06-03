import { Database } from "sql.js";
import { duplicateCandidates, sameDayClusters, EvidenceRow } from "./risk";

// Operational MCCs: government services/permits (9399) and tolls/bridges (4784).
// A charge in these categories is fleet infrastructure, not a spend anomaly.
const OPERATIONAL_MCCS = new Set(["9399", "4784"]);

// Additive-only keyword fallback: catches an operational charge that carries an
// unexpected (non-9399/4784) MCC because of ragged coding. It can only ADD an
// operational flag, never rescue a charge from one. MCC stays authoritative.
const OPERATIONAL_KEYWORDS = ["PERMIT", "CROSSING", "TOLL", "DOT", "MOTOR CARRIER", "OSOW", "OS PERMIT"];

export type Tier = "high_risk" | "documentation_required" | "cleared";

export interface QueueItem {
  tier: Tier;
  kind: "duplicate" | "cluster" | "documentation";
  merchant: string;       // display name (raw for clusters, normalized key for dups)
  date: string;
  count: number;
  amount?: number;        // duplicates: the repeated charge amount
  total?: number;         // clusters: combined same-day amount
  mccs: string[];         // the MCC(s) behind this candidate
  operational: boolean;   // true if down-ranked as fleet operations
  reason: string;         // one-line explanation of why it is here
  rows: EvidenceRow[];    // evidence
}

export interface ReviewQueue {
  highRisk: QueueItem[];
  documentationRequired: { count: number };  // summary count only; the panel/queue shows the headline
  cleared: { count: number };
  caveat: string;
}

// Look up the distinct MCC(s) for a merchant + date group from the classified
// view. Risk candidates do not carry MCC; this keeps lib/risk.ts untouched.
function mccFor(db: Database, merchant: string, date: string): string[] {
  const res = db.exec(
    `SELECT DISTINCT "Merchant Category Code" FROM classified
     WHERE classification='merchant_spend'
       AND "Merchant Info DBA Name" = ? AND "Transaction Date" = ?;`,
    [merchant, date]
  );
  if (!res[0]) return [];
  return res[0].values.map((r) => String(r[0])).filter((m) => m && m !== "null");
}

function isOperational(mccs: string[], name: string): boolean {
  if (mccs.some((m) => OPERATIONAL_MCCS.has(m))) return true;
  const upper = name.toUpperCase();
  return OPERATIONAL_KEYWORDS.some((k) => upper.includes(k));
}

// Build the review queue. High-Risk holds duplicate-charge candidates and
// same-day clusters, with exact duplicates ranked above clusters, and within
// each, operational (permit/toll) repeats down-ranked below genuine merchants.
// Documentation Required and Cleared are reported as counts here; the over-$50
// detail lives in the policy panel and the slider.
export function buildReviewQueue(db: Database, debitsOver50Count: number, debitCount: number): ReviewQueue {
  const dups = duplicateCandidates(db);
  const clusters = sameDayClusters(db);

  const dupItems: QueueItem[] = dups.map((d) => {
    const lookupName = d.rows[0]?.merchant ?? d.merchant;
    const mccs = mccFor(db, lookupName, d.date);
    const operational = isOperational(mccs, lookupName);
    return {
      tier: "high_risk",
      kind: "duplicate",
      merchant: d.merchant,
      date: d.date,
      count: d.count,
      amount: d.amount,
      mccs,
      operational,
      reason: operational
        ? `${d.count} identical charges of the same amount on ${d.date}; coded as fleet operations (permits/tolls), so likely routine.`
        : `${d.count} identical charges of the same amount at the same merchant on ${d.date}; worth confirming this is not a double-charge.`,
      rows: d.rows,
    };
  });

  const clusterItems: QueueItem[] = clusters.map((c) => {
    const mccs = mccFor(db, c.merchant, c.date);
    const operational = isOperational(mccs, c.merchant);
    return {
      tier: "high_risk",
      kind: "cluster",
      merchant: c.merchant,
      date: c.date,
      count: c.count,
      total: c.total,
      mccs,
      operational,
      reason: operational
        ? `${c.count} charges at this merchant on ${c.date}; coded as fleet operations (permits/tolls), so likely routine repetition.`
        : `${c.count} charges at the same merchant on ${c.date}; worth a look to confirm the repetition is expected.`,
      rows: c.rows,
    };
  });

  // Ranking: duplicates above clusters (spec), and within each block,
  // non-operational above operational, then by count, then by amount/total.
  const rank = (items: QueueItem[]) =>
    items.sort((a, b) =>
      Number(a.operational) - Number(b.operational) ||
      b.count - a.count ||
      (b.amount ?? b.total ?? 0) - (a.amount ?? a.total ?? 0)
    );

  const highRisk = [...rank(dupItems), ...rank(clusterItems)];

  // Documentation Required (medium): debits over $50 that are not already in a
  // high-risk group. Reported as a count here; the policy panel and slider show
  // the threshold detail. (No per-row listing in this tier to avoid a 2,736-row
  // wall; the count is the operationally honest figure.)
  const documentationRequired = { count: debitsOver50Count };

  // Cleared (low): the remaining debits at or under $50.
  const cleared = { count: Math.max(0, debitCount - debitsOver50Count) };

  const caveat =
    "These are candidates surfaced for review, not findings. The statement has no employee, card, or timestamp data, so SpendGuard cannot tell whether same-day repeats are one card used several times or several cards at once. A person decides; the tool only surfaces and explains.";

  return { highRisk, documentationRequired, cleared, caveat };
}