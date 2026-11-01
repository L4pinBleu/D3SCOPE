/**
 * Data transformations for the plot model (ADR 0002, step 5-8). Pure functions
 * on arrays: no DOM, no scales. Marks call them, then draw the result.
 */
import type { Primitive } from './types.js';

/** Key of a category, so that `1` and `'1'` are the same slot on one axis. */
function keyOf(v: Primitive): string {
  return v instanceof Date ? `d:${String(v.getTime())}` : `${typeof v}:${String(v)}`;
}

export interface StackAccessors<T> {
  /** Position on the stacked axis (the category). */
  x: (row: T) => Primitive;
  /** The value stacked. Non-finite values are ignored. */
  y: (row: T) => number;
  /** The series. Each series is one layer of the stack. */
  series: (row: T) => string;
}

export interface StackedRow<T> {
  row: T;
  x: Primitive;
  series: string;
  /** Lower edge of the segment, in data units. */
  y0: number;
  /** Upper edge of the segment, in data units. */
  y1: number;
}

/**
 * Stack values per category. Series are stacked in order of first appearance.
 * Positive values stack upwards from 0, negative values stack downwards, so
 * the two never overlap.
 */
export function stackY<T>(rows: readonly T[], acc: StackAccessors<T>): StackedRow<T>[] {
  const seriesOrder: string[] = [];
  for (const row of rows) {
    const s = acc.series(row);
    if (!seriesOrder.includes(s)) seriesOrder.push(s);
  }
  const rank = new Map(seriesOrder.map((s, i) => [s, i]));
  const up = new Map<string, number>();
  const down = new Map<string, number>();
  const out: StackedRow<T>[] = [];
  const sorted = rows
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) =>
        (rank.get(acc.series(a.row)) ?? 0) - (rank.get(acc.series(b.row)) ?? 0) ||
        a.index - b.index,
    );
  for (const { row } of sorted) {
    const y = acc.y(row);
    if (!Number.isFinite(y)) continue;
    const x = acc.x(row);
    const k = keyOf(x);
    if (y >= 0) {
      const base = up.get(k) ?? 0;
      out.push({ row, x, series: acc.series(row), y0: base, y1: base + y });
      up.set(k, base + y);
    } else {
      const base = down.get(k) ?? 0;
      out.push({ row, x, series: acc.series(row), y0: base + y, y1: base });
      down.set(k, base + y);
    }
  }
  return out;
}

/**
 * Normalise a stack to 100 %: each category's segments are divided by the sum
 * of its absolute values, so every category spans from -1 to 1 (or 0 to 1 when
 * all values are positive).
 */
export function normalizeStack<T>(stacked: readonly StackedRow<T>[]): StackedRow<T>[] {
  const totals = new Map<string, number>();
  for (const s of stacked) {
    const k = keyOf(s.x);
    totals.set(k, (totals.get(k) ?? 0) + Math.abs(s.y1 - s.y0));
  }
  return stacked.map((s) => {
    const total = totals.get(keyOf(s.x)) ?? 0;
    if (total === 0) return { ...s, y0: 0, y1: 0 };
    return { ...s, y0: s.y0 / total, y1: s.y1 / total };
  });
}

export interface Slot {
  /** Index of the row in the input. */
  index: number;
  /** Position of this bar among the bars of its category, from 0. */
  slot: number;
  /** Number of bars in this category (the dodge width). */
  slots: number;
}

/**
 * Grouped bars: for each category, the bars of its series sit side by side.
 * Returns one entry per input row (rows without a finite value are skipped).
 */
export function dodge<T>(
  rows: readonly T[],
  acc: { x: (row: T) => Primitive; series: (row: T) => string; y: (row: T) => number },
): Slot[] {
  const seriesOrder: string[] = [];
  const perCategory = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!Number.isFinite(acc.y(row))) continue;
    const s = acc.series(row);
    if (!seriesOrder.includes(s)) seriesOrder.push(s);
    const k = keyOf(acc.x(row));
    let set = perCategory.get(k);
    if (set === undefined) {
      set = new Set();
      perCategory.set(k, set);
    }
    set.add(s);
  }
  const out: Slot[] = [];
  rows.forEach((row, index) => {
    if (!Number.isFinite(acc.y(row))) return;
    const k = keyOf(acc.x(row));
    const present = seriesOrder.filter((s) => perCategory.get(k)?.has(s));
    out.push({ index, slot: present.indexOf(acc.series(row)), slots: present.length });
  });
  return out;
}

export interface Bin {
  x0: number;
  x1: number;
  /** Values that fall in the bin. The last bin includes its upper edge. */
  values: number[];
}

/**
 * Round a bin width to 1, 2 or 5 times a power of ten, so the edges read well.
 */
export function niceBinWidth(span: number, count: number): number {
  const raw = span / Math.max(1, count);
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const r = raw / power;
  const nice = r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10;
  return nice * power;
}

/**
 * Histogram bins over `values`. `count` is the approximate number of bins
 * (default: Sturges, `ceil(log2(n) + 1)`). The edges fall on multiples of a
 * nice width. Non-finite values are ignored.
 */
export function bin(values: readonly number[], options: { count?: number } = {}): Bin[] {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return [];
  const lo = Math.min(...finite);
  const hi = Math.max(...finite);
  const count = options.count ?? Math.ceil(Math.log2(finite.length) + 1);
  const width = niceBinWidth(hi - lo, count);
  const start = Math.floor(lo / width) * width;
  // Enough bins to reach the largest value; a value on an exact edge goes in the last bin.
  const n = Math.max(1, Math.ceil((hi - start) / width - 1e-9));
  const bins: Bin[] = [];
  for (let k = 0; k < n; k++) {
    bins.push({
      x0: round(start + k * width, width),
      x1: round(start + (k + 1) * width, width),
      values: [],
    });
  }
  for (const v of finite) {
    const i = Math.min(n - 1, Math.max(0, Math.floor((v - start) / width + 1e-9)));
    bins[i]?.values.push(v);
  }
  return bins;
}

/** Remove floating-point noise from an edge, using the decimals of the width. */
function round(v: number, width: number): number {
  const decimals = Math.max(0, -Math.floor(Math.log10(width)) + 2);
  return Number(v.toFixed(decimals));
}
