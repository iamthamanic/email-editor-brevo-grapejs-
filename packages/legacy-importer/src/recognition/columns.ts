/**
 * Column width helpers.
 * Location: packages/legacy-importer/src/recognition/columns.ts
 */

export function columnWidthPercent(cell: Element, fallbackEqual: number): number {
  const w = cell.getAttribute("width") ?? "";
  if (w.endsWith("%")) {
    const n = Number.parseInt(w, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const n = Number.parseInt(w, 10);
  if (Number.isFinite(n) && n > 0 && n <= 100) return n;
  // Absolute px vs 600 → approximate percent
  if (Number.isFinite(n) && n > 100) {
    return Math.round((n / 600) * 100);
  }
  const style = cell.getAttribute("style") ?? "";
  const pct = /width\s*:\s*(\d+)\s*%/i.exec(style);
  if (pct) return Number.parseInt(pct[1]!, 10);
  const px = /width\s*:\s*(\d+)\s*px/i.exec(style);
  if (px) {
    const v = Number.parseInt(px[1]!, 10);
    if (v > 100) return Math.round((v / 600) * 100);
    if (v > 0) return v;
  }
  return fallbackEqual;
}

export function normalizeColumnWidths(widths: number[]): number[] {
  const sum = widths.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    const eq = Math.floor(100 / widths.length);
    return widths.map((_, i) =>
      i === widths.length - 1 ? 100 - eq * (widths.length - 1) : eq,
    );
  }
  if (Math.abs(sum - 100) <= 2) return widths.map((w) => Math.round(w));
  return widths.map((w) => Math.round((w / sum) * 100));
}
