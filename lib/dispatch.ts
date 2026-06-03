import { Database } from "sql.js";
import { Intent } from "./intent";
import { totalSpend, spendByCategory, spendByMonth, topMerchants } from "./queries";
import { debitsOver50, duplicateCandidates, sameDayClusters } from "./risk";

export interface QueryResult {
  metric: Intent["metric"];
  kind: "single" | "breakdown" | "ranked" | "policy" | "risk_groups" | "none";
  data: unknown;
  label: string;
}

// Stage 2 of the truth rule: given a validated intent, run the matching
// deterministic query. EVERY number the system reports originates here, from
// the store, never from the model. The model only chose which metric to run.
export function dispatch(db: Database, intent: Intent): QueryResult {
  switch (intent.metric) {
    case "total_spend": {
      const total = totalSpend(db);
      return { metric: intent.metric, kind: "single", data: { total }, label: "total merchant spend" };
    }

    case "spend_by_category": {
      const cats = spendByCategory(db);
      if (intent.categoryFilter) {
        const wanted = intent.categoryFilter.toLowerCase();
        const hit = cats.find((c) => c.category.toLowerCase() === wanted);
        return {
          metric: intent.metric,
          kind: "single",
          data: { category: intent.categoryFilter, row: hit ?? null },
          label: `spend in ${intent.categoryFilter}`,
        };
      }
      return { metric: intent.metric, kind: "breakdown", data: { rows: cats }, label: "spend by category" };
    }

    case "spend_by_month": {
      const months = spendByMonth(db);
      if (intent.monthFilter) {
        const hit = months.find((m) => m.month === intent.monthFilter);
        return {
          metric: intent.metric,
          kind: "single",
          data: { month: intent.monthFilter, row: hit ?? null },
          label: `spend in ${intent.monthFilter}`,
        };
      }
      return { metric: intent.metric, kind: "breakdown", data: { rows: months }, label: "spend by month" };
    }

    case "top_merchants": {
      const n = intent.limit ?? 10;
      const rows = topMerchants(db, n);
      return { metric: intent.metric, kind: "ranked", data: { rows }, label: `top ${n} merchants` };
    }

    case "policy_over_50": {
      const r = debitsOver50(db);
      return { metric: intent.metric, kind: "policy", data: r, label: "charges over $50" };
    }

    case "duplicate_candidates": {
      const n = intent.limit ?? 10;
      const all = duplicateCandidates(db);
      return {
        metric: intent.metric,
        kind: "risk_groups",
        data: { groups: all.slice(0, n), totalGroups: all.length },
        label: "duplicate-charge candidates",
      };
    }

    case "same_day_clusters": {
      const n = intent.limit ?? 10;
      const all = sameDayClusters(db);
      return {
        metric: intent.metric,
        kind: "risk_groups",
        data: { groups: all.slice(0, n), totalGroups: all.length },
        label: "same-merchant same-day clusters",
      };
    }

    case "unsupported":
    default:
      return { metric: "unsupported", kind: "none", data: null, label: "unsupported" };
  }
}