import type { QueryResult, Row } from "./duckdb";

export type ChartType = "bar" | "line" | "scatter" | "none";

export interface ChartSpec {
  type: ChartType;
  x: string;
  y: string;
  series: string;
  title: string;
}

export const MAX_SERIES = 8; // categorical palette size; never generate a 9th hue
const MAX_SCATTER_SERIES = 3; // all-pairs forms stay distinguishable up to 3 hues
const MAX_BAR_CATEGORIES = 30;

export type ChartModel =
  | { kind: "none" }
  | { kind: "stat"; title: string; stats: { label: string; value: number }[] }
  | {
      kind: "bar" | "line" | "scatter";
      title: string;
      x: string;
      y: string;
      data: Row[];
      seriesKeys: string[]; // data keys to plot; [y] for a single series
      horizontal: boolean;
      note: string | null;
    };

export const humanize = (col: string) => {
  const s = col.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function numericColumn(result: QueryResult, col: string): boolean {
  const vals = result.rows.map((r) => r[col]).filter((v) => v != null);
  return vals.length > 0 && vals.every(isNum);
}

// Order series by their total so colors stay attached to the same entity when
// filters change (color follows the entity, never its rank after filtering).
export function seriesOrder(spec: ChartSpec, result: QueryResult): string[] {
  if (!spec.series || !result.columns.includes(spec.series)) return [];
  const totals = new Map<string, number>();
  for (const r of result.rows) {
    const key = String(r[spec.series] ?? "(blank)");
    const y = r[spec.y];
    totals.set(key, (totals.get(key) ?? 0) + (isNum(y) ? Math.abs(y) : 0));
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

function statModel(result: QueryResult, title: string): ChartModel {
  const row = result.rows[0];
  const stats = result.columns
    .filter((c) => isNum(row[c]))
    .slice(0, 4)
    .map((c) => ({ label: humanize(c), value: row[c] as number }));
  return stats.length ? { kind: "stat", title, stats } : { kind: "none" };
}

export function buildChartModel(spec: ChartSpec | null, result: QueryResult | null, order: string[]): ChartModel {
  if (!result || result.rows.length === 0) return { kind: "none" };
  const title = spec?.title || "";

  // One row is a number, not a chart.
  if (result.rows.length === 1) return statModel(result, title);
  if (!spec || spec.type === "none") return { kind: "none" };

  const { x, y } = spec;
  if (!result.columns.includes(x) || !result.columns.includes(y) || !numericColumn(result, y)) return { kind: "none" };

  if (spec.type === "scatter") {
    if (!numericColumn(result, x)) return { kind: "none" };
    const series = spec.series && result.columns.includes(spec.series) && order.length <= MAX_SCATTER_SERIES ? spec.series : "";
    const keys = series ? order : [y];
    return {
      kind: "scatter",
      title,
      x,
      y,
      data: result.rows.map((r) => ({ ...r, __series: series ? String(r[series] ?? "(blank)") : y })),
      seriesKeys: keys,
      horizontal: false,
      note: spec.series && !series ? `Too many groups to color separately, so all points share one color.` : null,
    };
  }

  const series = spec.series && result.columns.includes(spec.series) ? spec.series : "";
  let data: Row[];
  let seriesKeys: string[];
  let note: string | null = null;

  if (series) {
    // Pivot long results (x, series, y) into one row per x with a key per series.
    const present = new Set(result.rows.map((r) => String(r[series] ?? "(blank)")));
    const ordered = order.filter((k) => present.has(k));
    seriesKeys = ordered.slice(0, MAX_SERIES);
    if (ordered.length > MAX_SERIES) note = `Showing the ${MAX_SERIES} largest of ${ordered.length} groups. The table has them all.`;
    const byX = new Map<string, Row>();
    for (const r of result.rows) {
      const key = String(r[series] ?? "(blank)");
      if (!seriesKeys.includes(key)) continue;
      const xv = String(r[x] ?? "(blank)");
      const row = byX.get(xv) ?? { [x]: r[x] ?? "(blank)" };
      row[key] = r[y];
      byX.set(xv, row);
    }
    data = [...byX.values()];
  } else {
    data = result.rows.map((r) => ({ ...r, [x]: r[x] ?? "(blank)" }));
    seriesKeys = [y];
  }

  if (spec.type === "bar" && data.length > MAX_BAR_CATEGORIES) {
    note = `Showing the first ${MAX_BAR_CATEGORIES} of ${data.length} categories. The table has them all.`;
    data = data.slice(0, MAX_BAR_CATEGORIES);
  }

  const longLabels = data.some((r) => String(r[x]).length > 16);
  const horizontal = spec.type === "bar" && (data.length > 8 || longLabels);
  return { kind: spec.type, title, x, y, data, seriesKeys, horizontal, note };
}
