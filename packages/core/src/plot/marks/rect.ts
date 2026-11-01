/**
 * Bar marks. `rectY` draws vertical bars (category or linear x, numeric y);
 * `rectX` is the horizontal equivalent. A bar spans the band of its category,
 * or is centred on its value on a linear axis, and goes from the baseline
 * (value 0) to the value. Rows with a missing position or value are not drawn
 * and do not take part in the domain.
 */
import { cssVar, LIGHT_THEME } from '../../theme/index.js';
import type { Mark, PlotContext, Primitive } from '../types.js';
import {
  accessor,
  fillMode,
  isPlottable,
  toNumber,
  type Accessor,
  type FillMode,
} from './shared.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A value a bar sits on: a category (string) or a number. */
type Slot = string | number;

export interface RectOptions<T> {
  /** Category or number for the position axis: a field name or a function. */
  x?: Accessor<T, Slot>;
  /** Numeric value the bar reaches: a field name or a function. */
  y?: Accessor<T, number | null | undefined>;
  /**
   * Fill. A string that is a key of the rows is a category read through the
   * colour scale; any other string is a literal CSS colour; a function returns
   * the colour of each row. Default: the theme accent.
   */
  fill?: string | ((row: T) => string);
  /** Opacity of the bars. Default: 1. */
  opacity?: number;
  /** Bar width in pixels, on a linear axis only. Default: 80% of one row's share. */
  barWidth?: number;
}

/**
 * Build the bar mark. `orientation` says which axis carries the categories
 * (`y` for rectY: x is the category axis; `x` for rectX: y is).
 */
function barMark<T>(rows: readonly T[], options: RectOptions<T>, orientation: 'x' | 'y'): Mark {
  const name = orientation === 'y' ? 'rectY' : 'rectX';
  const mainField = orientation === 'y' ? options.x : options.y;
  const valueField = orientation === 'y' ? options.y : options.x;
  if (mainField === undefined || valueField === undefined) {
    throw new TypeError(`${name}: x and y are required`);
  }
  const main = accessor(mainField as Accessor<T, Slot>);
  const value = accessor(valueField as Accessor<T, number | null | undefined>);
  const fill: FillMode<T> = fillMode(options.fill, rows);

  // Only plottable, finite values reach the domain: a single missing value
  // must not make the whole axis unreadable.
  const mainValues = (): Primitive[] => rows.map(main).filter((s): s is Slot => isPlottable(s));
  const valueValues = (): number[] => {
    const out: number[] = [];
    for (const row of rows) {
      const v = toNumber(value(row));
      if (v !== null) out.push(v);
    }
    return out;
  };

  return {
    name,
    xValues(): readonly Primitive[] {
      return orientation === 'y' ? mainValues() : [...valueValues(), 0];
    },
    yValues(): readonly Primitive[] {
      return orientation === 'y' ? [...valueValues(), 0] : mainValues();
    },
    colorValues(): readonly string[] {
      if (fill.kind !== 'category') return [];
      const out: string[] = [];
      for (const row of rows) {
        const c = row[fill.field];
        if (typeof c === 'string' && c !== '') out.push(c);
      }
      return out;
    },
    render(ctx: PlotContext): void {
      const layer = ctx.layer('rect');
      const mainScale = orientation === 'y' ? ctx.x : ctx.y;
      const valueScale = orientation === 'y' ? ctx.y : ctx.x;
      const band = mainScale.bandwidth();
      const defaultWidth = Math.max(
        2,
        ((orientation === 'y' ? ctx.innerWidth : ctx.innerHeight) / Math.max(rows.length, 1)) * 0.8,
      );
      const width = band > 0 ? band : (options.barWidth ?? defaultWidth);
      for (const row of rows) {
        const v = toNumber(value(row));
        const slot = main(row);
        if (!isPlottable(slot) || v === null) continue;
        const start =
          band > 0 ? mainScale.position(String(slot)) : mainScale.position(slot) - width / 2;
        const p0 = valueScale.position(0);
        const p1 = valueScale.position(v);
        const lo = Math.min(p0, p1);
        const length = Math.abs(p1 - p0);
        const rect = document.createElementNS(SVG_NS, 'rect');
        if (orientation === 'y') {
          rect.setAttribute('x', String(start));
          rect.setAttribute('y', String(lo));
          rect.setAttribute('width', String(width));
          rect.setAttribute('height', String(length));
        } else {
          rect.setAttribute('x', String(lo));
          rect.setAttribute('y', String(start));
          rect.setAttribute('width', String(length));
          rect.setAttribute('height', String(width));
        }
        rect.setAttribute('fill', fillFor(row, fill, ctx));
        rect.setAttribute('opacity', String(options.opacity ?? 1));
        rect.setAttribute('class', 'd3s-bar');
        layer.appendChild(rect);
      }
    },
  };
}

/** The fill of one bar. A category that is missing falls back to the theme accent. */
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

/** Vertical bars: categories or numbers on x, numeric values on y. */
export function rectY<T>(rows: readonly T[], options: RectOptions<T>): Mark {
  return barMark(rows, options, 'y');
}

/** Horizontal bars: numeric values on x, categories or numbers on y. */
export function rectX<T>(rows: readonly T[], options: RectOptions<T>): Mark {
  return barMark(rows, options, 'x');
}
