"use client";

import { useMemo, useRef, useState } from "react";
import AnswerChart, { fmtFull, seriesColor } from "@/components/AnswerChart";
import FilterBar from "@/components/FilterBar";
import QuestionChips from "@/components/QuestionChips";
import { runLimited, type Filters } from "@/lib/answerQuery";
import type { Answer, Confidence } from "@/lib/ask";
import { buildExportSvg, downloadBlob, resolveColor, slugify, svgToPng, toCsv, type LegendItem } from "@/lib/chartExport";
import { buildChartModel, humanize, seriesOrder } from "@/lib/chartModel";
import type { QueryResult } from "@/lib/duckdb";

const confidenceStyle: Record<Confidence, { label: string; className: string }> = {
  high: { label: "High confidence", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
  medium: { label: "Medium confidence", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  low: { label: "Low confidence", className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" },
};

const PREVIEW_ROWS = 100;

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

function ResultTable({ result, truncated }: { result: QueryResult; truncated: boolean }) {
  const rows = result.rows;
  return (
    <div>
      <div className="max-h-96 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full whitespace-nowrap text-left text-sm">
          <thead className="sticky top-0 bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900">
            <tr>
              {result.columns.map((c) => (
                <th key={c} className="px-3 py-2 font-mono font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.slice(0, PREVIEW_ROWS).map((row, i) => (
              <tr key={i}>
                {result.columns.map((c) => (
                  <td key={c} className="px-3 py-1.5 tabular-nums">
                    {fmtFull(row[c])}
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
          : rows.length > PREVIEW_ROWS || truncated
            ? `Showing the first ${PREVIEW_ROWS} of ${truncated ? "more than 1,000" : rows.length.toLocaleString()} rows.`
            : `${rows.length.toLocaleString()} ${rows.length === 1 ? "row" : "rows"}.`}
      </p>
    </div>
  );
}

const exportButton = "rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900";

export default function AnswerCard({
  answer,
  onAsk,
  askDisabled,
}: {
  answer: Answer;
  onAsk?: (question: string) => void;
  askDisabled?: boolean;
}) {
  const conf = confidenceStyle[answer.confidence];
  const [filters, setFilters] = useState<Filters>({});
  const [view, setView] = useState({ result: answer.result, truncated: answer.truncated, error: answer.resultError });
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);
  const chartRef = useRef<HTMLDivElement>(null);

  // Series colors come from the unfiltered result so they never change with filters.
  const order = useMemo(() => (answer.chart && answer.result ? seriesOrder(answer.chart, answer.result) : []), [answer]);
  const model = useMemo(() => buildChartModel(answer.chart, view.result, order), [answer.chart, view.result, order]);
  const filtered = Object.values(filters).some((v) => v.length > 0);

  // Filtering re-runs the answer's SQL locally in DuckDB; no AI call needed.
  const changeFilters = (next: Filters) => {
    setFilters(next);
    const id = ++requestId.current;
    setLoading(true);
    runLimited(answer.sql, next)
      .then(({ result, truncated }) => id === requestId.current && setView({ result, truncated, error: null }))
      .catch((err) => id === requestId.current && setView({ result: null, truncated: false, error: (err as Error).message }))
      .finally(() => id === requestId.current && setLoading(false));
  };

  const title = model.kind === "none" ? answer.chart?.title || "Results" : model.title || "Results";
  const plot = model.kind === "bar" || model.kind === "line" || model.kind === "scatter" ? model : null;
  const legendKeys = plot && plot.seriesKeys.length > 1 ? plot.seriesKeys : [];

  const exportChart = async (format: "png" | "svg") => {
    const svg = chartRef.current?.querySelector("svg.recharts-surface") as SVGSVGElement | null;
    if (!svg) return;
    const legend: LegendItem[] = legendKeys.map((k) => ({
      label: k,
      color: resolveColor(seriesColor(k, order)),
      shape: plot?.kind === "bar" ? "rect" : "line",
    }));
    const active = Object.entries(filters).filter(([, v]) => v.length > 0);
    const exportTitle = active.length ? `${title} (${active.map(([c, v]) => `${humanize(c)}: ${v.join(", ")}`).join("; ")})` : title;
    const { markup, width, height } = buildExportSvg(svg, exportTitle, legend);
    if (format === "svg") {
      downloadBlob(new Blob([markup], { type: "image/svg+xml" }), `${slugify(title)}.svg`);
    } else {
      downloadBlob(await svgToPng(markup, width, height), `${slugify(title)}.png`);
    }
  };

  return (
    <div className="flex flex-col gap-4">
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
      </div>

      {answer.filterColumns.length > 0 && (
        <div className="flex flex-col gap-1">
          <FilterBar columns={answer.filterColumns} filters={filters} onChange={changeFilters} />
          {filtered && <p className="text-xs text-zinc-500">Filters update the chart and table. The written answer above describes all the data.</p>}
        </div>
      )}

      <div className={`flex flex-col gap-3 transition-opacity ${loading ? "opacity-50" : ""}`}>
        {view.error && <p className="text-sm text-red-600 dark:text-red-400">This SQL couldn&apos;t be run: {view.error}</p>}

        {model.kind === "stat" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {model.stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <p className="text-xs text-zinc-500">{s.label}</p>
                <p className="mt-1 text-3xl font-semibold">{fmtFull(s.value)}</p>
              </div>
            ))}
          </div>
        )}

        {plot && (
          <figure className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <figcaption className="flex flex-wrap items-start justify-between gap-2 px-1">
              <div className="flex flex-col gap-1.5">
                <p className="font-medium">{title}</p>
                {legendKeys.length > 0 && (
                  <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--chart-ink-2)]">
                    {legendKeys.map((k) => (
                      <li key={k} className="flex items-center gap-1.5">
                        <span
                          className={plot.kind === "bar" ? "inline-block h-2.5 w-2.5 rounded-sm" : "inline-block h-0.5 w-3 rounded"}
                          style={{ background: seriesColor(k, order) }}
                        />
                        {k}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex gap-1.5">
                <button type="button" className={exportButton} onClick={() => exportChart("png")}>
                  PNG
                </button>
                <button type="button" className={exportButton} onClick={() => exportChart("svg")}>
                  SVG
                </button>
              </div>
            </figcaption>
            <div ref={chartRef} className="mt-2">
              <AnswerChart model={plot} order={order} />
            </div>
            {plot.note && <p className="px-1 text-xs text-zinc-500">{plot.note}</p>}
          </figure>
        )}

        <SqlBlock sql={answer.sql} />

        {view.result && (
          <div className="flex flex-col gap-1">
            <div className="flex justify-end">
              <button
                type="button"
                className={exportButton}
                onClick={() => downloadBlob(new Blob([toCsv(view.result!)], { type: "text/csv" }), `${slugify(title)}.csv`)}
              >
                Download CSV
              </button>
            </div>
            <ResultTable result={view.result} truncated={view.truncated} />
          </div>
        )}
      </div>

      {onAsk && answer.followUps.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <p className="text-sm font-medium">Ask next</p>
          <QuestionChips questions={answer.followUps} onPick={onAsk} disabled={askDisabled} />
        </div>
      )}
    </div>
  );
}
