/**
 * Range marks. `rangeY` draws horizontal bands spanning the whole plot width
 * between two y values, `rangeX` the vertical equivalent. They are used to
 * draw specification limits and tolerance zones behind the data marks.
 *
 * A row carries the two bounds of the band (`from` and `to`; the order does
 * not matter) and optionally a label drawn inside the band at its left edge
 * (top edge for `rangeX`). A row whose bounds are missing or non-finite is
 * skipped and does not take part in the domain.
 */
import { cssVar, LIGHT_THEME } from '../../theme/index.js';
import type { Mark, PlotContext, Primitive } from '../types.js';
import { accessor, isPlottable, toNumber, type Accessor } from './shared.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A bound on the x axis: a number, a date, or a band category. */
type XBound = number | Date | string;

export interface RangeOptions<T> {
  /**
   * One bound of the band (order does not matter): a field name or a
   * function. A number for the y axis; a number, Date, or band category
   * for the x axis.
   */
  from: Accessor<T, number | null | undefined> | Accessor<T, XBound | null | undefined>;
  /** The other bound of the band, on the same axis. */
  to: Accessor<T, number | null | undefined> | Accessor<T, XBound | null | undefined>;
  /** Text drawn inside the band at its edge: a field name or a function. */
  label?: Accessor<T, string>;
  /** Fill colour of the band. Default: the theme accent. */
  fill?: string;
  /** Opacity of the band, from 0 to 1. Default: 0.15. */
  opacity?: number;
}

/** One resolved band row: the bounds (row order) and its label, if any. */
interface Band {
  a: Primitive;
  b: Primitive;
  label: string;
}

function rangeMark<T>(rows: readonly T[], options: RangeOptions<T>, orientation: 'x' | 'y'): Mark {
  const name = orientation === 'y' ? 'rangeY' : 'rangeX';
  const getFrom = accessor(options.from);
  const getTo = accessor(options.to);
  const getLabel = options.label === undefined ? undefined : accessor(options.label);
  const fill = options.fill ?? cssVar('accent', LIGHT_THEME.accent);
  const opacity = options.opacity ?? 0.15;

  /**
   * The bound of a row on the band axis: a finite number for y, and a finite
   * number, a valid date, or a non-empty category for x. `null` when missing.
   */
  const boundOf = (value: unknown): number | Date | string | null => {
    if (orientation === 'y') return toNumber(value);
    return isPlottable(value) ? value : null;
  };

  /** The rows with both bounds plottable and of the same kind; they alone reach the domain. */
  const bands = (): Band[] => {
    const out: Band[] = [];
    for (const row of rows) {
      const a = boundOf(getFrom(row));
      const b = boundOf(getTo(row));
      if (a === null || b === null) continue;
      // A numeric bound and a category cannot be paired: on a continuous axis
      // the string has no position, on a band axis the number has none.
      if ((typeof a === 'string') !== (typeof b === 'string')) continue;
      const text = getLabel?.(row);
      out.push({ a, b, label: typeof text === 'string' && text !== '' ? text : '' });
    }
    return out;
  };

  const values = (): Primitive[] => {
    const out: Primitive[] = [];
    for (const band of bands()) {
      out.push(band.a, band.b);
    }
    return out;
  };

  return {
    name,
    xValues: () => (orientation === 'x' ? values() : []),
    yValues: () => (orientation === 'y' ? values() : []),
    render(ctx: PlotContext): void {
      const layer = ctx.layer('range');
      const scale = orientation === 'y' ? ctx.y : ctx.x;
      const crossLength = orientation === 'y' ? ctx.innerWidth : ctx.innerHeight;
      for (const band of bands()) {
        let p0 = scale.position(band.a);
        let p1 = scale.position(band.b);
        if (!Number.isFinite(p0) || !Number.isFinite(p1)) continue;
        // On a band axis a category spans its whole band, so the outer bound
        // extends to the end of its band. A zero-size band stays zero.
        const bandWidth = scale.bandwidth();
        if (bandWidth > 0 && p0 !== p1) {
          if (p1 > p0) p1 += bandWidth;
          else p0 += bandWidth;
        }
        const start = Math.min(p0, p1);
        const length = Math.abs(p1 - p0);
        const group = document.createElementNS(SVG_NS, 'g');
        const rect = document.createElementNS(SVG_NS, 'rect');
        if (orientation === 'y') {
          rect.setAttribute('x', '0');
          rect.setAttribute('y', String(start));
          rect.setAttribute('width', String(crossLength));
          rect.setAttribute('height', String(length));
        } else {
          rect.setAttribute('x', String(start));
          rect.setAttribute('y', '0');
          rect.setAttribute('width', String(length));
          rect.setAttribute('height', String(crossLength));
        }
        rect.setAttribute('fill', fill);
        rect.setAttribute('opacity', String(opacity));
        rect.setAttribute('class', 'd3s-range');
        group.appendChild(rect);
        if (band.label !== '') {
          const text = document.createElementNS(SVG_NS, 'text');
          text.setAttribute('class', 'd3s-range-label');
          if (orientation === 'y') {
            text.setAttribute('x', '0');
            text.setAttribute('y', String(start + length / 2));
          } else {
            text.setAttribute('x', String(start));
            text.setAttribute('y', String(length / 2));
          }
          // Text content only: the label is never parsed as HTML.
          text.textContent = band.label;
          group.appendChild(text);
        }
        layer.appendChild(group);
      }
    },
  };
}

/** Horizontal bands between two y values, spanning the whole plot width. */
export function rangeY<T>(rows: readonly T[], options: RangeOptions<T>): Mark {
  return rangeMark(rows, options, 'y');
}

/** Vertical bands between two x values, spanning the whole plot height. */
export function rangeX<T>(rows: readonly T[], options: RangeOptions<T>): Mark {
  return rangeMark(rows, options, 'x');
}
