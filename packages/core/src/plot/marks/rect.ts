/**
 * Bar marks. `rectY` draws vertical bars (category or linear x, numeric y);
 * `rectX` is the horizontal equivalent. A bar spans the band of its category,
 * or is centred on its value on a linear axis, and goes from the baseline
 * (value 0) to the value. Rows with a missing position or value are not drawn
 * and do not take part in the domain.
 *
 * `stack` stacks the rows of each category by series (with `normalize`, to
 * 100 %); `group` puts the bars of a series side by side inside the band. In
 * both modes the colour of a bar is its series colour; a row without a series
 * value is drawn in the theme accent.
 */
import { cssVar, LIGHT_THEME } from '../../theme/index.js';
import { dodge, normalizeStack, stackY } from '../transforms.js';
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

/** Internal key for a row whose series value is missing or empty. */
const MISSING_SERIES = '\u0000missing';

export interface RectOptions<T> {
  /** Category or number for the position axis: a field name or a function. */
  x?: Accessor<T, Slot>;
  /** Numeric value the bar reaches: a field name or a function. */
  y?: Accessor<T, number | null | undefined>;
  /**
   * Fill. A string that is a key of the rows is a category read through the
   * colour scale; any other string is a literal CSS colour; a function returns
   * the colour of each row. Default: the theme accent. Unused with `stack`
   * or `group`, where the colour is the series colour.
   */
  fill?: string | ((row: T) => string);
  /** Opacity of the bars. Default: 1. */
  opacity?: number;
  /** Bar width in pixels, on a linear axis only. Default: 80% of one row's share. */
  barWidth?: number;
  /** Stack the rows of each category by series. */
  stack?: { series: Accessor<T, string> };
  /** Normalise a stacked bar chart to 100 % (each category spans 0..1 or -1..1). */
  normalize?: boolean;
  /** Group the bars of each category side by side, one sub-bar per series. */
  group?: { series: Accessor<T, string> };
}

