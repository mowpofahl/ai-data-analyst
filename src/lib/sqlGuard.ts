// The AI's SQL runs in the user's own browser against their own data, but we
// still only allow a single read-only query on the `data` table. This blocks
// reading other files or URLs (which could leak data) and changing the table.

const BLOCKED_KEYWORDS =
  /\b(insert|update|delete|drop|alter|create|truncate|copy|attach|detach|install|load|pragma|set|reset|call|export|import|checkpoint|vacuum|use|begin|commit|rollback)\b/i;

const BLOCKED_FUNCTIONS =
  /\b(read_\w+|glob|sniff_csv|parquet_\w+|iceberg_\w+|delta_scan|query_table|getenv)\s*\(/i;

// Plain strings pointing at files or URLs, e.g. FROM 'https://…' or FROM 'other.csv'.
const BLOCKED_STRINGS = /'[^']*(:\/\/|\.(csv|tsv|parquet|json|jsonl|ndjson|db|duckdb|xlsx|txt)\b)[^']*'/i;

export type SqlCheck = { ok: true; sql: string } | { ok: false; reason: string };

// Remove string literals, quoted identifiers and comments so keyword checks
// don't trip over column names like "update" or values like 'drop-off'.
function stripLiteralsAndComments(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '""');
}

export function checkSql(input: string): SqlCheck {
  const sql = input.trim().replace(/;+\s*$/, "");
  if (!sql) return { ok: false, reason: "The query is empty." };
  if (sql.length > 10_000) return { ok: false, reason: "The query is too long." };

  const bare = stripLiteralsAndComments(sql);
  if (bare.includes(";")) return { ok: false, reason: "Only one statement is allowed per query." };
  if (!/^\s*\(?\s*(select|with|from)\b/i.test(bare)) {
    return { ok: false, reason: "Only read-only SELECT queries are allowed." };
  }
  const keyword = bare.match(BLOCKED_KEYWORDS);
  if (keyword) return { ok: false, reason: `"${keyword[1].toUpperCase()}" isn't allowed. Only read-only SELECT queries on the data table are allowed.` };
  const fn = bare.match(BLOCKED_FUNCTIONS);
  if (fn) return { ok: false, reason: `${fn[1]}() isn't allowed. Query the data table instead.` };
  if (BLOCKED_STRINGS.test(sql)) return { ok: false, reason: "Reading other files or URLs isn't allowed. Query the data table instead." };

  return { ok: true, sql };
}
