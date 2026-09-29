import type { DatasetProfile } from "./profile";

// What the AI is told about the dataset: schema, summary stats, a few sample
// rows and the data quality warnings. Never the full file.
export interface DatasetContext {
  fileName: string;
  rowCount: number;
  columns: {
    name: string;
    type: string;
    missing: number;
    distinct: number;
    min?: string | number | null;
    max?: string | number | null;
    mean?: number | null;
    topValues?: { value: string; count: number }[];
  }[];
  sampleRows: Record<string, unknown>[];
  warnings: string[];
}

const truncate = (v: unknown) => (typeof v === "string" && v.length > 80 ? `${v.slice(0, 80)}…` : v);

export function toDatasetContext(profile: DatasetProfile): DatasetContext {
  return {
    fileName: profile.fileName,
    rowCount: profile.rowCount,
    columns: profile.columns.map((c) => ({
      name: c.name,
      type: c.type,
      missing: c.missing,
      distinct: c.distinct,
      min: c.min,
      max: c.max,
      mean: c.mean,
      topValues: c.topValues?.map((t) => ({ value: String(truncate(t.value)), count: t.count })),
    })),
    sampleRows: profile.sampleRows.map((row) =>
      Object.fromEntries(Object.entries(row).map(([k, v]) => [k, truncate(v)])),
    ),
    warnings: profile.warnings.map((w) => `${w.title}${w.column ? ` in "${w.column}"` : ""}: ${w.detail}`),
  };
}
