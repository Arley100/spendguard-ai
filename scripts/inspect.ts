import { loadDatabase } from "../lib/loader";
import path from "path";

async function main() {
  const source = process.argv[2] ?? path.join("data", "transactions.xlsx");
  console.log("Loading:", source);

  const db = await loadDatabase(source);

  const total = db.exec("SELECT COUNT(*) AS n FROM transactions")[0].values[0][0];
  console.log("Total rows:", total);

  const dates = db.exec(
    `SELECT MIN("Transaction Date") AS min, MAX("Transaction Date") AS max FROM transactions`
  )[0].values[0];
  console.log("Date range:", dates[0], "->", dates[1]);

  const dc = db.exec(
    `SELECT "Debit or Credit" AS k, COUNT(*) AS n FROM transactions GROUP BY "Debit or Credit"`
  )[0].values;
  console.log("Debit/Credit counts:", JSON.stringify(dc));

  db.close();
}

main().catch((e) => {
  console.error("INSPECT FAILED:", e);
  process.exit(1);
});