/** How the bars of one category are laid out. */
type LayoutMode = 'plain' | 'stack' | 'group';

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
  const mode: LayoutMode = options.stack ? 'stack' : options.group ? 'group' : 'plain';
  const seriesField = options.stack?.series ?? options.group?.series;
  const getSeries = seriesField === undefined ? undefined : accessor(seriesField);
  const fill: FillMode<T> = fillMode(options.fill, rows);

  /** The series key of a row; `MISSING_SERIES` when it has none. */
  const seriesOf = (row: T): string => {
    const s = getSeries?.(row);
    return typeof s === 'string' && s !== '' ? s : MISSING_SERIES;
  };
  /** The value of a row as the transforms expect it: NaN when missing. */
  const valueOf = (row: T): number => toNumber(value(row)) ?? Number.NaN;
  // Rows without a plottable position never take part: not in a stack, not in a
  // group, not in a domain, and not drawn.
  const plottable = rows.filter((row) => isPlottable(main(row)));

  // Only plottable, finite values reach the domain: a single missing value
  // must not make the whole axis unreadable.
  const mainValues = (): Primitive[] => rows.map(main).filter((s): s is Slot => isPlottable(s));
  const stacked =
    mode === 'stack'
      ? options.normalize
        ? normalizeStack(
            stackY(plottable, {
              x: (row) => main(row) as Primitive,
              y: valueOf,
              series: seriesOf,
            }),
          )
        : stackY(plottable, {
            x: (row) => main(row) as Primitive,
            y: valueOf,
            series: seriesOf,
          })
      : [];
  const dodgeSlots =
    mode === 'group'
      ? dodge(plottable, { x: (row) => main(row) as Primitive, y: valueOf, series: seriesOf })
      : [];

  const valueValues = (): number[] => {
    if (mode === 'stack') {
      // The value axis must cover every stacked edge, positive or negative.
      const out: number[] = [];
      for (const s of stacked) {
        out.push(s.y0, s.y1);
      }
      return out;
    }
    const out: number[] = [];
    for (const row of plottable) {
      const v = toNumber(value(row));
      if (v !== null) out.push(v);
    }
    return out;
  };

  /** Series categories the mark uses, in order of first appearance. */
  const seriesCategories = (): string[] => {
    if (getSeries === undefined) return [];
    const out: string[] = [];
    for (const row of plottable) {
      const s = seriesOf(row);
      if (s !== MISSING_SERIES && !out.includes(s)) out.push(s);
    }
    return out;
  };

  /** The colour of a bar: the series colour, or the accent for a missing series. */
  const seriesFill = (series: string, hasSeries: boolean, ctx: PlotContext): string =>
    hasSeries ? ctx.color(series) : cssVar('accent', LIGHT_THEME.accent);

  return {
    name,
    xValues(): readonly Primitive[] {
      return orientation === 'y' ? mainValues() : [...valueValues(), 0];
    },
    yValues(): readonly Primitive[] {
      return orientation === 'y' ? [...valueValues(), 0] : mainValues();
    },
    colorValues(): readonly string[] {
      if (getSeries !== undefined) return seriesCategories();
      if (fill.kind !== 'category') return [];
      const out: string[] = [];
      for (const row of plottable) {
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
      const baseWidth = band > 0 ? band : (options.barWidth ?? defaultWidth);

      if (mode === 'stack') {
        // One rect per segment, drawn from its stacked y0 to its y1.
        for (const s of stacked) {
          const width = baseWidth;
          const start =
            band > 0 ? mainScale.position(String(s.x)) : mainScale.position(s.x) - width / 2;
          const p0 = valueScale.position(s.y0);
          const p1 = valueScale.position(s.y1);
          const lo = Math.min(p0, p1);
          const length = Math.abs(p1 - p0);
          layer.appendChild(
            barRect({
              main: orientation === 'y' ? start : lo,
              across: orientation === 'y' ? lo : start,
              width: orientation === 'y' ? width : length,
              height: orientation === 'y' ? length : width,
              fill: seriesFill(s.series, s.series !== MISSING_SERIES, ctx),
              opacity: options.opacity ?? 1,
              series: s.series !== MISSING_SERIES ? s.series : '',
            }),
          );
        }
        return;
      }

      if (mode === 'group') {
        // The bars of one category sit side by side inside the band: the slot
        // width is band / slots, with 2 px of inner padding (never below 1 px).
        for (const s of dodgeSlots) {
          const row = plottable[s.index];
          if (row === undefined) continue;
          const v = toNumber(value(row));
          const slotValue = main(row);
          if (!isPlottable(slotValue) || v === null) continue;
          const slotWidth = baseWidth / Math.max(s.slots, 1);
          const width = Math.max(1, slotWidth - 2);
          const start =
            band > 0
              ? mainScale.position(String(slotValue)) + s.slot * slotWidth + 1
              : mainScale.position(slotValue) - baseWidth / 2 + s.slot * slotWidth + 1;
          const p0 = valueScale.position(0);
          const p1 = valueScale.position(v);
          const lo = Math.min(p0, p1);
          const length = Math.abs(p1 - p0);
          const series = seriesOf(row);
          layer.appendChild(
            barRect({
              main: orientation === 'y' ? start : lo,
              across: orientation === 'y' ? lo : start,
              width: orientation === 'y' ? width : length,
              height: orientation === 'y' ? length : width,
              fill: seriesFill(series, series !== MISSING_SERIES, ctx),
              opacity: options.opacity ?? 1,
              series: series === MISSING_SERIES ? '' : series,
            }),
          );
        }
        return;
      }

      for (const row of rows) {
        const v = toNumber(value(row));
        const slot = main(row);
        if (!isPlottable(slot) || v === null) continue;
        const start =
          band > 0 ? mainScale.position(String(slot)) : mainScale.position(slot) - baseWidth / 2;
        const p0 = valueScale.position(0);
        const p1 = valueScale.position(v);
        const lo = Math.min(p0, p1);
        const length = Math.abs(p1 - p0);
        const rect = barRect({
          main: orientation === 'y' ? start : lo,
          across: orientation === 'y' ? lo : start,
          width: orientation === 'y' ? baseWidth : length,
          height: orientation === 'y' ? length : baseWidth,
          fill: fillFor(row, fill, ctx),
          opacity: options.opacity ?? 1,
          series: '',
        });
        layer.appendChild(rect);
      }
    },
  };
}

interface BarGeometry {
  /** Start of the bar on the category axis, in pixels. */
  main: number;
  /** Lower edge of the bar on the value axis, in pixels. */
  across: number;
  width: number;
  height: number;
  fill: string;
  opacity: number;
  /** The series the bar belongs to (`''` when there is none). */
  series: string;
}

/** Build one `<rect class="d3s-bar">` from its geometry. */
function barRect(g: BarGeometry): SVGRectElement {
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('x', String(g.main));
  rect.setAttribute('y', String(g.across));
  rect.setAttribute('width', String(g.width));
  rect.setAttribute('height', String(g.height));
  rect.setAttribute('fill', g.fill);
  rect.setAttribute('opacity', String(g.opacity));
  rect.setAttribute('class', 'd3s-bar');
  if (g.series !== '') rect.setAttribute('data-series', g.series);
  return rect;
}

/** The fill of one plain bar. A category that is missing falls back to the theme accent. */
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
