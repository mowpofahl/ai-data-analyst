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

// DuckDB returns BigInt for integer columns; convert to plain numbers so
// results are easy to render and serialize.
function normalize(value: unknown): unknown {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString();
  return value;
}

export async function runQuery(sql: string): Promise<Row[]> {
  const db = await getDb();
  const conn = await db.connect();
  try {
    const result = await conn.query(sql);
    return result.toArray().map((r) => {
      const obj = r.toJSON() as Row;
      for (const key of Object.keys(obj)) obj[key] = normalize(obj[key]);
      return obj;
    });
  } finally {
    await conn.close();
  }
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
