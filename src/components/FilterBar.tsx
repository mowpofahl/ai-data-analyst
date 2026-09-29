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
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
        <span className="text-zinc-500">{humanize(column)}:</span>
        <span className="max-w-40 truncate font-medium">{label}</span>
        <span aria-hidden className="text-zinc-400">▾</span>
      </summary>
      <div className="absolute left-0 z-10 mt-1 max-h-72 w-60 overflow-y-auto rounded-lg border border-zinc-200 bg-[var(--background)] p-1 shadow-lg dark:border-zinc-800">
        {values === null ? (
          <p className="px-2 py-1.5 text-sm text-zinc-500">Loading…</p>
        ) : (
          values.map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900">
              <input type="checkbox" checked={selected.includes(v)} onChange={() => toggle(v)} className="accent-indigo-600" />
              <span className="truncate">{v}</span>
            </label>
          ))
        )}
        {selected.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="mt-1 w-full border-t border-zinc-200 px-2 py-1.5 text-left text-sm text-indigo-600 dark:border-zinc-800 dark:text-indigo-400">
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
      <span className="text-sm text-zinc-500">Filter:</span>
      {columns.map((c) => (
        <FilterMenu key={c} column={c} selected={filters[c] ?? []} onChange={(values) => onChange({ ...filters, [c]: values })} />
      ))}
      {active && (
        <button type="button" onClick={() => onChange({})} className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
          Reset
        </button>
      )}
    </div>
  );
}
