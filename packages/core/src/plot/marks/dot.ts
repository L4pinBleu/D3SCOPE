/**
 * `dot(rows, options)`: a point mark. One `<circle>` per row. A fill given as
 * a field name is read as a colour category through the plot's colour scale;
 * any other string is a literal colour. Rows with a missing x or y are not
 * drawn; a row with a missing category is drawn in the theme accent.
 */
import { cssVar, LIGHT_THEME } from '../../theme/index.js';
import type { Mark, PlotContext, Primitive } from '../types.js';
import {
  accessor,
  fillMode,
  isPlottable,
  toNumber,
  xPosition,
  type Accessor,
  type FillMode,
} from './shared.js';

export interface DotOptions<T> {
  /** X accessor: a field name or a function. A Date, number or category string. */
  x: Accessor<T, Primitive>;
  /** Y accessor: a field name or a function. Must be numeric. */
  y: Accessor<T, number | null | undefined>;
  /** Radius in pixels. Default: 3. */
  r?: number;
  /**
   * Fill: a string that is a key of the rows is a category read through the
   * colour scale; any other string is a literal CSS colour; a function returns
   * the colour of each row. Default: the theme accent.
   */
  fill?: string | ((row: T) => string);
  /** Opacity, from 0 to 1. Default: 1. */
  opacity?: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function dot<T>(rows: readonly T[], options: DotOptions<T>): Mark {
  const getX = accessor(options.x);
  const getY = accessor(options.y);
  const fill: FillMode<T> = fillMode(options.fill, rows);

  // Only rows with a plottable x and a finite y are kept.
  const valid: { row: T; x: Primitive; y: number }[] = [];
  for (const row of rows) {
    const x = getX(row);
    const y = toNumber(getY(row));
    if (!isPlottable(x) || y === null) continue;
    valid.push({ row, x, y });
  }

  return {
    name: 'dot',
    xValues: () => valid.map((p) => p.x),
    yValues: () => valid.map((p) => p.y),
    colorValues: () => {
      if (fill.kind !== 'category') return [];
      const out: string[] = [];
      for (const p of valid) {
        const c = p.row[fill.field];
        if (typeof c === 'string' && c !== '') out.push(c);
      }
      return out;
    },
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
        circle.setAttribute('fill', fillFor(point.row, fill, ctx));
        if (opacity !== 1) circle.setAttribute('fill-opacity', String(opacity));
        layer.appendChild(circle);
      }
    },
  };
}

/** The fill of one dot. A category that is missing falls back to the theme accent. */
function fillFor<T>(row: T, fill: FillMode<T>, ctx: PlotContext): string {
  switch (fill.kind) {
    case 'category': {
      const c = row[fill.field];
      return typeof c === 'string' && c !== ''
        ? ctx.color(c)
        : cssVar('accent', LIGHT_THEME.accent);
    }
    case 'literal':
      return fill.colour;
    case 'function':
      return fill.compute(row);
    case 'default':
      return cssVar('accent', LIGHT_THEME.accent);
  }
}
