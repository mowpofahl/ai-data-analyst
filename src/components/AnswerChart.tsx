"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { humanize, MAX_SERIES, type ChartModel } from "@/lib/chartModel";

type PlotModel = Extract<ChartModel, { kind: "bar" | "line" | "scatter" }>;

const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const fmtCompact = (v: unknown) => (typeof v === "number" ? compact.format(v) : String(v ?? ""));
export const fmtFull = (v: unknown) => (typeof v === "number" ? full.format(v) : String(v ?? "—"));
const truncateLabel = (v: unknown, n = 18) => {
  const s = String(v ?? "");
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

// Colors follow the entity: a series keeps its slot from the unfiltered order.
export function seriesColor(key: string, order: string[]): string {
  if (order.length === 0) return "var(--series-1)";
  const i = order.indexOf(key);
  return i >= 0 && i < MAX_SERIES ? `var(--series-${i + 1})` : "var(--chart-muted)";
}

// Clean axis ticks (0 / 250K / 500K …) instead of whatever divides the data max.
function niceTicks(values: number[], count = 5): { ticks: number[]; domain: [number, number] } {
  const finite = values.filter((v) => Number.isFinite(v));
  const lo = Math.min(0, ...finite);
  const hi = Math.max(0, ...finite);
  if (hi === lo) return { ticks: [lo], domain: [lo, lo + 1] };
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
  return { ticks, domain: [start, end] };
}

const numbersIn = (rows: Record<string, unknown>[], keys: string[]) =>
  rows.flatMap((r) => keys.map((k) => r[k])).filter((v): v is number => typeof v === "number");

const tick = { fill: "var(--chart-muted)", fontSize: 12 };
const axisLine = { stroke: "var(--chart-axis)" };

type TooltipEntry = { name?: string | number; value?: unknown; color?: string; dataKey?: string | number };

function ChartTooltip({
  active,
  payload,
  label,
  single,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: unknown;
  single: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-black/10 bg-[var(--chart-surface)] px-3 py-2 text-xs shadow-sm dark:border-white/10">
      {label != null && label !== "" && <p className="mb-1 text-[var(--chart-ink-2)]">{String(label)}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2">
          {!single && <span className="inline-block h-0.5 w-3 rounded" style={{ background: p.color }} />}
          <span className="font-semibold tabular-nums text-[var(--chart-ink)]">{fmtFull(p.value)}</span>
          <span className="text-[var(--chart-ink-2)]">{String(p.name ?? "")}</span>
        </p>
      ))}
    </div>
  );
}

// Label only the extreme bar or the line's end point, never every mark.
function selectiveLabel(values: number[], mode: "max" | "last", horizontal: boolean) {
  const target = mode === "max" ? values.indexOf(Math.max(...values)) : values.length - 1;
  function SelectiveLabel(props: { x?: number | string; y?: number | string; width?: number | string; height?: number | string; value?: unknown; index?: number }) {
    if (props.index !== target) return null;
    const x = Number(props.x ?? 0);
    const y = Number(props.y ?? 0);
    const w = Number(props.width ?? 0);
    const h = Number(props.height ?? 0);
    const pos = horizontal ? { x: x + w + 6, y: y + h / 2, anchor: "start" } : mode === "last" ? { x: x + 6, y: y - 8, anchor: "end" } : { x: x + w / 2, y: y - 6, anchor: "middle" };
    return (
      <text x={pos.x} y={pos.y} textAnchor={pos.anchor as "start" | "middle" | "end"} dominantBaseline={horizontal ? "central" : "auto"} fontSize={12} fontWeight={600} fill="var(--chart-ink)">
        {fmtCompact(props.value)}
      </text>
    );
  }
  return SelectiveLabel;
}

