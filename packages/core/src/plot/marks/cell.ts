/**
 * `cell(rows, options)`: a heatmap mark (ADR 0002, step 8). Each row is one
 * rectangle covering its cell: the full band on a band axis, or one equal
 * share of the plot area per distinct value on a continuous axis. The colour
 * is interpolated from a light to a dark tone of the theme accent by the
 * numeric `fill` accessor, normalised over the valid values. Rows with a
 * missing x, y or fill are skipped. Fill values never reach an axis domain.
 */
import { interpolateColor } from '../../legends/continuous.js';
import type { Mark, PlotContext, Primitive } from '../types.js';
import { accessor, isPlottable, toNumber, type Accessor } from './shared.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A value a cell sits on: a category (string) or a number. */
type Slot = string | number;

export interface CellOptions<T> {
  /** Category or number on x: a field name or a function. */
  x: Accessor<T, Slot>;
  /** Category or number on y: a field name or a function. */
  y: Accessor<T, Slot>;
  /** Numeric value the colour encodes: a field name or a function. */
  fill: Accessor<T, number | null | undefined>;
  /** Opacity of the cells, from 0 to 1. Default: 1. */
  opacity?: number;
}

// Light and dark tones of the theme accent. Literals, not `cssVar` tokens:
// the cell colour is computed per cell by interpolating between the two, so
// it cannot be a single CSS custom property.
const CELL_LIGHT = '#eef4fb';
const CELL_DARK = '#1d4f91';

export function cell<T>(rows: readonly T[], options: CellOptions<T>): Mark {
  const getX = accessor(options.x);
  const getY = accessor(options.y);
  const getFill = accessor(options.fill);

  const valid: { row: T; x: Slot; y: Slot; fill: number }[] = [];
  for (const row of rows) {
    const x = getX(row);
    const y = getY(row);
    const f = toNumber(getFill(row));
    if (!isPlottable(x) || !isPlottable(y) || f === null) continue;
    valid.push({ row, x, y, fill: f });
  }

  const distinct = (key: 'x' | 'y'): Slot[] => {
    const seen: Slot[] = [];
    for (const v of valid) {
      const value = v[key];
      if (!seen.some((s) => sameSlot(s, value))) seen.push(value);
    }
    return seen;
  };
  const xSlots = distinct('x');
  const ySlots = distinct('y');

  const fills = valid.map((v) => v.fill);
  const vmin = Math.min(...fills);
  const vmax = Math.max(...fills);
  const t = (v: number): number => (vmin === vmax ? 1 : (v - vmin) / (vmax - vmin));
  const xValues = (): readonly Primitive[] => [...xSlots];
  const yValues = (): readonly Primitive[] => [...ySlots];

  return {
    name: 'cell',
    xValues,
    yValues,
    colorValues: () => [],
    render(ctx: PlotContext): void {
      const layer = ctx.layer('cell');
      const opacity = options.opacity ?? 1;
      const xBand = ctx.x.bandwidth();
      const yBand = ctx.y.bandwidth();
      const cellW = xBand > 0 ? xBand : continuousStep(ctx.x, xSlots, ctx.innerWidth);
      const cellH = yBand > 0 ? yBand : continuousStep(ctx.y, ySlots, ctx.innerHeight);
      for (const v of valid) {
        // Band axes place each cell at its band start. A continuous axis centres
        // the cell on its value, so cells line up with the axis ticks.
        const x = xBand > 0 ? ctx.x.position(String(v.x)) : ctx.x.position(v.x) - cellW / 2;
        const y = yBand > 0 ? ctx.y.position(String(v.y)) : ctx.y.position(v.y) - cellH / 2;
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('class', 'd3s-cell');
        rect.setAttribute('x', String(x));
        rect.setAttribute('y', String(y));
        rect.setAttribute('width', String(cellW));
        rect.setAttribute('height', String(cellH));
        rect.setAttribute('fill', interpolateColor([CELL_LIGHT, CELL_DARK], t(v.fill)));
        if (opacity !== 1) rect.setAttribute('opacity', String(opacity));
        layer.appendChild(rect);
      }
    },
  };
}

/** Key of a slot, so that `1` and `'1'` share one cell on one axis. */
function keyOf(v: Slot): string {
  return `${typeof v}:${String(v)}`;
}

/**
 * Pixel width of one cell on a continuous axis: the smallest gap between two
 * distinct values, so neighbouring cells touch but do not overlap. With a
 * single value the whole extent is used.
 */
function continuousStep(
  scale: { position(v: Slot): number },
  slots: readonly Slot[],
  extent: number,
): number {
  const positions = slots.map((s) => scale.position(s)).sort((a, b) => a - b);
  let step = Number.POSITIVE_INFINITY;
  for (let i = 1; i < positions.length; i++) {
    const gap = (positions[i] ?? 0) - (positions[i - 1] ?? 0);
    if (gap > 0 && gap < step) step = gap;
  }
  return Number.isFinite(step) ? step : extent;
}

function sameSlot(a: Slot, b: Slot): boolean {
  return keyOf(a) === keyOf(b);
}
