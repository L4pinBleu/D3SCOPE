/**
 * `line(rows, options)`: a line mark. One `<path>` per series, drawn from the
 * rows, sorted by x within each series. Series values double as colour
 * categories, so the plot's colour scale assigns each series its colour. Rows
 * with a missing x or y are not drawn; rows with a missing series value are
 * drawn as one extra line in the theme accent.
 */
import { cssVar, LIGHT_THEME } from '../../theme/index.js';
import { curvePath, type CurveType } from '../curves.js';
import type { Mark, PlotContext, Primitive } from '../types.js';
import { accessor, isPlottable, toMillis, toNumber, xPosition, type Accessor } from './shared.js';

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
  /** How the line is interpolated between points. Default: `linear`. */
  curve?: CurveType;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function line<T>(rows: readonly T[], options: LineOptions<T>): Mark {
  const getX = accessor(options.x);
  const getY = accessor(options.y);
  const getSeries = options.series === undefined ? undefined : accessor(options.series);

  // Group rows by series, keeping the order of first appearance. A row with no
  // series value goes to its own group, drawn in the accent colour.
  const groups = new Map<string | undefined, { x: Primitive; y: number }[]>();
  const xValues: Primitive[] = [];
  const yValues: number[] = [];
  const categories: string[] = [];
  for (const row of rows) {
    const x = getX(row);
    const y = toNumber(getY(row));
    if (!isPlottable(x) || y === null) continue;
    xValues.push(x);
    yValues.push(y);
    const raw = getSeries === undefined ? undefined : getSeries(row);
    const category = typeof raw === 'string' && raw !== '' ? raw : undefined;
    if (category !== undefined) categories.push(category);
    let points = groups.get(category);
    if (points === undefined) {
      points = [];
      groups.set(category, points);
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
        } else if (category !== undefined) {
          path.setAttribute('stroke', ctx.color(category));
        } else {
          path.setAttribute('stroke', cssVar('accent', LIGHT_THEME.accent));
        }
        path.setAttribute('d', pathD(points, ctx, options.curve));
        layer.appendChild(path);
      }
    },
  };
}

/** A path string from the points, sorted by x (data order for band x). */
export function pathD(
  points: readonly { x: Primitive; y: number }[],
  ctx: PlotContext,
  curve: CurveType = 'linear',
): string {
  const sorted = [...points];
  if (ctx.x.kind !== 'band') sorted.sort((a, b) => toMillis(a.x) - toMillis(b.x));
  return curvePath(
    sorted.map((point) => ({ x: xPosition(ctx, point.x), y: ctx.y.position(point.y) })),
    curve,
  );
}
