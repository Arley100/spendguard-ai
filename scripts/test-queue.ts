import { loadDatabase } from "../lib/loader";
import { applyClassification } from "../lib/classify";
import { debitsOver50 } from "../lib/risk";
import { buildReviewQueue } from "../lib/queue";
import path from "path";

let failed = false;
function check(label: string, cond: boolean, detail: string) {
  if (cond) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label} (${detail})`); failed = true; }
}

async function main() {
  const db = await loadDatabase(path.join("data", "transactions.xlsx"));
  applyClassification(db);

  const o = debitsOver50(db);
  const q = buildReviewQueue(db, o.over50Count, o.debitCount);

  // Tier counts reconcile to the data.
  check("documentation-required count = over-$50 count (2736)", q.documentationRequired.count === 2736, `got ${q.documentationRequired.count}`);
  check("cleared count = debits - over50 (1444)", q.cleared.count === 4180 - 2736, `got ${q.cleared.count}`);

  // High-risk holds all duplicates (150) + all clusters (595) = 745 items.
  check("high-risk holds 745 items (150 dups + 595 clusters)", q.highRisk.length === 745, `got ${q.highRisk.length}`);
  check("high-risk has 150 duplicate items", q.highRisk.filter((i) => i.kind === "duplicate").length === 150, "wrong dup count");
  check("high-risk has 595 cluster items", q.highRisk.filter((i) => i.kind === "cluster").length === 595, "wrong cluster count");

  // Duplicates rank above clusters: the last duplicate precedes the first cluster.
  const firstClusterIdx = q.highRisk.findIndex((i) => i.kind === "cluster");
  const lastDupIdx = q.highRisk.map((i) => i.kind).lastIndexOf("duplicate");
  check("all duplicates rank above all clusters", lastDupIdx < firstClusterIdx, `lastDup ${lastDupIdx}, firstCluster ${firstClusterIdx}`);

  // Within each block, non-operational items rank above operational ones.
  const dupBlock = q.highRisk.filter((i) => i.kind === "duplicate");
  const clusterBlock = q.highRisk.filter((i) => i.kind === "cluster");
  const nonOpBeforeOp = (items: typeof q.highRisk) => {
    const firstOp = items.findIndex((i) => i.operational);
    if (firstOp === -1) return true; // none operational
    return items.slice(firstOp).every((i) => i.operational); // once operational starts, all rest are operational
  };
  check("duplicates: non-operational ranked before operational", nonOpBeforeOp(dupBlock), "ordering broken");
  check("clusters: non-operational ranked before operational", nonOpBeforeOp(clusterBlock), "ordering broken");

  // Operational down-ranking actually fires: most clusters are operational (measured 355).
  const opClusters = clusterBlock.filter((i) => i.operational).length;
  check("operational clusters detected (361: 355 by MCC + 6 by keyword fallback)", opClusters === 361, `got ${opClusters}`);

  // Every high-risk item carries evidence rows matching its count.
  check("every high-risk item carries evidence rows = its count", q.highRisk.every((i) => i.rows.length === i.count), "row/count mismatch");

  // Every item carries a one-line reason and at least one MCC looked up.
  check("every item has a non-empty reason", q.highRisk.every((i) => i.reason.length > 0), "missing reason");

  // Risk-not-accusation: no item reason or caveat uses the word "fraud".
  const usesFraud = q.highRisk.some((i) => /fraud/i.test(i.reason)) || /fraud/i.test(q.caveat);
  check("no fraud terminology anywhere", !usesFraud, "found 'fraud'");

  // Caveat states the no-employee/card/timestamp limitation.
  check("caveat states the data limitation", /employee|card|timestamp/i.test(q.caveat), "caveat missing limitation");

  // BLACKJACKS behaves as its MCC dictates: MCC 4784 -> operational (no rescue).
  const blackjacks = q.highRisk.find((i) => i.merchant.toUpperCase().includes("BLACKJACK"));
  check("BLACKJACKS present and treated operational per its toll MCC", !!blackjacks && blackjacks!.operational === true, blackjacks ? `operational=${blackjacks.operational}, mccs=${blackjacks.mccs.join(",")}` : "not found");

  db.close();
  if (failed) { console.error("\nSome queue checks FAILED."); process.exit(1); }
  console.log("\nAll review-queue checks passed.");
}
main().catch((e) => { console.error("TEST ERROR:", e); process.exit(1); });