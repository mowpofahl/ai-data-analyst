import { quoteIdent, runQuery, TABLE_NAME } from "./duckdb";

export type ColumnKind = "number" | "date" | "text" | "boolean" | "other";

export interface ColumnProfile {
  name: string;
  type: string;
  kind: ColumnKind;
  missing: number;
  distinct: number;
  min?: string | number | null;
  max?: string | number | null;
  mean?: number | null;
  outliers?: number;
  topValues?: { value: string; count: number }[];
  numericLikeText?: number; // text values that parse as numbers
  nonMissing: number;
}

export type Severity = "high" | "medium" | "low";

export interface QualityWarning {
  severity: Severity;
  column?: string;
  title: string;
  detail: string;
}

export interface DatasetProfile {
  fileName: string;
  rowCount: number;
  columns: ColumnProfile[];
  duplicateRows: number;
  sampleRows: Record<string, unknown>[];
  warnings: QualityWarning[];
}

function kindOf(type: string): ColumnKind {
  const t = type.toUpperCase();
  if (/^(TINYINT|SMALLINT|INTEGER|BIGINT|HUGEINT|UTINYINT|USMALLINT|UINTEGER|UBIGINT|FLOAT|DOUBLE|REAL|DECIMAL)/.test(t)) {
    return "number";
  }
  if (/^(DATE|TIMESTAMP|TIME)/.test(t)) return "date";
  if (t === "BOOLEAN") return "boolean";
  if (t === "VARCHAR") return "text";
  return "other";
}

const num = (v: unknown) => (v == null ? 0 : Number(v));

async function profileColumn(name: string, type: string, rowCount: number): Promise<ColumnProfile> {
  const col = quoteIdent(name);
  const kind = kindOf(type);
  const missingExpr =
    kind === "text" ? `count(*) FILTER (WHERE ${col} IS NULL OR trim(${col}) = '')` : `count(*) FILTER (WHERE ${col} IS NULL)`;

  const [base] = await runQuery(
    `SELECT ${missingExpr} AS missing, count(DISTINCT ${col}) AS distinct_count FROM ${TABLE_NAME}`,
  );
  const profile: ColumnProfile = {
    name,
    type,
    kind,
    missing: num(base.missing),
    distinct: num(base.distinct_count),
    nonMissing: rowCount - num(base.missing),
  };

  if (kind === "number") {
    const [s] = await runQuery(`
      SELECT min(${col}) AS min, max(${col}) AS max, avg(${col}) AS mean,
             quantile_cont(${col}, 0.25) AS q1, quantile_cont(${col}, 0.75) AS q3
      FROM ${TABLE_NAME}`);
    profile.min = s.min == null ? null : Number(s.min);
    profile.max = s.max == null ? null : Number(s.max);
    profile.mean = s.mean == null ? null : Number(s.mean);
    const q1 = Number(s.q1);
    const q3 = Number(s.q3);
    const iqr = q3 - q1;
    // Only flag extreme values (3x IQR) in columns with a real spread of values;
    // low-cardinality columns like prices or discount tiers aren't outliers.
    if (Number.isFinite(iqr) && iqr > 0 && profile.distinct > 20) {
      const [o] = await runQuery(`
        SELECT count(*) AS n FROM ${TABLE_NAME}
        WHERE ${col} < ${q1 - 3 * iqr} OR ${col} > ${q3 + 3 * iqr}`);
      profile.outliers = num(o.n);
    } else {
      profile.outliers = 0;
    }
  } else if (kind === "date") {
    const [s] = await runQuery(`SELECT min(${col})::VARCHAR AS min, max(${col})::VARCHAR AS max FROM ${TABLE_NAME}`);
    profile.min = s.min as string | null;
    profile.max = s.max as string | null;
  }

  if (kind === "text" || kind === "boolean") {
    const top = await runQuery(`
      SELECT ${col}::VARCHAR AS value, count(*) AS n FROM ${TABLE_NAME}
      WHERE ${col} IS NOT NULL GROUP BY 1 ORDER BY n DESC, value LIMIT 3`);
    profile.topValues = top.map((r) => ({ value: String(r.value), count: num(r.n) }));
  }

  if (kind === "text") {
    // Numbers stored as text, e.g. "$1,200" or a column with a stray "N/A".
    const [t] = await runQuery(`
      SELECT count(*) FILTER (
        WHERE TRY_CAST(regexp_replace(trim(${col}), '[$€£,%]', '', 'g') AS DOUBLE) IS NOT NULL
      ) AS n FROM ${TABLE_NAME} WHERE ${col} IS NOT NULL AND trim(${col}) <> ''`);
    profile.numericLikeText = num(t.n);
  }

  return profile;
}

