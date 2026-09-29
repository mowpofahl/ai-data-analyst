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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default function DatasetOverview({ profile }: { profile: DatasetProfile }) {
  const { rowCount, columns, sampleRows, warnings } = profile;
  const headers = columns.map((c) => c.name);

  return (
    <section className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Rows" value={rowCount.toLocaleString()} />
        <Stat label="Columns" value={columns.length.toLocaleString()} />
        <Stat label="Duplicate rows" value={profile.duplicateRows.toLocaleString()} />
        <Stat label="Quality warnings" value={warnings.length.toLocaleString()} />
      </div>

      <div>
        <h2 className="text-lg font-semibold">Columns</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2 font-medium">Column</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Missing</th>
                <th className="px-4 py-2 font-medium">Unique</th>
                <th className="px-4 py-2 font-medium">Range / top values</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {columns.map((c) => (
                <tr key={c.name}>
                  <td className="px-4 py-2 font-mono text-xs">{c.name}</td>
                  <td className="px-4 py-2">{kindLabel[c.kind]}</td>
                  <td className={`px-4 py-2 tabular-nums ${c.missing > 0 ? "text-amber-700 dark:text-amber-400" : ""}`}>
                    {c.missing.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 tabular-nums">{c.distinct.toLocaleString()}</td>
                  <td className="max-w-xs truncate px-4 py-2 text-zinc-600 dark:text-zinc-400" title={summary(c)}>
                    {summary(c)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Preview</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="px-3 py-2 font-mono font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {sampleRows.map((row, i) => (
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
      </div>
    </section>
  );
}
