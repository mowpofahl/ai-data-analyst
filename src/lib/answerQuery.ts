import { query, quoteIdent, TABLE_NAME, type QueryResult } from "./duckdb";
import { checkSql } from "./sqlGuard";

export const RESULT_ROWS_MAX = 1000;

export type Filters = Record<string, string[]>; // column -> selected values

export interface LimitedResult {
  result: QueryResult;
  truncated: boolean;
}

// Restrict the data table to the selected filter values by shadowing it with a
// CTE of the same name, so the AI's SQL runs unchanged on the filtered rows.
export function applyFilters(sql: string, filters: Filters): string {
  const conditions = Object.entries(filters)
    .filter(([, values]) => values.length > 0)
    .map(([col, values]) => {
      const list = values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
      return `${quoteIdent(col)}::VARCHAR IN (${list})`;
    });
  if (conditions.length === 0) return sql;

  const cte = `${TABLE_NAME} AS (SELECT * FROM main.${TABLE_NAME} WHERE ${conditions.join(" AND ")})`;
  const withMatch = sql.match(/^\s*WITH\s+(RECURSIVE\s+)?/i);
  if (withMatch) return `WITH ${withMatch[1] ?? ""}${cte}, ${sql.slice(withMatch[0].length)}`;
  return `WITH ${cte} ${sql}`;
}

// Run a checked, read-only query (optionally filtered), capping the rows kept in memory.
export async function runLimited(sql: string, filters: Filters = {}): Promise<LimitedResult> {
  const check = checkSql(sql);
  if (!check.ok) throw new Error(check.reason);
  const result = await query(`SELECT * FROM (${applyFilters(check.sql, filters)}) AS q LIMIT ${RESULT_ROWS_MAX + 1}`);
  const truncated = result.rows.length > RESULT_ROWS_MAX;
  if (truncated) result.rows = result.rows.slice(0, RESULT_ROWS_MAX);
  return { result, truncated };
}

export async function distinctValues(column: string, limit = 30): Promise<string[]> {
  const col = quoteIdent(column);
  const { rows } = await query(
    `SELECT ${col}::VARCHAR AS v, count(*) AS n FROM ${TABLE_NAME} WHERE ${col} IS NOT NULL GROUP BY 1 ORDER BY n DESC, v LIMIT ${limit}`,
  );
  return rows.map((r) => String(r.v));
}
