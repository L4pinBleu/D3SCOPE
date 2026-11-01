/**
 * Bar marks. `rectY` draws vertical bars (category or linear x, numeric y);
 * `rectX` is the horizontal equivalent. A bar spans the band of its category,
 * or is centred on its value on a linear axis, and goes from the baseline
 * (value 0) to the value.
 */
import type { Mark, PlotContext, Primitive } from '../types.js';
import { cssVar, LIGHT_THEME } from '../../theme/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Read one value from a row: by field name or by accessor. */
type Field<T, V> = keyof T | ((row: T) => V);

function read<T, V>(row: T, field: Field<T, V>): V {
  return typeof field === 'function' ? field(row) : (row[field] as V);
}

/** A value a bar sits on: a category (string) or a number. */
type Slot = string | number;

export interface RectOptions<T> {
  /** Category or number for the position axis. */
  x?: Field<T, Slot>;
  /** Numeric value the bar reaches. */
  y?: Field<T, number>;
  /** Field of a category (coloured by `ctx.color`) or a literal CSS colour. */
  fill?: string | ((row: T) => string);
  /** Opacity of the bars. Default: 1. */
  opacity?: number;
  /** Bar width in pixels, on a linear x axis only. Default: 80% of one row's share. */
  barWidth?: number;
}

/**
 * Build the bar mark. `main` is the axis that carries the categories/numbers,
 * `value` the axis the bars extend along.
 */
function barMark<T>(rows: readonly T[], options: RectOptions<T>, orientation: 'x' | 'y'): Mark {
  const name = orientation === 'y' ? 'rectY' : 'rectX';
  const mainField = orientation === 'y' ? options.x : options.y;
  const valueField = orientation === 'y' ? options.y : options.x;
  if (mainField === undefined || valueField === undefined) {
    throw new TypeError(`${name}: x and y are required`);
  }
  const main = (row: T): Slot => read(row, mainField as Field<T, Slot>);
  const value = (row: T): number => read(row, valueField as Field<T, number>);

  return {
    name,
    xValues(): readonly Primitive[] {
      return orientation === 'y' ? rows.map(main) : [...rows.map(value), 0];
    },
    yValues(): readonly Primitive[] {
      return orientation === 'y' ? [...rows.map(value), 0] : rows.map(main);
    },
    colorValues(): readonly string[] {
      // A colour only comes from the plot when `fill` names a category field.
      if (typeof options.fill !== 'string' || options.fill === '') return [];
      if (!isField(options.fill, rows[0])) return [];
      return rows.map((row) => read(row, options.fill as Field<T, string>));
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
      const accent = cssVar('accent', LIGHT_THEME.accent);
      for (const row of rows) {
        const v = value(row);
        const slot = main(row);
        if (!isValid(slot) || !Number.isFinite(v)) continue;
        const fill =
          typeof options.fill === 'function'
            ? options.fill(row)
            : typeof options.fill === 'string'
              ? isField(options.fill, rows[0])
                ? ctx.color(read(row, options.fill as Field<T, string>))
                : options.fill
              : accent;
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
        rect.setAttribute('fill', fill);
        rect.setAttribute('opacity', String(options.opacity ?? 1));
        rect.setAttribute('class', 'd3s-bar');
        layer.appendChild(rect);
      }
    },
  };
}

function isValid(slot: unknown): boolean {
  if (slot === undefined || slot === null) return false;
  if (typeof slot === 'number') return Number.isFinite(slot);
  return slot !== '';
}

function isField(key: string, row: unknown): boolean {
  return typeof row === 'object' && row !== null && key in row;
}

/** Vertical bars: categories or numbers on x, numeric values on y. */
export function rectY<T>(rows: readonly T[], options: RectOptions<T>): Mark {
  return barMark(rows, options, 'y');
}

/** Horizontal bars: numeric values on x, categories or numbers on y. */
export function rectX<T>(rows: readonly T[], options: RectOptions<T>): Mark {
  return barMark(rows, options, 'x');
}
