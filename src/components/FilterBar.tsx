"use client";

import { useEffect, useRef, useState } from "react";
import { distinctValues, type Filters } from "@/lib/answerQuery";
import { humanize } from "@/lib/chartModel";

function FilterMenu({ column, selected, onChange }: { column: string; selected: string[]; onChange: (values: string[]) => void }) {
  const [values, setValues] = useState<string[] | null>(null);
  const ref = useRef<HTMLDetailsElement>(null);

  // Close the menu when clicking anywhere outside it.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    let cancelled = false;
    distinctValues(column)
      .then((v) => !cancelled && setValues(v))
      .catch(() => !cancelled && setValues([]));
    return () => {
      cancelled = true;
    };
  }, [column]);

  const label = selected.length === 0 ? "All" : selected.length === 1 ? selected[0] : `${selected.length} selected`;
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);

  return (
    <details ref={ref} className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-line-strong bg-card px-3 py-1.5 text-sm transition hover:border-muted">
        <span className="text-muted">{humanize(column)}:</span>
        <span className={`max-w-40 truncate font-medium ${selected.length ? "text-accent" : "text-ink"}`}>{label}</span>
        <span aria-hidden className="text-muted">▾</span>
      </summary>
      <div className="absolute left-0 z-20 mt-1 max-h-72 w-60 overflow-y-auto rounded-lg border border-line-strong bg-card p-1 shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
        {values === null ? (
          <p className="px-2 py-1.5 text-sm text-muted">Loading…</p>
        ) : (
          values.map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-card-hover">
              <input type="checkbox" checked={selected.includes(v)} onChange={() => toggle(v)} className="accent-accent" />
              <span className="truncate">{v}</span>
            </label>
          ))
        )}
        {selected.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="mt-1 w-full border-t border-line px-2 py-1.5 text-left text-sm text-accent">
            Clear
          </button>
        )}
      </div>
    </details>
  );
}

export default function FilterBar({ columns, filters, onChange }: { columns: string[]; filters: Filters; onChange: (f: Filters) => void }) {
  const active = Object.values(filters).some((v) => v.length > 0);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[0.7rem] tracking-[0.12em] text-muted">FILTER</span>
      {columns.map((c) => (
        <FilterMenu key={c} column={c} selected={filters[c] ?? []} onChange={(values) => onChange({ ...filters, [c]: values })} />
      ))}
      {active && (
        <button type="button" onClick={() => onChange({})} className="text-sm text-accent hover:underline">
          Reset
        </button>
      )}
    </div>
  );
}
