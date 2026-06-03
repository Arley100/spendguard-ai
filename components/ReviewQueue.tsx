"use client";

import { useState } from "react";
import styles from "./ReviewQueue.module.css";
import type { QueueItem } from "../lib/queue";

interface ReviewQueueProps {
  highRisk: QueueItem[];
  documentationCount: number;
  clearedCount: number;
  caveat: string;
}

const money = (n: number) =>
  "$" + n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n: number) => n.toLocaleString("en-CA");

const VISIBLE = 25;

export default function ReviewQueue({ highRisk, documentationCount, clearedCount, caveat }: ReviewQueueProps) {
  const [open, setOpen] = useState<number | null>(null);
  const shown = highRisk.slice(0, VISIBLE);
  const remaining = highRisk.length - shown.length;

  return (
    <div className={styles.panel}>
      <div className={styles.heading}>Review queue</div>
      <div className={styles.sub}>
        Every debit routed to one of three tiers. Most spend clears automatically; only genuine
        outliers reach a person.
      </div>

      <div className={styles.tierRow}>
        <div className={`${styles.tierCard} ${styles.tierCardCleared}`}>
          <div className={`${styles.tierLabel} ${styles.tierLabelCleared}`}>Cleared</div>
          <div className={styles.tierCount}>{fmtInt(clearedCount)}</div>
          <div className={styles.tierDesc}>At or under $50; auto-cleared.</div>
        </div>
        <div className={`${styles.tierCard} ${styles.tierCardDoc}`}>
          <div className={`${styles.tierLabel} ${styles.tierLabelDoc}`}>Documentation required</div>
          <div className={styles.tierCount}>{fmtInt(documentationCount)}</div>
          <div className={styles.tierDesc}>Over $50; policy wants a receipt or pre-auth.</div>
        </div>
        <div className={`${styles.tierCard} ${styles.tierCardHigh}`}>
          <div className={`${styles.tierLabel} ${styles.tierLabelHigh}`}>High-risk review</div>
          <div className={styles.tierCount}>{fmtInt(highRisk.length)}</div>
          <div className={styles.tierDesc}>Duplicate and same-day repeat candidates.</div>
        </div>
      </div>

      <div className={styles.caveat}>{caveat}</div>

      <div className={styles.queueListLabel}>High-risk review: top {shown.length} candidates</div>

      {shown.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className={styles.item}>
            <button className={styles.itemHeader} onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen}>
              <span className={`${styles.badge} ${item.kind === "duplicate" ? styles.badgeDup : styles.badgeCluster}`}>
                {item.kind === "duplicate" ? "Duplicate" : "Same-day"}
              </span>
              {item.operational && <span className={`${styles.badge} ${styles.badgeOp}`}>Fleet ops</span>}
              <span className={styles.itemMerchant}>{item.merchant}</span>
              <span className={styles.itemMeta}>
                {item.count}x &middot; {item.date}
                {item.amount !== undefined ? ` · ${money(item.amount)} each` : ""}
                {item.total !== undefined ? ` · ${money(item.total)} total` : ""}
              </span>
            </button>
            {isOpen && (
              <div className={styles.itemBody}>
                <p className={styles.itemReason}>{item.reason}</p>
                <table className={styles.evidenceTable}>
                  <thead>
                    <tr>
                      <th>Merchant (raw)</th>
                      <th>Date</th>
                      <th style={{ textAlign: "right" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.rows.map((r, j) => (
                      <tr key={j}>
                        <td>{r.merchant}</td>
                        <td>{r.date}</td>
                        <td className={styles.num}>{money(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {remaining > 0 && (
        <div className={styles.moreNote}>
          {fmtInt(remaining)} more high-risk candidates not shown. The top of the queue is what a
          reviewer works first; operational permit and toll repeats are ranked to the bottom.
        </div>
      )}
    </div>
  );
}