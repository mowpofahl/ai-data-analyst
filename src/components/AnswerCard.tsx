"use client";

import { useState } from "react";
import type { Answer, Confidence } from "@/lib/ask";

const confidenceStyle: Record<Confidence, { label: string; className: string }> = {
  high: { label: "High confidence", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
  medium: { label: "Medium confidence", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  low: { label: "Low confidence", className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" },
};

const PREVIEW_ROWS = 100;

function cell(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(v);
}

function SqlBlock({ sql }: { sql: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <details className="group rounded-lg border border-zinc-200 dark:border-zinc-800" open>
      <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm font-medium">
        SQL used
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            navigator.clipboard?.writeText(sql).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="rounded px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </summary>
      <pre className="overflow-x-auto border-t border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs leading-relaxed dark:border-zinc-800 dark:bg-zinc-900">
        {sql}
      </pre>
    </details>
  );
}

export default function AnswerCard({ answer }: { answer: Answer }) {
  const conf = confidenceStyle[answer.confidence];
  const rows = answer.result?.rows ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${conf.className}`}>{conf.label}</span>
        <span className="text-xs text-zinc-500">
          {answer.queriesRun} {answer.queriesRun === 1 ? "query" : "queries"} run
        </span>
      </div>
      <p className="whitespace-pre-wrap leading-relaxed">{answer.answer}</p>

      {answer.assumptions.length > 0 && (
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          <p className="font-medium text-zinc-700 dark:text-zinc-300">Assumptions and caveats</p>
          <ul className="mt-1 list-disc pl-5">
            {answer.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {answer.sql && <SqlBlock sql={answer.sql} />}

      {answer.resultError && (
        <p className="text-sm text-red-600 dark:text-red-400">This SQL couldn&apos;t be re-run: {answer.resultError}</p>
      )}

      {answer.result && (
        <div>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full whitespace-nowrap text-left text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900">
                <tr>
                  {answer.result.columns.map((c) => (
                    <th key={c} className="px-3 py-2 font-mono font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {rows.slice(0, PREVIEW_ROWS).map((row, i) => (
                  <tr key={i}>
                    {answer.result!.columns.map((c) => (
                      <td key={c} className="px-3 py-1.5 tabular-nums">
                        {cell(row[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {rows.length === 0
              ? "The query returned no rows."
              : rows.length > PREVIEW_ROWS || answer.truncated
                ? `Showing the first ${PREVIEW_ROWS} of ${answer.truncated ? "more than 1,000" : rows.length.toLocaleString()} rows.`
                : `${rows.length.toLocaleString()} ${rows.length === 1 ? "row" : "rows"}.`}
          </p>
        </div>
      )}
    </div>
  );
}
