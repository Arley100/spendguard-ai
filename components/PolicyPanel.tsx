import type { ReactNode } from "react";
import styles from "./PolicyPanel.module.css";

interface PolicyPanelProps {
  over50Count: number;
  debitCount: number;
  percentage: number;
  slider?: ReactNode;
}

// Rules stated verbatim in substance from the Brim expense policy document.
// Only the $50 rule is measurable from transaction data; the rest are stated
// as policy with an honest marker that the data cannot verify them.
const OTHER_RULES: { rule: string; note: string }[] = [
  {
    rule: "Receipts are required before any expense is reimbursed.",
    note: "Not measurable: the statement has no receipt records.",
  },
  {
    rule: "Corporate cards may not be used for personal expenses.",
    note: "Not measurable: no personal-vs-business label in the data.",
  },
  {
    rule: "Alcohol is not reimbursable unless dining with a customer.",
    note: "Not measurable: no line-item or attendee detail in the data.",
  },
  {
    rule: "Tips may be expensed up to 15% for services and 20% for meals.",
    note: "Not measurable: tips are not itemized in the data.",
  },
  {
    rule: "Traffic and parking tickets and personal-use rentals are never reimbursed.",
    note: "Not measurable: no infraction or rental-purpose detail in the data.",
  },
];

export default function PolicyPanel({ over50Count, debitCount, percentage, slider }: PolicyPanelProps) {
  const fmt = (n: number) => n.toLocaleString("en-CA");
  return (
    <div className={styles.panel}>
      <div className={styles.heading}>Policy reality check</div>
      <div className={styles.sub}>
        Brim&apos;s written expense policy against what the statement actually shows.
      </div>

      <div className={styles.realityBlock}>
        <div className={styles.realityRule}>
          Policy: expenses over $50 require manager pre-authorization
        </div>
        <div className={styles.realityStat}>
          <span className={styles.realityPct}>{percentage}%</span>
          <span className={styles.realityCount}>
            of charges ({fmt(over50Count)} of {fmt(debitCount)} debits) exceed $50
          </span>
        </div>
        <div className={styles.realityImplication}>
          Applied literally, the rule would require manager pre-authorization on roughly
          two-thirds of every transaction this fleet makes. That gap between the written
          control and operational reality is what a finance team needs to see and decide on.
        </div>
      </div>

      <div className={styles.rulesLabel}>Other stated policy rules</div>
      <ul className={styles.ruleList}>
        {OTHER_RULES.map((r) => (
          <li key={r.rule} className={styles.ruleItem}>
            {r.rule}
            <span className={styles.ruleNote}>{r.note}</span>
          </li>
        ))}
      </ul>

      <div className={styles.sourceNote}>
        Rules sourced from the Brim expense policy document provided with the challenge.
        Only the $50 threshold is measurable from the transaction data; the others are
        stated for completeness and marked as not measurable from this dataset alone.
      </div>
      {slider}
    </div>
  );
}