const pct = (part: number, whole: number) => (whole === 0 ? 0 : (part / whole) * 100);
const fmtPct = (p: number) => (p < 1 ? "<1%" : `${Math.round(p)}%`);

export function buildWarnings(rowCount: number, duplicateRows: number, columns: ColumnProfile[]): QualityWarning[] {
  const warnings: QualityWarning[] = [];

  if (duplicateRows > 0) {
    warnings.push({
      severity: pct(duplicateRows, rowCount) > 5 ? "high" : "medium",
      title: "Duplicate rows",
      detail: `${duplicateRows.toLocaleString()} rows (${fmtPct(pct(duplicateRows, rowCount))}) are exact duplicates of another row. Totals and counts may be inflated.`,
    });
  }

  for (const c of columns) {
    const missingPct = pct(c.missing, rowCount);
    if (c.missing > 0) {
      warnings.push({
        severity: missingPct > 20 ? "high" : missingPct > 5 ? "medium" : "low",
        column: c.name,
        title: "Missing values",
        detail: `${c.missing.toLocaleString()} of ${rowCount.toLocaleString()} values (${fmtPct(missingPct)}) are empty.`,
      });
    }

    if (rowCount > 1 && c.distinct === 1) {
      warnings.push({
        severity: "low",
        column: c.name,
        title: "Constant column",
        detail: "Every row has the same value, so this column can't explain differences.",
      });
    }

    if (c.kind === "text" && c.numericLikeText !== undefined && c.nonMissing > 0) {
      const share = pct(c.numericLikeText, c.nonMissing);
      if (share >= 80) {
        warnings.push({
          severity: share === 100 ? "medium" : "high",
          column: c.name,
          title: share === 100 ? "Numbers stored as text" : "Mixed types",
          detail:
            share === 100
              ? "Values look numeric but include symbols like $ or commas, so they're stored as text. Math on this column needs cleaning first."
              : `${fmtPct(share)} of values are numbers but some aren't (e.g. "N/A"). Those rows will be skipped in calculations.`,
        });
      }
    }

    if (c.kind === "number" && c.outliers && c.outliers > 0) {
      warnings.push({
        severity: pct(c.outliers, rowCount) > 5 ? "medium" : "low",
        column: c.name,
        title: "Possible outliers",
        detail: `${c.outliers.toLocaleString()} values fall far outside the typical range. They can skew averages.`,
      });
    }
  }

  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  return warnings.sort((a, b) => order[a.severity] - order[b.severity]);
}

export async function profileDataset(fileName: string): Promise<DatasetProfile> {
  const [{ n }] = await runQuery(`SELECT count(*) AS n FROM ${TABLE_NAME}`);
  const rowCount = num(n);
  const described = await runQuery(`DESCRIBE ${TABLE_NAME}`);

  const columns: ColumnProfile[] = [];
  for (const d of described) {
    columns.push(await profileColumn(String(d.column_name), String(d.column_type), rowCount));
  }

  const [{ d: distinctRows }] = await runQuery(`SELECT count(*) AS d FROM (SELECT DISTINCT * FROM ${TABLE_NAME})`);
  const duplicateRows = rowCount - num(distinctRows);
  // Dates come back from DuckDB as epoch numbers, so cast them to text for display.
  const selectList = columns
    .map((c) => (c.kind === "date" ? `${quoteIdent(c.name)}::VARCHAR AS ${quoteIdent(c.name)}` : quoteIdent(c.name)))
    .join(", ");
  const sampleRows = await runQuery(`SELECT ${selectList} FROM ${TABLE_NAME} LIMIT 5`);

  return {
    fileName,
    rowCount,
    columns,
    duplicateRows,
    sampleRows,
    warnings: buildWarnings(rowCount, duplicateRows, columns),
  };
}
