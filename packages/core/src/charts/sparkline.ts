/**
 * Sparkline: a small line with no axes, labels or tooltip (PLAN.md §9.2 step 6).
 * Used inline in tables and cards (for example, the Portfolio asset list).
 *
 * Points are spaced evenly along x (index order, not dates). `layoutSparkline`
 * is pure and unit-tested; `renderSparkline` draws the path, an optional area
 * and a dot on the last value.
 */
import { linearScale } from '../scales/index.js';
import { select } from 'd3-selection';
import { areaPath, linePath } from './line.js';

export interface SparklineOptions {
  width: number;
  height: number;
  /** Space between the drawing and the svg edge, in px. Default: 2. */
  padding?: number;
  /** Line colour. Default: `currentColor`, so it follows the text colour. */
  color?: string;
  /** Line width in px. Default: 1.5. */
  strokeWidth?: number;
  /** Fill the area under the line. Default: false. */
  area?: boolean;
  /** Draw a dot on the last value. Default: true. */
  showLastPoint?: boolean;
}

export interface SparklinePoint {
  x: number;
  y: number;
  value: number;
}

export interface SparklineLayout {
  points: SparklinePoint[];
  path: string;
  areaPath: string;
  /** Point for the last value, or `undefined` when there are no values. */
  last: SparklinePoint | undefined;
}

/** Compute the sparkline geometry for `values`. Pure: no DOM access. */
export function layoutSparkline(
  values: readonly number[],
  options: SparklineOptions,
): SparklineLayout {
  const pad = options.padding ?? 2;
  const innerWidth = Math.max(0, options.width - pad * 2);
  const innerHeight = Math.max(0, options.height - pad * 2);
  if (values.length === 0) {
    return { points: [], path: '', areaPath: '', last: undefined };
  }

  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const y = linearScale([lo, hi], [pad + innerHeight, pad], { nice: false });
  const step = values.length > 1 ? innerWidth / (values.length - 1) : 0;
  const x = (i: number): number => (values.length > 1 ? pad + i * step : pad + innerWidth / 2);

  const points: SparklinePoint[] = values.map((value, i) => ({ x: x(i), y: y(value), value }));
  const bottom = pad + innerHeight;
  return {
    points,
    path: linePath(points),
    areaPath: areaPath(points, bottom),
    last: points[points.length - 1],
  };
}

/** Draw the sparkline into `svg`. Redrawing updates the drawing in place. */
export function renderSparkline(
  svg: SVGSVGElement,
  values: readonly number[],
  options: SparklineOptions,
): SparklineLayout {
  const layout = layoutSparkline(values, options);
  const color = options.color ?? 'currentColor';
  const root = select(svg);
  root.attr('width', options.width).attr('height', options.height);

  const plot = root
    .selectAll<SVGGElement, null>('g.sparkline')
    .data([null])
    .join('g')
    .attr('class', 'sparkline');

  plot
    .selectAll<SVGPathElement, null>('path.area')
    .data(options.area ? [null] : [])
    .join('path')
    .attr('class', 'area')
    .attr('d', layout.areaPath)
    .attr('fill', color)
    .attr('fill-opacity', 0.15);
  if (!options.area) plot.selectAll('path.area').remove();

  plot
    .selectAll<SVGPathElement, null>('path.line')
    .data([null])
    .join('path')
    .attr('class', 'line')
    .attr('d', layout.path)
    .attr('fill', 'none')
    .attr('stroke', color)
    .attr('stroke-width', options.strokeWidth ?? 1.5)
    .attr('stroke-linejoin', 'round');

  const dots = (options.showLastPoint ?? true) && layout.last ? [layout.last] : [];
  plot
    .selectAll<SVGCircleElement, SparklinePoint>('circle.last')
    .data(dots)
    .join('circle')
    .attr('class', 'last')
    .attr('cx', (d) => d.x)
    .attr('cy', (d) => d.y)
    .attr('r', 2)
    .attr('fill', color);

  return layout;
}
