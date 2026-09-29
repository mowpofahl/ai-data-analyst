# AI Data Analyst

Upload a CSV, get an instant overview of your data, and ask questions about it in plain English. The AI writes SQL, runs it, and answers with an interactive chart, the exact SQL it used, and an honest note on how confident it is.

**Your data never leaves your browser.** The CSV is loaded into [DuckDB](https://duckdb.org/) running inside the page with WebAssembly. Only column names, summary stats and small query results are ever sent to the AI.

> 🚧 Work in progress. Upload, overview, data quality checks, questions with Claude, charts, and suggested and follow-up questions work. Question history is next.

## Features

| Feature | Status |
|---|---|
| CSV upload (drag and drop, up to 50 MB) plus a sample dataset | ✅ |
| Dataset overview: rows, columns, types, missing values, ranges, top values, preview | ✅ |
| Data quality warnings: duplicates, missing values, numbers stored as text, mixed types, outliers, constant columns | ✅ |
| Privacy note | ✅ |
| Suggested questions written by the AI for each dataset | ✅ |
| Ask questions in plain English | ✅ |
| Charts picked by the AI (bar, line, scatter, or a headline number), with filters that re-run the SQL locally | ✅ |
| Show the SQL behind every answer, plus its results | ✅ |
| AI follow-up questions after each answer, and a clarifying question when a question is ambiguous | ✅ |
| Honest uncertainty: confidence level and stated assumptions | ✅ |
| Question history | Planned |
| Chart export (PNG, SVG) and results as CSV | ✅ |
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
- **Recharts** for charts, with a color-blind-safe palette validated for light and dark mode
- **Claude Sonnet 5.5** via the Anthropic API, with tool use for the SQL loop
- **Claude Haiku 4.5** for suggested questions, with structured JSON output (a small, cheap model is plenty for that job)
- Hosted on **Vercel**

## Run it locally

Requires Node.js 20 or newer.

```bash
npm install     # also copies the DuckDB engine files into public/duckdb
cp .env.example .env.local   # then add your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000 and click **Try sample sales data**. The overview works without an API key; asking questions needs one.

`npm run sample-data` regenerates `public/samples/sales.csv`, a fictional store's 2025 orders with a few deliberate data quality issues.

## How a question is answered

0. When a file loads, `/api/suggest` asks Claude Haiku 4.5 for four starter questions based on the column summary.
1. The browser sends the question plus a description of the dataset (column names, types, summary stats, 5 sample rows and the quality warnings) to `/api/ask`.
2. The API route adds the instructions and calls Claude with three tools: `run_sql`, `ask_clarifying_question` and `submit_answer`. If a question could mean very different things (does "best product" mean revenue or units?), Claude asks first, and the loop pauses until the user picks an option or types a reply.
3. When Claude calls `run_sql`, the browser checks the query is a single read-only `SELECT` on the `data` table (`src/lib/sqlGuard.ts`), runs it in DuckDB, and sends back up to 50 result rows.
4. Claude repeats until it calls `submit_answer` with the answer, the SQL behind it, a confidence level, any assumptions, a chart spec, which columns make useful filters, and 2 or 3 follow-up questions. The browser re-runs that SQL to show the exact results and chart.
5. Changing a filter never calls the AI. The browser shadows the `data` table with a filtered version (`WITH data AS (SELECT * FROM main.data WHERE …)`) and re-runs the same SQL, so the chart and table update instantly.

The API key stays on the server, and the raw file never leaves the browser.

## Project structure

```
src/
  app/page.tsx               Main page: upload → overview → questions
  components/                Uploader, DatasetOverview, QualityWarnings, AnswerCard, AnswerChart, FilterBar, QuestionChips, PrivacyNote
  app/api/ask/route.ts       Server route that calls Claude (keeps the API key secret)
  app/api/suggest/route.ts   Server route for suggested questions (Claude Haiku 4.5)
  components/AskPanel.tsx    Question box, suggestions, clarifying questions and answers
  lib/ask.ts                 The question loop: Claude writes SQL, the browser runs it
  lib/claudeServer.ts        Shared server helpers: error messages and usage logging
  lib/answerQuery.ts         Runs an answer's SQL with optional filters
  lib/chartModel.ts          Turns results + the AI's chart spec into a chart
  lib/chartExport.ts         PNG, SVG and CSV export
  lib/analystPrompt.ts       Instructions, dataset description and tool definitions
  lib/suggestPrompt.ts       Instructions for suggested questions
  lib/sqlGuard.ts            Only allows read-only SELECT queries on the data table
  lib/duckdb.ts              DuckDB-WASM setup, CSV loading, queries
  lib/profile.ts             Column profiling and data quality rules
scripts/
  copy-duckdb.mjs            Copies DuckDB engine files to public/ on install
  make-sample-data.mjs       Generates the sample dataset
```
