/**
 * Area marks. `area` draws one filled area per series, from the baseline
 * (value 0, clamped into the domain) up to y. `stackedArea` stacks the series
 * per x with `stackY` (optionally normalised with `normalizeStack`) and draws
 * each series as the band between its y0 and y1 lines. Rows with a missing
 * or non-finite x or y are not drawn and do not reach a domain. A stacked
 * series with a single point has no area and is not drawn (a band needs two
 * x positions).
 */
import { cssVar, LIGHT_THEME } from '../../theme/index.js';
import { curveAreaPath, type CurveType } from '../curves.js';
import { normalizeStack, stackY, type StackedRow } from '../transforms.js';
import type { Mark, PlotContext, Primitive } from '../types.js';
import {
  accessor,
  fillMode,
  isPlottable,
  toMillis,
  toNumber,
  xPosition,
  type Accessor,
} from './shared.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface AreaOptions<T> {
  /** X accessor: a field name or a function. A Date, number or category string. */
  x: Accessor<T, Primitive>;
  /** Y accessor: a field name or a function. Must be numeric. */
  y: Accessor<T, number | null | undefined>;
  /** Series accessor: rows are grouped by series; each series gets an area. */
  series?: Accessor<T, string>;
  /** Literal fill colour. Used when no series is given, or to override it. */
  fill?: string;
  /** Opacity of the areas. Default: 1. */
  opacity?: number;
  /** How the top line is interpolated between points. Default: `linear`. */
  curve?: CurveType;
}

/**
 * The pixel y of the baseline: value 0 clamped into the y domain, so an area
 * with a fixed domain that excludes 0 still closes on the visible edge.
 */
function baselineY(ctx: PlotContext): number {
  const numbers = ctx.y.domain.filter((v): v is number => typeof v === 'number');
  if (numbers.length === 0) return ctx.y.position(0);
  const lo = Math.min(...numbers);
  const hi = Math.max(...numbers);
  return ctx.y.position(Math.min(Math.max(0, lo), hi));
}

export function area<T>(rows: readonly T[], options: AreaOptions<T>): Mark {
  const getX = accessor(options.x);
  const getY = accessor(options.y);
  const getSeries = options.series === undefined ? undefined : accessor(options.series);
  const fill = fillMode(options.fill, rows);

  // Group rows by series, keeping the order of first appearance, exactly as
  // the line mark does. A row with no series value goes to its own group,
  // filled in the theme accent.
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
    name: 'area',
    xValues: () => xValues,
    // The areas close on the baseline, so 0 belongs to the y domain.
    yValues: () => [...yValues, 0],
    ...(getSeries === undefined ? {} : { colorValues: () => categories }),
    render(ctx: PlotContext): void {
      const layer = ctx.layer('area');
      const base = baselineY(ctx);
      for (const [category, points] of groups) {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('class', 'd3s-area');
        path.setAttribute('opacity', String(options.opacity ?? 1));
        if (fill.kind === 'literal') {
          path.setAttribute('fill', fill.colour);
        } else if (category !== undefined) {
          path.setAttribute('fill', ctx.color(category));
        } else {
          path.setAttribute('fill', cssVar('accent', LIGHT_THEME.accent));
        }
        path.setAttribute('d', areaPathD(points, ctx, base, options.curve));
        layer.appendChild(path);
      }
    },
  };
}

/**
 * A closed area path: the top line forward, then straight back along the
 * baseline to the first point, then `Z`.
 */
export function areaPathD(
  points: readonly { x: Primitive; y: number }[],
  ctx: PlotContext,
  baseline: number,
  curve: CurveType = 'linear',
): string {
  const sorted = [...points];
  if (ctx.x.kind !== 'band') sorted.sort((a, b) => toMillis(a.x) - toMillis(b.x));
  if (sorted.length === 0) return 'Z';
  const top: { x: number; y: number }[] = [];
  for (const point of sorted) {
    top.push({ x: xPosition(ctx, point.x), y: ctx.y.position(point.y) });
  }
  const first = top[0];
  const last = top[top.length - 1];
  if (first === undefined || last === undefined) return 'Z';
  const bottom = [
    { x: first.x, y: baseline },
    { x: last.x, y: baseline },
  ];
  return curveAreaPath(top, bottom, curve);
}