export default function AnswerChart({ model, order }: { model: PlotModel; order: string[] }) {
  const single = model.seriesKeys.length === 1;
  const colorOf = (key: string) => (single ? "var(--series-1)" : seriesColor(key, order));
  const tooltip = <Tooltip content={<ChartTooltip single={single} />} cursor={model.kind === "line" ? { stroke: "var(--chart-axis)", strokeWidth: 1 } : { fill: "var(--chart-hover)" }} />;
  const values = single ? model.data.map((r) => Number(r[model.seriesKeys[0]] ?? 0)) : [];

  if (model.kind === "bar") {
    const rowHeight = Math.max(32, model.seriesKeys.length * 12 + 16);
    const height = model.horizontal ? model.data.length * rowHeight + 48 : 300;
    const scale = niceTicks(numbersIn(model.data, model.seriesKeys));
    const margin = { top: 24, right: model.horizontal ? 56 : 16, bottom: 8, left: 8 };
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={model.data} layout={model.horizontal ? "vertical" : "horizontal"} margin={margin} barGap={2} barCategoryGap="20%">
          <CartesianGrid stroke="var(--chart-grid)" horizontal={!model.horizontal} vertical={model.horizontal} />
          {model.horizontal ? (
            <>
              <XAxis type="number" ticks={scale.ticks} domain={scale.domain} tick={tick} tickFormatter={fmtCompact} axisLine={axisLine} tickLine={false} />
              <YAxis type="category" dataKey={model.x} tick={tick} tickFormatter={(v) => truncateLabel(v)} width={130} axisLine={axisLine} tickLine={false} interval={0} />
            </>
          ) : (
            <>
              <XAxis dataKey={model.x} tick={tick} tickFormatter={(v) => truncateLabel(v, 16)} axisLine={axisLine} tickLine={false} interval={0} />
              <YAxis ticks={scale.ticks} domain={scale.domain} tick={tick} tickFormatter={fmtCompact} axisLine={false} tickLine={false} width={56} />
            </>
          )}
          {tooltip}
          {model.seriesKeys.map((key) => (
            <Bar key={key} dataKey={key} name={single ? humanize(model.y) : key} fill={colorOf(key)} maxBarSize={24} radius={model.horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} isAnimationActive={false}>
              {single && <LabelList dataKey={key} content={selectiveLabel(values, "max", model.horizontal)} />}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (model.kind === "line") {
    const scale = niceTicks(numbersIn(model.data, model.seriesKeys));
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={model.data} margin={{ top: 24, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey={model.x} tick={tick} axisLine={axisLine} tickLine={false} minTickGap={24} />
          <YAxis ticks={scale.ticks} domain={scale.domain} tick={tick} tickFormatter={fmtCompact} axisLine={false} tickLine={false} width={56} />
          {tooltip}
          {model.seriesKeys.map((key) => (
            <Line
              key={key}
              type="linear"
              dataKey={key}
              name={single ? humanize(model.y) : key}
              stroke={colorOf(key)}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={model.data.length <= 24 ? { r: 4, fill: colorOf(key), stroke: "var(--chart-surface)", strokeWidth: 2 } : false}
              activeDot={{ r: 5, fill: colorOf(key), stroke: "var(--chart-surface)", strokeWidth: 2 }}
              connectNulls
              isAnimationActive={false}
            >
              {single && <LabelList dataKey={key} content={selectiveLabel(values, "last", false)} />}
            </Line>
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Scatter: one <Scatter> per group so each keeps its own color.
  const groups = model.seriesKeys.map((key) => ({ key, points: model.data.filter((r) => single || r.__series === key) }));
  const xScale = niceTicks(numbersIn(model.data, [model.x]));
  const yScale = niceTicks(numbersIn(model.data, [model.y]));
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ScatterChart margin={{ top: 16, right: 24, bottom: 24, left: 8 }}>
        <CartesianGrid stroke="var(--chart-grid)" />
        <XAxis type="number" dataKey={model.x} name={humanize(model.x)} ticks={xScale.ticks} domain={xScale.domain} tick={tick} tickFormatter={fmtCompact} axisLine={axisLine} tickLine={false} label={{ value: humanize(model.x), position: "insideBottom", offset: -16, fill: "var(--chart-muted)", fontSize: 12 }} />
        <YAxis type="number" dataKey={model.y} name={humanize(model.y)} ticks={yScale.ticks} domain={yScale.domain} tick={tick} tickFormatter={fmtCompact} axisLine={false} tickLine={false} width={56} />
        <ZAxis range={[64, 64]} />
        <Tooltip content={<ChartTooltip single />} cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }} />
        {groups.map((g) => (
          <Scatter key={g.key} name={g.key} data={g.points} fill={colorOf(g.key)} stroke="var(--chart-surface)" strokeWidth={2} isAnimationActive={false} />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
