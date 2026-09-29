import type { ColumnKind, ColumnProfile, DatasetProfile } from "@/lib/profile";

const kindLabel: Record<ColumnKind, string> = {
  number: "Number",
  date: "Date",
  text: "Text",
  boolean: "True/False",
  other: "Other",
};

function fmt(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") {
    return Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(v);
}

function summary(c: ColumnProfile): string {
  if (c.kind === "number") return `${fmt(c.min)} to ${fmt(c.max)} · avg ${fmt(c.mean)}`;
  if (c.kind === "date") return `${fmt(c.min)} to ${fmt(c.max)}`;
  if (c.kind === "text" && c.nonMissing > 0 && c.distinct >= c.nonMissing * 0.9) {
    return "Mostly unique values (likely an ID or free text)";
  }
  if (c.topValues?.length) {
    return c.topValues.map((t) => `${t.value} (${t.count.toLocaleString()})`).join(", ");
  }
  return "";
}

function Stat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-card px-5 py-4">
      <p className="font-mono text-[0.65rem] tracking-[0.14em] text-muted uppercase">{label}</p>
      <p className={`mt-1.5 font-mono text-3xl font-bold tabular-nums ${alert ? "text-amber-300" : "text-ink"}`}>{value}</p>
    </div>
  );
}

const heading = "mb-3 font-mono text-xs tracking-[0.12em] text-accent";
const tableWrap = "overflow-x-auto rounded-xl border border-line bg-card";
const th = "px-4 py-2.5 font-mono text-[0.65rem] font-normal tracking-[0.1em] text-muted uppercase";

export function StatsRow({ profile }: { profile: DatasetProfile }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Rows" value={profile.rowCount.toLocaleString()} />
      <Stat label="Columns" value={profile.columns.length.toLocaleString()} />
      <Stat label="Duplicate rows" value={profile.duplicateRows.toLocaleString()} alert={profile.duplicateRows > 0} />
      <Stat label="Quality warnings" value={profile.warnings.length.toLocaleString()} alert={profile.warnings.length > 0} />
    </div>
  );
}

export function ColumnsTable({ profile }: { profile: DatasetProfile }) {
  return (
    <section className="min-w-0">
      <h2 className={heading}>{"// columns"}</h2>
      <div className={tableWrap}>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line">
            <tr>
              <th className={th}>Column</th>
              <th className={th}>Type</th>
              <th className={th}>Missing</th>
              <th className={th}>Unique</th>
              <th className={th}>Range / top values</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {profile.columns.map((c) => (
              <tr key={c.name} className="transition hover:bg-card-hover">
                <td className="px-4 py-2 font-mono text-xs text-ink">{c.name}</td>
                <td className="px-4 py-2 text-muted">{kindLabel[c.kind]}</td>
                <td className={`px-4 py-2 tabular-nums ${c.missing > 0 ? "text-amber-300" : "text-muted"}`}>{c.missing.toLocaleString()}</td>
                <td className="px-4 py-2 text-muted tabular-nums">{c.distinct.toLocaleString()}</td>
                <td className="max-w-56 truncate px-4 py-2 text-muted" title={summary(c)}>
                  {summary(c)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function PreviewTable({ profile }: { profile: DatasetProfile }) {
  const headers = profile.columns.map((c) => c.name);
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-mono text-xs tracking-[0.12em] text-accent">
        <span className="transition group-open:rotate-90" aria-hidden>
          ▸
        </span>
        {`// preview the first ${profile.sampleRows.length} rows`}
      </summary>
      <div className={`${tableWrap} mt-3`}>
        <table className="w-full whitespace-nowrap text-left text-sm">
          <thead className="border-b border-line">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-3 py-2.5 font-mono text-xs font-normal text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {profile.sampleRows.map((row, i) => (
              <tr key={i}>
                {headers.map((h) => (
                  <td key={h} className="px-3 py-2 tabular-nums">
                    {fmt(row[h])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
