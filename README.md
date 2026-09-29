# AI Data Analyst

Upload a CSV, get an instant overview of your data, and ask questions about it in plain English. The AI writes SQL, runs it, and answers with an interactive chart, the exact SQL it used, and an honest note on how confident it is.

**Your data never leaves your browser.** The CSV is loaded into [DuckDB](https://duckdb.org/) running inside the page with WebAssembly. Only column names, summary stats and small query results are ever sent to the AI.

> 🚧 Work in progress. Step 1 (upload, overview and data quality checks) is done. Asking questions with Claude is next.

## Features

| Feature | Status |
|---|---|
| CSV upload (drag and drop, up to 50 MB) plus a sample dataset | ✅ |
| Dataset overview: rows, columns, types, missing values, ranges, top values, preview | ✅ |
| Data quality warnings: duplicates, missing values, numbers stored as text, mixed types, outliers, constant columns | ✅ |
| Privacy note | ✅ |
| Suggested questions | Planned |
| Ask questions in plain English | Planned |
| Generated charts with filters | Planned |
| Show the SQL behind every answer | Planned |
| AI follow-up questions ("compare this to region") | Planned |
| Honest uncertainty: confidence level and stated assumptions | Planned |
| Question history | Planned |
| Chart export (PNG, SVG, CSV) | Planned |
| Hard spend limits and per-visitor rate limits | Planned |

## How it works

```
Browser                                              Server (Vercel)
┌─────────────────────────────────────────┐          ┌────────────────────┐
│ CSV ─► DuckDB-WASM (in-browser SQL)     │          │ API route          │
│         │                               │ schema + │   │                │
│         ├─► profile + quality checks    │ question │   ▼                │
│         │                               │ ───────► │ Claude (Anthropic  │
│         └─► runs the SQL Claude writes ◄│ ◄─────── │  API) writes SQL,  │
│               │                         │   SQL    │  then the answer   │
│               └─► results ─────────────►│ ───────► │                    │
│                                         │ ◄─────── │                    │
│ chart + SQL + confidence + follow-ups   │  answer  │                    │
└─────────────────────────────────────────┘          └────────────────────┘
```

## Tech stack

- **Next.js 16**, React 19, TypeScript, Tailwind CSS
- **DuckDB-WASM** for fast SQL on the user's own device
- **Claude** via the Anthropic API (coming next)
- Hosted on **Vercel**

## Run it locally

Requires Node.js 20 or newer.

```bash
npm install     # also copies the DuckDB engine files into public/duckdb
npm run dev
```

Open http://localhost:3000 and click **Try sample sales data**.

`npm run sample-data` regenerates `public/samples/sales.csv`, a fictional store's 2025 orders with a few deliberate data quality issues.

## Project structure

```
src/
  app/page.tsx               Main page: upload → overview
  components/                Uploader, DatasetOverview, QualityWarnings, PrivacyNote
  lib/duckdb.ts              DuckDB-WASM setup, CSV loading, queries
  lib/profile.ts             Column profiling and data quality rules
scripts/
  copy-duckdb.mjs            Copies DuckDB engine files to public/ on install
  make-sample-data.mjs       Generates the sample dataset
```
