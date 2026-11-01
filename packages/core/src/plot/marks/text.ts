/**
 * Text marks. `text` draws one label per datum at its (x, y) position,
 * typically next to a point.
 */
import type { Accessor } from '../channel.js';
import { valueOf, valuesOf } from '../channel.js';
import type { Mark, Primitive } from '../types.js';
import { cssVar, LIGHT_THEME } from '../../theme/index.js';

export interface TextOptions<T> {
  x: Accessor<T>;
  y: Accessor<T>;
  /** The text of each label: a field name or a function returning a string. */
  text: Accessor<T> | ((datum: T) => string);
  /** Horizontal anchor. Default: `middle`. */
  anchor?: 'start' | 'middle' | 'end';
  /** Vertical offset in pixels. Default: -6, so labels sit above the point. */
  dy?: number;
  fill?: string;
  fontSize?: number;
}

/** One `<text>` per datum, at the (x, y) position plus `dy`. */
export function text<T>(data: readonly T[], options: TextOptions<T>): Mark {
  const { x, y, text: textOf } = options;
  const xs = valuesOf(data, x);
  const ys = valuesOf(data, y);
  const contentOf = (datum: T): string => {
    const v = typeof textOf === 'function' ? textOf(datum) : valueOf(datum, textOf);
    return String(v);
  };
  return {
    name: 'text',
    xValues(): readonly Primitive[] {
      return xs;
    },
    yValues(): readonly Primitive[] {
      return ys;
    },
    render(ctx): void {
      const layer = ctx.layer('text');
      const svgNs = 'http://www.w3.org/2000/svg';
      data.forEach((datum) => {
        const px = ctx.x.position(valueOf(datum, x));
        const py = ctx.y.position(valueOf(datum, y));
        if (!Number.isFinite(px) || !Number.isFinite(py)) return;
        const el = document.createElementNS(svgNs, 'text');
        el.setAttribute('class', 'd3s-text');
        el.setAttribute('x', String(px));
        el.setAttribute('y', String(py));
        el.setAttribute('dy', String(options.dy ?? -6));
        el.setAttribute('text-anchor', options.anchor ?? 'middle');
        el.setAttribute('fill', options.fill ?? cssVar('textMuted', LIGHT_THEME.textMuted));
        el.setAttribute('font-size', String(options.fontSize ?? 12));
        el.textContent = contentOf(datum);
        layer.appendChild(el);
      });
    },
  };
}
