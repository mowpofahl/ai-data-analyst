import * as duckdb from "@duckdb/duckdb-wasm";

// One DuckDB instance per browser tab, running entirely on the user's device.
// Engine files are served from /duckdb (see scripts/copy-duckdb.mjs).
let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null;

export const TABLE_NAME = "data";

const BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: "/duckdb/duckdb-mvp.wasm",
    mainWorker: "/duckdb/duckdb-browser-mvp.worker.js",
  },
  eh: {
    mainModule: "/duckdb/duckdb-eh.wasm",
    mainWorker: "/duckdb/duckdb-browser-eh.worker.js",
  },
};

async function createDb(): Promise<duckdb.AsyncDuckDB> {
  const bundle = await duckdb.selectBundle(BUNDLES);
  const worker = new Worker(bundle.mainWorker!);
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  return db;
}

export function getDb(): Promise<duckdb.AsyncDuckDB> {
  if (!dbPromise) {
    dbPromise = createDb().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

export type Row = Record<string, unknown>;

export interface QueryResult {
  columns: string[];
  rows: Row[];
}

type ColumnFormat = "date" | "timestamp" | null;

// Arrow gives dates and timestamps back as epoch milliseconds.
function formatOf(arrowType: string): ColumnFormat {
  if (arrowType.startsWith("Date")) return "date";
  if (arrowType.startsWith("Timestamp")) return "timestamp";
  return null;
}

// Convert DuckDB/Arrow values into plain JSON-friendly values: BigInt to number,
// dates to ISO strings.
function normalize(value: unknown, format: ColumnFormat): unknown {
  if (value == null) return null;
  if (typeof value === "bigint") value = Number(value);
  if (format && typeof value === "number") {
    const iso = new Date(value).toISOString();
    return format === "date" ? iso.slice(0, 10) : iso.replace("T", " ").replace(/\.000Z$|Z$/, "");
  }
  if (value instanceof Date) return value.toISOString();
  return value;
}

export async function query(sql: string): Promise<QueryResult> {
  const db = await getDb();
  const conn = await db.connect();
  try {
    const result = await conn.query(sql);
    const fields = result.schema.fields.map((f) => ({ name: f.name, format: formatOf(String(f.type)) }));
    const rows = result.toArray().map((r) => {
      const raw = r.toJSON() as Row;
      const row: Row = {};
      for (const f of fields) row[f.name] = normalize(raw[f.name], f.format);
      return row;
    });
    return { columns: fields.map((f) => f.name), rows };
  } finally {
    await conn.close();
  }
}

export async function runQuery(sql: string): Promise<Row[]> {
  return (await query(sql)).rows;
}

export async function loadCsv(file: File): Promise<void> {
  const db = await getDb();
  const buffer = new Uint8Array(await file.arrayBuffer());
  await db.registerFileBuffer("upload.csv", buffer);
  const conn = await db.connect();
  try {
    await conn.query(`DROP TABLE IF EXISTS ${TABLE_NAME}`);
    await conn.query(
      `CREATE TABLE ${TABLE_NAME} AS SELECT * FROM read_csv_auto('upload.csv', sample_size = -1)`,
    );
  } finally {
    await conn.close();
  }
}

export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}
