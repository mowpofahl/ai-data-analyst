import type { QualityWarning, Severity } from "@/lib/profile";

const styles: Record<Severity, { badge: string; label: string }> = {
  high: { badge: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200", label: "High" },
  medium: { badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200", label: "Medium" },
  low: { badge: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300", label: "Low" },
};

export default function QualityWarnings({ warnings }: { warnings: QualityWarning[] }) {
  return (
    <section>
      <h2 className="text-lg font-semibold">Data quality</h2>
      {warnings.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">No issues found. The data looks clean.</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-3 px-4 py-3">
              <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${styles[w.severity].badge}`}>
                {styles[w.severity].label}
              </span>
              <div className="text-sm">
                <p className="font-medium">
                  {w.title}
                  {w.column && <code className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">{w.column}</code>}
                </p>
                <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">{w.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
