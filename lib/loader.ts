import * as XLSX from "xlsx";
import initSqlJs, { Database } from "sql.js";
import { readFileSync } from "fs";
import path from "path";

export interface RawRow {
  [key: string]: string | number | null;
}

// Columns that hold dates and must be normalized to ISO (YYYY-MM-DD) so they
// sort and compare correctly. ISO is unambiguous and chronologically sortable.
const DATE_COLUMNS = ["Posting date of transaction", "Transaction Date"];

// Convert an Excel serial number or a date-like string to ISO YYYY-MM-DD.
// Returns the original value unchanged if it cannot be parsed as a date.
function toISO(value: string | number | null): string | number | null {
  if (value === null || value === "") return value;
  // Excel serial number path (numbers like 45875).
  if (typeof value === "number" || /^\d+(\.\d+)?$/.test(String(value))) {
    const n = Number(value);
    const parsed = XLSX.SSF.parse_date_code(n);
    if (parsed) {
      const mm = String(parsed.m).padStart(2, "0");
      const dd = String(parsed.d).padStart(2, "0");
      return `${parsed.y}-${mm}-${dd}`;
    }
  }
  // Fallback: try native Date parsing for string dates.
  const d = new Date(String(value));
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return value;
}

export function readRows(sourcePath: string): RawRow[] {
  const ext = path.extname(sourcePath).toLowerCase();
  let rows: RawRow[];
  if (ext === ".xlsx" || ext === ".xls") {
    const buf = readFileSync(sourcePath);
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    // raw: true keeps dates as serial numbers so we can convert them ourselves.
    rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: null, raw: true });
  } else if (ext === ".csv") {
    let text = readFileSync(sourcePath, "utf8");
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
    const wb = XLSX.read(text, { type: "string" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: null, raw: true });
  } else {
    throw new Error("Unsupported source format: " + ext);
  }

  for (const row of rows) {
    for (const col of DATE_COLUMNS) {
      if (col in row) row[col] = toISO(row[col]);
    }
  }
  return rows;
}

export async function loadDatabase(sourcePath: string): Promise<Database> {
  const rows = readRows(sourcePath);
  if (rows.length === 0) throw new Error("No rows read from " + sourcePath);

  const wasmPath = path.join(
    process.cwd(),
    "node_modules",
    "sql.js",
    "dist",
    "sql-wasm.wasm"
  );
  const wasmBuffer = readFileSync(wasmPath);
  const wasmBytes = new Uint8Array(wasmBuffer);
  const SQL = await initSqlJs({ wasmBinary: wasmBytes.buffer as ArrayBuffer });
  const db = new SQL.Database();

  const columns = Object.keys(rows[0]);
  const quoted = columns.map((c) => `"${c}" TEXT`).join(", ");
  db.run(`CREATE TABLE transactions (${quoted});`);

  const placeholders = columns.map(() => "?").join(", ");
  const stmt = db.prepare(`INSERT INTO transactions VALUES (${placeholders});`);
  for (const row of rows) {
    stmt.run(columns.map((c) => (row[c] === null ? null : String(row[c]))));
  }
  stmt.free();

  return db;
}