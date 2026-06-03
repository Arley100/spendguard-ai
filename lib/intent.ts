// The closed set of everything talk-to-data can answer. Both the AI parser
// (keyed) and the keyword matcher (no-key) must produce one of these. Anything
// outside this set is "unsupported" and gets a graceful capability message.
// This enum is the contract between question understanding (stage 1) and the
// deterministic query layer (stage 2). The model may choose a metric; it may
// never invent one, and it never computes the result.

export type Metric =
  | "total_spend"
  | "spend_by_category"
  | "spend_by_month"
  | "top_merchants"
  | "policy_over_50"
  | "duplicate_candidates"
  | "same_day_clusters"
  | "unsupported";

export const ALLOWED_METRICS: Metric[] = [
  "total_spend",
  "spend_by_category",
  "spend_by_month",
  "top_merchants",
  "policy_over_50",
  "duplicate_candidates",
  "same_day_clusters",
  "unsupported",
];

// Optional, validated parameters. Anything the model returns that is not in the
// allowed shape is dropped, never trusted blindly.
export interface Intent {
  metric: Metric;
  categoryFilter?: string;   // for spend_by_category, e.g. "Fuel"
  monthFilter?: string;      // for spend_by_month, "YYYY-MM"
  limit?: number;            // for top_merchants / duplicates / clusters
}

// Validate and sanitize a raw intent object (from the model or the matcher).
// Returns a clean Intent or an unsupported intent if it cannot be trusted.
export function validateIntent(raw: unknown): Intent {
  if (typeof raw !== "object" || raw === null) return { metric: "unsupported" };
  const obj = raw as Record<string, unknown>;
  const metric = obj.metric;
  if (typeof metric !== "string" || !ALLOWED_METRICS.includes(metric as Metric)) {
    return { metric: "unsupported" };
  }
  const intent: Intent = { metric: metric as Metric };

  if (typeof obj.categoryFilter === "string" && obj.categoryFilter.length <= 60) {
    intent.categoryFilter = obj.categoryFilter;
  }
  if (typeof obj.monthFilter === "string" && /^\d{4}-\d{2}$/.test(obj.monthFilter)) {
    intent.monthFilter = obj.monthFilter;
  }
  if (typeof obj.limit === "number" && Number.isInteger(obj.limit) && obj.limit > 0 && obj.limit <= 50) {
    intent.limit = obj.limit;
  }

  return intent;
}