export interface StackedAreaOptions<T> {
  /** X accessor: a field name or a function. A Date, number or category string. */
  x: Accessor<T, Primitive>;
  /** Y accessor: a field name or a function. Must be numeric. */
  y: Accessor<T, number | null | undefined>;
  /** Series accessor: each series is one layer of the stack. Required. */
  series: Accessor<T, string>;
  /** Normalise every category to 100 % (0 to 1 for positive values). */
  normalize?: boolean;
  /** Opacity of the areas. Default: 1. */
  opacity?: number;
  /** How the top and bottom lines are interpolated between points. Default: `linear`. */
  curve?: CurveType;
}

export function stackedArea<T>(rows: readonly T[], options: StackedAreaOptions<T>): Mark {
  const getX = accessor(options.x);
  const getY = accessor(options.y);
  const getSeries = accessor(options.series);

  // Only plottable, finite rows are stacked: a missing value must neither be
  // drawn nor move any other series' baseline.
  const usable: { row: T; x: Primitive; series: string | undefined }[] = [];
  const xValues: Primitive[] = [];
  for (const row of rows) {
    const x = getX(row);
    const y = toNumber(getY(row));
    if (!isPlottable(x) || y === null) continue;
    const raw = getSeries(row);
    const category = typeof raw === 'string' && raw !== '' ? raw : undefined;
    xValues.push(x);
    usable.push({ row, x, series: category });
  }

  // Rows without a series value still stack, in one sentinel layer drawn in
  // the theme accent, as the line mark does.
  const stacked = stackY(usable, {
    x: (r) => r.x,
    y: (r) => toNumber(getY(r.row)) ?? 0,
    series: (r) => r.series ?? '\u0000no-series',
  });
  const bands = options.normalize === true ? normalizeStack(stacked) : stacked;

  const yValues = (): number[] => {
    const out: number[] = [0];
    for (const s of bands) {
      out.push(s.y0, s.y1);
    }
    return out;
  };
  const categories = (): string[] => {
    const out: string[] = [];
    for (const s of bands) {
      if (s.series !== '\u0000no-series') out.push(s.series);
    }
    return out;
  };

  return {
    name: 'stackedArea',
    xValues: () => xValues,
    yValues,
    colorValues: categories,
    render(ctx: PlotContext): void {
      const layer = ctx.layer('area');
      // One band per series: its segments in x order, the y1 line forward and
      // the y0 line backward, closed.
      const perSeries = new Map<
        string,
        StackedRow<{ row: T; x: Primitive; series: string | undefined }>[]
      >();
      for (const s of bands) {
        let list = perSeries.get(s.series);
        if (list === undefined) {
          list = [];
          perSeries.set(s.series, list);
        }
        list.push(s);
      }
      for (const [series, segments] of perSeries) {
        const sorted = [...segments];
        if (ctx.x.kind !== 'band') sorted.sort((a, b) => toMillis(a.x) - toMillis(b.x));
        if (sorted.length < 2) continue;
        const top: { x: number; y: number }[] = [];
        const bottom: { x: number; y: number }[] = [];
        for (const s of sorted) {
          const x = xPosition(ctx, s.x);
          top.push({ x, y: ctx.y.position(s.y1) });
          bottom.push({ x, y: ctx.y.position(s.y0) });
        }
        const d = curveAreaPath(top, bottom, options.curve);
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('class', 'd3s-area');
        path.setAttribute('data-series', series === '\u0000no-series' ? '' : series);
        path.setAttribute('opacity', String(options.opacity ?? 1));
        path.setAttribute(
          'fill',
          series === '\u0000no-series' ? cssVar('accent', LIGHT_THEME.accent) : ctx.color(series),
        );
        path.setAttribute('d', d);
        layer.appendChild(path);
      }
    },
  };
}
