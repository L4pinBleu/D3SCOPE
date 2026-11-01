/**
 * `dot(rows, options)`: a point mark. One `<circle>` per row. A fill given as
 * a field name is read as a colour category through the plot's colour scale;
 * any other string is a literal colour. Default: the theme accent.
 */
import { cssVar, LIGHT_THEME } from '../../theme/index.js';
import type { Mark, PlotContext, Primitive } from '../types.js';
import { accessor, toNumber, xPosition, type Accessor } from './line.js';

export interface DotOptions<T> {
  /** X accessor: a field name or a function. A Date, number or category string. */
  x: Accessor<T, Primitive>;
  /** Y accessor: a field name or a function. Must be numeric. */
  y: Accessor<T, number | null | undefined>;
  /** Radius in pixels. Default: 3. */
  r?: number;
  /**
   * Fill: a function, a literal CSS colour, or a field name of `T` read as a
   * colour category through `ctx.color`. Default: the theme accent.
   */
  fill?: string | ((row: T) => string);
  /** Opacity, from 0 to 1. Default: 1. */
  opacity?: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function dot<T>(rows: readonly T[], options: DotOptions<T>): Mark {
  const getX = accessor(options.x);
  const getY = accessor(options.y);

  const xValues: Primitive[] = [];
  const yValues: number[] = [];
  const colorValues: string[] = [];
  const valid: { row: T; x: Primitive; y: number }[] = [];
  for (const row of rows) {
    const x = getX(row);
    const y = toNumber(getY(row));
    if (x === null || x === undefined || y === null) continue;
    xValues.push(x);
    yValues.push(y);
    const category = fillCategory(row, options);
    if (category !== undefined) colorValues.push(category);
    valid.push({ row, x, y });
  }

  return {
    name: 'dot',
    xValues: () => xValues,
    yValues: () => yValues,
    ...(colorValues.length > 0 ? { colorValues: () => colorValues } : {}),
    render(ctx: PlotContext): void {
      const layer = ctx.layer('dot');
      const radius = options.r ?? 3;
      const opacity = options.opacity ?? 1;
      for (const point of valid) {
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('class', 'd3s-dot');
        circle.setAttribute('cx', String(xPosition(ctx, point.x)));
        circle.setAttribute('cy', String(ctx.y.position(point.y)));
        circle.setAttribute('r', String(radius));
        circle.setAttribute('fill', fillFor(point.row, options, ctx));
        if (opacity !== 1) circle.setAttribute('fill-opacity', String(opacity));
        layer.appendChild(circle);
      }
    },
  };
}

function isFieldOf(key: string, row: unknown): boolean {
  return typeof row === 'object' && row !== null && key in row;
}

/**
 * The colour category a row's fill declares, if any. A string that is a field
 * name of `T` is a category; a function or any other string is not.
 */
function fillCategory<T>(row: T, options: DotOptions<T>): string | undefined {
  const raw = options.fill;
  if (raw === undefined || typeof raw === 'function') return undefined;
  if (isFieldOf(raw, row)) return row[raw as keyof T] as string;
  return undefined;
}

/** The final fill colour for a row, given the plot's colour scale. */
function fillFor<T>(row: T, options: DotOptions<T>, ctx: PlotContext): string {
  const raw = options.fill;
  if (raw === undefined) return cssVar('accent', LIGHT_THEME.accent);
  if (typeof raw === 'function') return raw(row);
  if (isFieldOf(raw, row)) return ctx.color(row[raw as keyof T] as string);
  return raw;
}
