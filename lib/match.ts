import { Intent } from "./intent";

// Stage 1, no-key path: a small, deterministic keyword matcher. It maps obvious
// questions to a metric and returns "unsupported" for anything it does not
// confidently recognize (which yields the capability menu). It is NOT trying to
// be smart; it is trying to be precise-or-honest: a correct answer for clear
// questions, an honest "here is what I can answer" for everything else. The
// keyed AI parser handles the broad phrasing this cannot.
//
// Rules are checked in order; the first confident match wins. More specific
// patterns (duplicates, clusters, policy) are checked before broad ones
// (category, month) so a question like "duplicate fuel charges" routes to
// duplicates, not category.

const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
};

// Known category labels the matcher can filter on (mirrors lib/queries labels).
const CATEGORY_WORDS: Record<string, string> = {
  fuel: "Fuel",
  permit: "Permits and Government",
  government: "Permits and Government",
  tire: "Tires",
  "auto service": "Auto Service",
  "car wash": "Car Washes",
  "auto part": "Auto Parts",
  toll: "Tolls and Transport",
  trailer: "Trailers",
  dining: "Dining",
};

export function matchIntent(question: string): Intent {
  const q = question.toLowerCase().trim();
  if (q.length === 0) return { metric: "unsupported" };

  // --- Specific risk / policy patterns first ---

  if (/\bduplicate|double charge|charged twice|same charge\b/.test(q)) {
    return { metric: "duplicate_candidates" };
  }

  if (/\bsame day|same-day|repeat merchant|multiple charges|clusters?\b/.test(q)) {
    return { metric: "same_day_clusters" };
  }

  if (/\bover \$?50|policy|pre-?auth|threshold|receipt\b/.test(q)) {
    return { metric: "policy_over_50" };
  }

  if (/\btop merchant|biggest merchant|largest merchant|top vendor|which merchant|biggest vendor\b/.test(q)) {
    return { metric: "top_merchants" };
  }

  // --- Month: explicit month name implies a monthly view, optionally filtered ---

  for (const [name, num] of Object.entries(MONTHS)) {
    if (q.includes(name)) {
      // Try to find a year nearby; default to no filter (whole-month breakdown)
      const yearMatch = q.match(/20(\d{2})/);
      if (yearMatch) {
        return { metric: "spend_by_month", monthFilter: `20${yearMatch[1]}-${num}` };
      }
      return { metric: "spend_by_month" };
    }
  }

  if (/\bby month|monthly|over time|trend|each month|per month\b/.test(q)) {
    return { metric: "spend_by_month" };
  }

  // --- Category: a known category word implies a filtered category view ---

  for (const [word, label] of Object.entries(CATEGORY_WORDS)) {
    if (q.includes(word)) {
      return { metric: "spend_by_category", categoryFilter: label };
    }
  }

  if (/\bby category|categories|breakdown|what did we spend on\b/.test(q)) {
    return { metric: "spend_by_category" };
  }

  // --- Total spend (broad, checked late so it does not swallow specifics) ---

  if (/\btotal|overall|how much.*spend|total spend|grand total|all spend\b/.test(q)) {
    return { metric: "total_spend" };
  }

  // Nothing matched confidently: be honest, not wrong.
  return { metric: "unsupported" };
}