import { QueryResult } from "./dispatch";

const money = (n: number) =>
  "$" + n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Stage 3, no-key path: deterministic templated narration. Reads numbers ONLY
// from the QueryResult (which came from the store in stage 2). Never introduces
// a figure that is not already in the result. This is the truth rule holding
// without a model: clear, precise, and never invented.
export function templateNarrate(result: QueryResult): string {
  const d = result.data as Record<string, unknown>;

  switch (result.metric) {
    case "total_spend": {
      const total = (d.total as number) ?? 0;
      return `Total merchant spend is ${money(total)} across the statement period.`;
    }

    case "spend_by_category": {
      if ("category" in d) {
        const cat = d.category as string;
        const row = d.row as { total: number; count: number } | null;
        if (!row) return `No spend found in the ${cat} category.`;
        return `${cat} spend is ${money(row.total)} across ${row.count} transactions.`;
      }
      const rows = (d.rows as { category: string; total: number; count: number }[]) ?? [];
      if (rows.length === 0) return "No category spend found.";
      const top = rows[0];
      return `The largest category is ${top.category} at ${money(top.total)} across ${top.count} transactions, out of ${rows.length} categories.`;
    }

    case "spend_by_month": {
      if ("month" in d) {
        const month = d.month as string;
        const row = d.row as { total: number; count: number } | null;
        if (!row) return `No spend found for ${month}.`;
        return `Spend in ${month} was ${money(row.total)} across ${row.count} transactions.`;
      }
      const rows = (d.rows as { month: string; total: number; count: number }[]) ?? [];
      if (rows.length === 0) return "No monthly spend found.";
      const peak = rows.reduce((a, b) => (b.total > a.total ? b : a), rows[0]);
      return `Spend spans ${rows.length} months, peaking in ${peak.month} at ${money(peak.total)}.`;
    }

    case "top_merchants": {
      const rows = (d.rows as { merchant: string; total: number; count: number }[]) ?? [];
      if (rows.length === 0) return "No merchants found.";
      const top = rows[0];
      return `The top merchant is ${top.merchant} at ${money(top.total)} across ${top.count} transactions.`;
    }

    case "policy_over_50": {
      const over = (d.over50Count as number) ?? 0;
      const debits = (d.debitCount as number) ?? 0;
      const pct = (d.percentage as number) ?? 0;
      return `${over} of ${debits} debits exceed $50, which is ${pct}% of charges.`;
    }

    case "duplicate_candidates": {
      const total = (d.totalGroups as number) ?? 0;
      const groups = (d.groups as { count: number; merchant: string; amount: number }[]) ?? [];
      if (total === 0) return "No duplicate-charge candidates were found.";
      const top = groups[0];
      return `${total} duplicate-charge candidate groups were found; the largest is ${top.count} identical charges of ${money(top.amount)} at ${top.merchant}. These are candidates for review, not accusations.`;
    }

    case "same_day_clusters": {
      const total = (d.totalGroups as number) ?? 0;
      const groups = (d.groups as { count: number; merchant: string; total: number }[]) ?? [];
      if (total === 0) return "No same-day merchant clusters were found.";
      const top = groups[0];
      return `${total} same-merchant same-day clusters were found; the largest is ${top.count} charges at ${top.merchant} totaling ${money(top.total)} in one day. These are candidates for review, not accusations.`;
    }

    case "unsupported":
    default:
      return "I can answer questions about total spend, spend by category, spend by month, top merchants, the policy threshold over $50, duplicate-charge candidates, and same-merchant same-day clusters.";
  }
}