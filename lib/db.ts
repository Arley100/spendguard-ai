import { Database } from "sql.js";
import { loadDatabase } from "./loader";
import { applyClassification } from "./classify";
import fs from "fs";
import path from "path";

// The route handler must not reload and re-classify the database on every
// request. Load once, classify once, reuse (module-level cache).
//
// Data source selection: locally the real first-party statement
// (data/transactions.xlsx) is present and used. It is gitignored and never
// deployed, so on the public deployment it is absent; there we fall back to the
// committed synthetic dataset (data/synthetic_transactions.csv). This keeps the
// real data private while keeping the public demo functional. The synthetic
// data is clearly labelled as such in the UI.
let cached: Database | null = null;
let loading: Promise<Database> | null = null;

function dataPath(): string {
  const real = path.join(process.cwd(), "data", "transactions.xlsx");
  if (fs.existsSync(real)) return real;
  return path.join(process.cwd(), "data", "synthetic_transactions.csv");
}

export async function getDb(): Promise<Database> {
  if (cached) return cached;
  if (loading) return loading;
  loading = (async () => {
    const db = await loadDatabase(dataPath());
    applyClassification(db);
    cached = db;
    return db;
  })();
  return loading;
}

// Whether the live data is the real statement (true) or synthetic demo data
// (false). The UI uses this to show a "synthetic data" notice on the public
// deployment.
export function isRealData(): boolean {
  return fs.existsSync(path.join(process.cwd(), "data", "transactions.xlsx"));
}