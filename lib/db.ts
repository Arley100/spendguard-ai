import { Database } from "sql.js";
import { loadDatabase } from "./loader";
import { applyClassification } from "./classify";
import path from "path";

// The route handler must not reload and re-classify the 4147-row database on
// every request. Load it once, classify once, reuse. This is a module-level
// cache: the first call builds it, subsequent calls return the same instance.
let cached: Database | null = null;
let loading: Promise<Database> | null = null;

export async function getDb(): Promise<Database> {
  if (cached) return cached;
  if (loading) return loading;
  loading = (async () => {
    const db = await loadDatabase(path.join("data", "transactions.xlsx"));
    applyClassification(db);
    cached = db;
    return db;
  })();
  return loading;
}