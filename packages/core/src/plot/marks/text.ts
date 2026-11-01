/**
 * Text mark: one label per row of data, positioned on the x and y scales.
 * The content is always set as text content, never as HTML.
 */
import type { Mark, PlotContext, Primitive } from '../types.js';
import { cssVar, LIGHT_THEME } from '../../theme/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface TextOptions<T> {
  /** The x value: a field name or an accessor. A number, a date or a category. */
  x: (keyof T & (string | number | symbol)) | ((row: T) => Primitive);
  /** The y value: a field name or an accessor. A number. */
  y: (keyof T & (string | number | symbol)) | ((row: T) => number);
  /** The label: a field name or an accessor. A string or a number. */
  text: (keyof T & (string | number | symbol)) | ((row: T) => string | number);
  /** Horizontal offset from the anchored position, in pixels. Default: 0. */
  dx?: number;
  /** Vertical offset from the anchored position, in pixels. Default: 0. */
  dy?: number;
  /** Where the text sits relative to x. Default: `middle`. */
  anchor?: 'start' | 'middle' | 'end';
  /** Text colour. Default: the theme's muted text colour. */
  fill?: string;
  /** Font size, in pixels. Default: 12. */
  fontSize?: number;
}

type Getter<T, V> = (row: T) => V;

function getter<T, V>(field: keyof T | ((row: T) => V)): Getter<T, V> {
  if (typeof field === 'function') return field;
  return (row: T) => row[field] as V;
}

/** Valid x value: a finite number, a date, or a non-empty category. */
function validX(v: Primitive): boolean {
  if (v instanceof Date) return !Number.isNaN(v.getTime());
  if (typeof v === 'number') return Number.isFinite(v);
  return typeof v === 'string' && v !== '';
}

export function text<T>(rows: readonly T[], options: TextOptions<T>): Mark {
  const getX = getter<T, Primitive>(options.x);
  const getY = getter<T, number>(options.y);
  // A field name can miss the property, so the label can be undefined at runtime.
  const getLabel = getter<T, string | number | undefined>(options.text);
  return {
    name: 'text',
    xValues: () => rows.map(getX).filter((v) => validX(v)),
    yValues: () => rows.map(getY).filter((v) => Number.isFinite(v)),
    render(ctx: PlotContext): void {
      const layer = ctx.layer('text');
      for (const row of rows) {
        const xv = getX(row);
        const yv = getY(row);
        const label = getLabel(row);
        if (label === undefined) continue; // missing label field: skip the row
        const labelStr = String(label);
        if (!validX(xv) || !Number.isFinite(yv) || labelStr === '') continue;
        const px =
          ctx.x.bandwidth() > 0 ? ctx.x.position(xv) + ctx.x.bandwidth() / 2 : ctx.x.position(xv);
        if (!Number.isFinite(px) || !Number.isFinite(ctx.y.position(yv))) continue;
        const el = document.createElementNS(SVG_NS, 'text');
        el.setAttribute('class', 'd3s-text');
        el.setAttribute('x', String(px + (options.dx ?? 0)));
        el.setAttribute('y', String(ctx.y.position(yv) + (options.dy ?? 0)));
        el.setAttribute('text-anchor', options.anchor ?? 'middle');
        el.setAttribute('fill', options.fill ?? cssVar('textMuted', LIGHT_THEME.textMuted));
        el.setAttribute('font-size', String(options.fontSize ?? 12));
        el.textContent = labelStr;
        layer.appendChild(el);
      }
    },
  };
}
