/**
 * Brush layout and time-range maths (pure, no DOM). Time is mapped linearly to
 * pixels over the series' first and last dates.
 */
export interface BrushPoint {
  date: Date;
  value: number;
}

/** A time range, from the earlier to the later date. */
export type TimeRange = readonly [Date, Date];

export interface BrushLayout {
  /** Points sorted by date, with pixel positions inside the plot. */
  points: { x: number; y: number; date: Date; value: number }[];
  /** Line and area paths for the overview. Empty when there is no data. */
  linePath: string;
  areaPath: string;
  width: number;
  height: number;
  /** First and last time in ms. */
  t0: number;
  t1: number;
}

/** Vertical space kept free at the top and bottom of the overview, in px. */
const PAD = 2;

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Lay out the overview of `data` in `width` × `height`. Pure. */
export function layoutBrush(
  data: readonly BrushPoint[],
  width: number,
  height: number,
): BrushLayout {
  const sorted = [...data].sort((a, b) => a.date.getTime() - b.date.getTime());
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const t0 = first?.date.getTime() ?? 0;
  const t1 = last?.date.getTime() ?? 1;
  const values = sorted.map((p) => p.value);
  const lo = values.length > 0 ? Math.min(...values) : 0;
  const hi = values.length > 0 ? Math.max(...values) : 1;
  const span = t1 - t0 || 1;
  const vspan = hi - lo || 1;
  const innerH = Math.max(0, height - PAD * 2);

  const points = sorted.map((p) => ({
    x: ((p.date.getTime() - t0) / span) * width,
    y: PAD + innerH - ((p.value - lo) / vspan) * innerH,
    date: p.date,
    value: p.value,
  }));

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p.x)},${fmt(p.y)}`).join(' ');
  const last2 = points[points.length - 1];
  const area =
    points.length === 0 || !last2
      ? ''
      : `${line} L${fmt(last2.x)},${fmt(height)} L${fmt(points[0]?.x ?? 0)},${fmt(height)} Z`;
  return { points, linePath: line, areaPath: area, width, height, t0, t1 };
}

/** Pixel x of a time (ms) on the overview. */
export function timeToX(t: number, layout: BrushLayout): number {
  return ((t - layout.t0) / (layout.t1 - layout.t0 || 1)) * layout.width;
}

/** Time (ms) at pixel x, clamped to the overview. */
export function xToTime(x: number, layout: BrushLayout): number {
  const clamped = Math.min(layout.width, Math.max(0, x));
  return layout.t0 + (clamped / (layout.width || 1)) * (layout.t1 - layout.t0);
}

/** A range as sorted pixel positions, clamped to the overview. */
export function rangeToPixels(range: TimeRange, layout: BrushLayout): [number, number] {
  const a = timeToX(range[0].getTime(), layout);
  const b = timeToX(range[1].getTime(), layout);
  return [Math.min(a, b), Math.max(a, b)];
}

/** Two pixel positions as a time range, sorted and clamped. */
export function pixelsToRange(x0: number, x1: number, layout: BrushLayout): TimeRange {
  const a = xToTime(x0, layout);
  const b = xToTime(x1, layout);
  return [new Date(Math.min(a, b)), new Date(Math.max(a, b))];
}

/** Whether two ranges cover the same instants. */
export function sameRange(a: TimeRange | undefined, b: TimeRange | undefined): boolean {
  if (!a || !b) return a === b;
  return a[0].getTime() === b[0].getTime() && a[1].getTime() === b[1].getTime();
}
