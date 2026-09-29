import type { QualityWarning, Severity } from "@/lib/profile";

const styles: Record<Severity, { badge: string; label: string }> = {
  high: { badge: "border-red-500/30 bg-red-500/10 text-red-300", label: "High" },
  medium: { badge: "border-amber-500/30 bg-amber-500/10 text-amber-300", label: "Medium" },
  low: { badge: "border-line-strong bg-white/[0.04] text-muted", label: "Low" },
};

export default function QualityWarnings({ warnings }: { warnings: QualityWarning[] }) {
  return (
    <section className="min-w-0">
      <h2 className="mb-3 font-mono text-xs tracking-[0.12em] text-accent">{"// data quality"}</h2>
      {warnings.length === 0 ? (
        <p className="rounded-xl border border-line bg-card px-4 py-3 text-sm text-muted">No issues found. The data looks clean.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-card">
          {warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-3 px-4 py-3">
              <span className={`mt-0.5 w-16 shrink-0 rounded border px-1.5 py-0.5 text-center font-mono text-[0.65rem] tracking-wide ${styles[w.severity].badge}`}>
                {styles[w.severity].label}
              </span>
              <div className="min-w-0 text-sm">
                <p className="font-medium">
                  {w.title}
                  {w.column && <code className="ml-2 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-muted">{w.column}</code>}
                </p>
                <p className="mt-0.5 text-muted">{w.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
