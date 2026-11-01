/**
 * `histogram(values, options)`: a histogram mark. The values are binned with
 * the pure `bin()` transform (ADR 0002, step 7) and each bin becomes one
 * rectangle from `x0` to `x1` (linear, numeric x) and from 0 to its count (y).
 * Empty input draws nothing; a bin with count 0 is drawn with height 0, so it
 * keeps its slot on the axis but shows no bar.
 */
import { bin } from '../transforms.js';
import { cssVar, LIGHT_THEME } from '../../theme/index.js';
import type { Mark, PlotContext } from '../types.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface HistogramOptions {
  /** Approximate number of bins. Default: Sturges, as in `bin()`. */
  count?: number;
  /** Literal fill colour of the bars. Default: the theme accent. */
  fill?: string;
  /** Opacity of the bars, from 0 to 1. Default: 1. */
  opacity?: number;
}

export function histogram(values: readonly number[], options: HistogramOptions = {}): Mark {
  const bins = bin(values, options.count === undefined ? {} : { count: options.count });
  return {
    name: 'histogram',
    xValues: () => bins.flatMap((b) => [b.x0, b.x1]),
    yValues: () => [...bins.map((b) => b.values.length), 0],
    colorValues: () => [],
    render(ctx: PlotContext): void {
      const layer = ctx.layer('histogram');
      const fill = options.fill ?? cssVar('accent', LIGHT_THEME.accent);
      const opacity = options.opacity ?? 1;
      for (const b of bins) {
        const x0 = ctx.x.position(b.x0);
        const x1 = ctx.x.position(b.x1);
        const p0 = ctx.y.position(0);
        const p1 = ctx.y.position(b.values.length);
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('class', 'd3s-bin');
        rect.setAttribute('x', String(Math.min(x0, x1)));
        rect.setAttribute('y', String(Math.min(p0, p1)));
        rect.setAttribute('width', String(Math.abs(x1 - x0)));
        rect.setAttribute('height', String(Math.abs(p1 - p0)));
        rect.setAttribute('fill', fill);
        rect.setAttribute('opacity', String(opacity));
        layer.appendChild(rect);
      }
    },
  };
}
