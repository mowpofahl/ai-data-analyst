// Copies the DuckDB-WASM engine files into public/duckdb so the app serves
// them from its own domain. Runs automatically after `npm install`.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("@duckdb/duckdb-wasm/dist/duckdb-browser.mjs"));
const out = new URL("../public/duckdb/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });

for (const file of [
  "duckdb-mvp.wasm",
  "duckdb-eh.wasm",
  "duckdb-browser-mvp.worker.js",
  "duckdb-browser-eh.worker.js",
]) {
  copyFileSync(join(dist, file), join(out, file));
}
console.log("Copied DuckDB-WASM files to public/duckdb");
