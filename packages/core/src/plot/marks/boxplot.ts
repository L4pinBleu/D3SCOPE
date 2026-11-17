/**
 * Box plot mark. Rows are grouped by category on x (a band axis); for each
 * category the finite y values are summarised into a box (Q1 to Q3, type-7
 * quartiles, the R/d3 default), a median line, whiskers reaching to the
 * farthest value still inside 1.5·IQR of the box, and one circle per outlier
 * beyond the whiskers. Rows with a missing x are dropped everywhere; a
 * category with no finite value draws nothing and stays out of the domain.
 */
import { cssVar, LIGHT_THEME } from '../../theme/index.js';
import type { Mark, PlotContext, Primitive } from '../types.js';
import { accessor, isPlottable, toNumber, type Accessor } from './shared.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface BoxPlotOptions<T> {
  /** Category for the x band axis: a field name or a function. */
  x: Accessor<T, string>;
  /** Numeric value accessor: a field name or a function. */
  y: Accessor<T, number | null | undefined>;
  /** Literal fill colour of the box. Default: the theme accent. */
  fill?: string;
  /** Opacity of the box. Default: 1. */
  opacity?: number;
  /** Box width as a fraction of the band. Default: 0.6, clamped to 0.1..1. */
  width?: number;
}

/** The five numbers (plus outliers) that summarise one category. */
interface BoxStats {
  category: string;
  q1: number;
  median: number;
  q3: number;
  lower: number;
  upper: number;
  outliers: number[];
}

/** Quantile with linear interpolation (type 7, the R/d3 default) of a sorted list. */
function quantile(sorted: readonly number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return Number.NaN;
  const pos = (n - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo];
  const b = sorted[hi];
  if (a === undefined || b === undefined || lo === hi) return a ?? Number.NaN;
  return a + (b - a) * (pos - lo);
}

/** Compute the box statistics of one category from its finite values. */
function statsOf(category: string, values: number[]): BoxStats {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const median = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const loFence = q1 - 1.5 * iqr;
  const hiFence = q3 + 1.5 * iqr;
  let lower = Number.NaN;
  let upper = Number.NaN;
  const outliers: number[] = [];
  for (const v of sorted) {
    if (v < loFence || v > hiFence) {
      outliers.push(v);
    } else {
      if (Number.isNaN(lower)) lower = v;
      upper = v;
    }
  }
  return { category, q1, median, q3, lower, upper, outliers };
}

export function boxPlot<T>(rows: readonly T[], options: BoxPlotOptions<T>): Mark {
  const getX = accessor(options.x);
  const getY = accessor(options.y);
  const fill = options.fill ?? cssVar('accent', LIGHT_THEME.accent);
  const opacity = options.opacity ?? 1;
  const widthFraction = Math.min(1, Math.max(0.1, options.width ?? 0.6));

  // Group the finite values per category, keeping first-appearance order.
  // A row whose x is missing is dropped everywhere.
  const groups = new Map<string, number[]>();
  const order: string[] = [];
  for (const row of rows) {
    const x = getX(row);
    if (!isPlottable(x)) continue;
    const v = toNumber(getY(row));
    let list = groups.get(x);
    if (list === undefined) {
      list = [];
      groups.set(x, list);
      order.push(x);
    }
    if (v !== null) list.push(v);
  }

  const boxes: BoxStats[] = [];
  for (const category of order) {
    const values = groups.get(category) ?? [];
    if (values.length === 0) continue;
    boxes.push(statsOf(category, values));
  }

  const categories = (): Primitive[] => boxes.map((b) => b.category);
  const yValues = (): number[] => {
    const out: number[] = [];
    for (const b of boxes) {
      if (!Number.isNaN(b.lower)) out.push(b.lower);
      if (!Number.isNaN(b.upper)) out.push(b.upper);
      out.push(...b.outliers);
    }
    return out;
  };

  return {
    name: 'boxPlot',
    xValues: categories,
    yValues,
    render(ctx: PlotContext): void {
      const layer = ctx.layer('boxplot');
      for (const b of boxes) {
        const cx = ctx.x.position(b.category) + ctx.x.bandwidth() / 2;
        const width = ctx.x.bandwidth() * widthFraction;
        const pQ1 = ctx.y.position(b.q1);
        const pQ3 = ctx.y.position(b.q3);
        const boxTop = Math.min(pQ1, pQ3);
        const boxBottom = Math.max(pQ1, pQ3);

        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', String(cx - width / 2));
        rect.setAttribute('y', String(boxTop));
        rect.setAttribute('width', String(width));
        rect.setAttribute('height', String(boxBottom - boxTop));
        rect.setAttribute('fill', fill);
        rect.setAttribute('opacity', String(opacity));
        rect.setAttribute('class', 'd3s-box');
        layer.appendChild(rect);

        const median = document.createElementNS(SVG_NS, 'line');
        median.setAttribute('x1', String(cx - width / 2));
        median.setAttribute('x2', String(cx + width / 2));
        median.setAttribute('y1', String(ctx.y.position(b.median)));
        median.setAttribute('y2', String(ctx.y.position(b.median)));
        median.setAttribute('class', 'd3s-median');
        layer.appendChild(median);

        if (!Number.isNaN(b.lower) && b.lower !== b.q1) {
          const lower = document.createElementNS(SVG_NS, 'line');
          lower.setAttribute('x1', String(cx));
          lower.setAttribute('x2', String(cx));
          lower.setAttribute('y1', String(boxBottom));
          lower.setAttribute('y2', String(ctx.y.position(b.lower)));
          lower.setAttribute('class', 'd3s-whisker');
          layer.appendChild(lower);
        }
        if (!Number.isNaN(b.upper) && b.upper !== b.q3) {
          const upper = document.createElementNS(SVG_NS, 'line');
          upper.setAttribute('x1', String(cx));
          upper.setAttribute('x2', String(cx));
          upper.setAttribute('y1', String(boxTop));
          upper.setAttribute('y2', String(ctx.y.position(b.upper)));
          upper.setAttribute('class', 'd3s-whisker');
          layer.appendChild(upper);
        }

        for (const v of b.outliers) {
          const circle = document.createElementNS(SVG_NS, 'circle');
          circle.setAttribute('cx', String(cx));
          circle.setAttribute('cy', String(ctx.y.position(v)));
          circle.setAttribute('r', '3');
          circle.setAttribute('class', 'd3s-outlier');
          layer.appendChild(circle);
        }
      }
    },
  };
}
