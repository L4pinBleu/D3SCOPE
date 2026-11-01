/**
 * `line(rows, options)`: a line mark. One `<path>` per series, drawn from the
 * rows, sorted by x within each series. Series values double as colour
 * categories, so the plot's colour scale assigns each series its colour.
 */
import { cssVar, LIGHT_THEME } from '../../theme/index.js';
import type { Mark, PlotContext, Primitive } from '../types.js';

/** An accessor: a field name of the row object, or a function. */
export type Accessor<T, V> = keyof T | ((row: T) => V);

export interface LineOptions<T> {
  /** X accessor: a field name or a function. A Date, number or category string. */
  x: Accessor<T, Primitive>;
  /** Y accessor: a field name or a function. Must be numeric. */
  y: Accessor<T, number | null | undefined>;
  /** Series accessor: rows are grouped by series; each series gets a path and a colour. */
  series?: Accessor<T, string>;
  /** Literal stroke colour. Used when no series is given, or to override it. */
  stroke?: string;
  /** Stroke width in pixels. Default: 1.5. */
  strokeWidth?: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function line<T>(rows: readonly T[], options: LineOptions<T>): Mark {
  const getX = accessor(options.x);
  const getY = accessor(options.y);
  const getSeries = options.series === undefined ? undefined : accessor(options.series);

  // Group rows by series, keeping the order of first appearance.
  const groups = new Map<string, { x: Primitive; y: number }[]>();
  const xValues: Primitive[] = [];
  const yValues: number[] = [];
  const categories: string[] = [];
  for (const row of rows) {
    const x = getX(row);
    const y = toNumber(getY(row));
    if (x === null || x === undefined || y === null) continue;
    xValues.push(x);
    yValues.push(y);
    const category = getSeries === undefined ? undefined : (getSeries(row) ?? undefined);
    if (category !== undefined) categories.push(category);
    let points = groups.get(category ?? '');
    if (points === undefined) {
      points = [];
      groups.set(category ?? '', points);
    }
    points.push({ x, y });
  }

  return {
    name: 'line',
    xValues: () => xValues,
    yValues: () => yValues,
    ...(getSeries === undefined ? {} : { colorValues: () => categories }),
    render(ctx: PlotContext): void {
      const layer = ctx.layer('line');
      const width = options.strokeWidth ?? 1.5;
      for (const [category, points] of groups) {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('class', 'd3s-line');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-width', String(width));
        if (options.stroke !== undefined) {
          path.setAttribute('stroke', options.stroke);
        } else if (getSeries !== undefined) {
          path.setAttribute('stroke', ctx.color(category));
        } else {
          path.setAttribute('stroke', cssVar('accent', LIGHT_THEME.accent));
        }
        path.setAttribute('d', pathD(points, ctx));
        layer.appendChild(path);
      }
    },
  };
}

/** A path string from the points, sorted by x (data order for band x). */
export function pathD(points: readonly { x: Primitive; y: number }[], ctx: PlotContext): string {
  const sorted = [...points];
  if (ctx.x.kind !== 'band') sorted.sort((a, b) => toMillis(a.x) - toMillis(b.x));
  let d = '';
  let first = true;
  for (const point of sorted) {
    const px = xPosition(ctx, point.x);
    const py = ctx.y.position(point.y);
    d += `${first ? 'M' : 'L'}${String(px)},${String(py)}`;
    first = false;
  }
  return d;
}

/** Pixel x of a value: band centre for band scales, else the plain position. */
export function xPosition(ctx: PlotContext, value: Primitive): number {
  const p = ctx.x.position(value);
  const bandwidth = ctx.x.bandwidth();
  return bandwidth > 0 ? p + bandwidth / 2 : p;
}

/**
 * Resolve an accessor: a field name of the row, or the function itself. The
 * row field may be missing at runtime, so the result can be null/undefined.
 */
export function accessor<T, V>(key: Accessor<T, V>): (row: T) => V | null | undefined {
  return typeof key === 'function' ? (row) => key(row) : (row) => row[key] as V | null | undefined;
}

/** Coerce a value to a finite number, or `null` when missing or NaN. */
export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.getTime();
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Coerce a Primitive to a number for ordering (Date → ms, string → NaN). */
export function toMillis(value: Primitive): number {
  if (value instanceof Date) return value.getTime();
  return typeof value === 'number' ? value : Number(value);
}
