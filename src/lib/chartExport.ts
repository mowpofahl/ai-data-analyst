import type { QueryResult } from "./duckdb";

export interface LegendItem {
  label: string;
  color: string; // resolved CSS color
  shape: "rect" | "line";
}

const STYLE_PROPS = [
  "fill",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "fill-opacity",
  "opacity",
  "font-family",
  "font-size",
  "font-weight",
] as const;

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "chart"
  );
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCsv(result: QueryResult): string {
  const cell = (v: unknown) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [result.columns.map(cell).join(","), ...result.rows.map((r) => result.columns.map((c) => cell(r[c])).join(","))].join("\n");
}

export function resolveColor(cssColor: string): string {
  const el = document.createElement("span");
  el.style.color = cssColor;
  document.body.appendChild(el);
  const resolved = getComputedStyle(el).color;
  el.remove();
  return resolved;
}

// Build a standalone SVG of the rendered chart: title, legend and plot, with
// every CSS variable resolved so it looks the same outside the page.
export function buildExportSvg(chartSvg: SVGSVGElement, title: string, legend: LegendItem[]): { markup: string; width: number; height: number } {
  const width = Math.round(chartSvg.getBoundingClientRect().width);
  const plotHeight = Math.round(chartSvg.getBoundingClientRect().height);
  const clone = chartSvg.cloneNode(true) as SVGSVGElement;

  const originals = chartSvg.querySelectorAll("*");
  const copies = clone.querySelectorAll("*");
  originals.forEach((orig, i) => {
    const cs = getComputedStyle(orig);
    const copy = copies[i] as SVGElement;
    for (const prop of STYLE_PROPS) {
      const value = cs.getPropertyValue(prop);
      if (value) copy.setAttribute(prop, value);
    }
  });

  const surface = getComputedStyle(document.documentElement).getPropertyValue("--chart-surface").trim() || "#ffffff";
  const ink = resolveColor("var(--chart-ink)");
  const ink2 = resolveColor("var(--chart-ink-2)");
  const font = "system-ui, -apple-system, 'Segoe UI', sans-serif";

  let legendMarkup = "";
  let x = 16;
  for (const item of legend) {
    const swatch =
      item.shape === "rect"
        ? `<rect x="${x}" y="46" width="10" height="10" rx="2" fill="${item.color}"/>`
        : `<line x1="${x}" y1="51" x2="${x + 12}" y2="51" stroke="${item.color}" stroke-width="2" stroke-linecap="round"/>`;
    legendMarkup += `${swatch}<text x="${x + 16}" y="55" font-size="12" font-family="${font}" fill="${ink2}">${escapeXml(item.label)}</text>`;
    x += 16 + item.label.length * 7 + 20;
  }

  const header = legend.length ? 64 : 36;
  const height = plotHeight + header + 8;
  clone.setAttribute("x", "0");
  clone.setAttribute("y", String(header));
  const markup =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="100%" height="100%" fill="${surface}"/>` +
    `<text x="16" y="28" font-size="15" font-weight="600" font-family="${font}" fill="${ink}">${escapeXml(title)}</text>` +
    legendMarkup +
    new XMLSerializer().serializeToString(clone) +
    `</svg>`;
  return { markup, width, height };
}

export function svgToPng(markup: string, width: number, height: number, scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas isn't available."));
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG export failed."))), "image/png");
    };
    img.onerror = () => reject(new Error("PNG export failed."));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });
}
