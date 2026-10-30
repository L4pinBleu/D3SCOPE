/**
 * Line and area chart over a time scale, with an optional crosshair tooltip
 * (PLAN.md §9.2 step 6).
 *
 * `layoutLineChart` and the path helpers are pure (no DOM) and unit-tested
 * directly. `renderLineChart` draws the path, the optional area and both axes,
 * and wires the crosshair: the nearest point follows the pointer.
 *
 * Paths are built as plain SVG strings, so no d3-shape dependency is needed.
 */
import { renderAxis } from '../axes/index.js';
import { formatDate, formatNumber, type LocaleName } from '../format/index.js';
import { linearScale, timeScale } from '../scales/index.js';
import {
  acquireTooltip,
  type TooltipContent,
  type TooltipOptions,
} from '../interaction/tooltip.js';
import { pointer, select, type Selection } from 'd3-selection';
import type { ScaleLinear, ScaleTime } from 'd3-scale';
import { cssVar, LIGHT_THEME } from '../theme/index.js';
import type { Margin } from './bar.js';

export interface TimePoint {
  date: Date;
  value: number;
}

export interface LinePointGeometry extends TimePoint {
  x: number;
  y: number;
}

export interface LineTooltipOptions extends TooltipOptions {
  /** Content for the nearest point. Default: the date as title, the value as a line, in the chart locale. */
  format?: (point: TimePoint) => TooltipContent;
}

export interface LineChartOptions {
  width: number;
  height: number;
  /** Space around the plot, for the axes. Default: 40 left, 16 others, 28 bottom. */
  margin?: Partial<Margin>;
  /** Line colour. Default: `#4a9eed`. */
  color?: string;
  /** Fill the area under the line, down to the bottom of the plot. Default: false. */
  area?: boolean;
  /** Approximate number of value ticks. Default: 5. */
  tickCount?: number;
  /**
   * Crosshair and tooltip on hover, off by default. `true` uses an SVG tooltip;
   * an object picks the mode or customizes the content.
   */
  tooltip?: boolean | LineTooltipOptions;
  /** Called when the chart is clicked, with the nearest point. */
  onPointClick?: (point: TimePoint, event: MouseEvent) => void;
  /** Locale for default tooltip text. Default: the library locale (`fr-FR`). */
  locale?: LocaleName;
}

export interface LineLayout {
  /** Points sorted by date, with pixel positions. */
  points: LinePointGeometry[];
  /** SVG path for the line. Empty when there is no data. */
  path: string;
  /** SVG path for the area, closed at the bottom of the plot. Empty when there is no data. */
  areaPath: string;
  innerWidth: number;
  innerHeight: number;
  margin: Margin;
  xScale: ScaleTime<number, number>;
  yScale: ScaleLinear<number, number>;
}

const DEFAULT_MARGIN: Margin = { top: 16, right: 16, bottom: 28, left: 40 };
const DEFAULT_COLOR = LIGHT_THEME.accent;

/** Round to 2 decimals so paths stay short. */
function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** `M x,y L x,y …` through `points`. Empty string for no points. */
export function linePath(points: readonly { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p.x)},${fmt(p.y)}`).join(' ');
}

/** The line closed down to `baseline` (a y pixel value) and back to the start. */
export function areaPath(points: readonly { x: number; y: number }[], baseline: number): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return '';
  return `${linePath(points)} L${fmt(last.x)},${fmt(baseline)} L${fmt(first.x)},${fmt(baseline)} Z`;
}

/**
 * Index of the point whose x is nearest to `x`, for points sorted by x.
 * Returns -1 for an empty list.
 */
export function nearestPointIndex(points: readonly { x: number }[], x: number): number {
  if (points.length === 0) return -1;
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((points[mid]?.x ?? 0) < x) lo = mid + 1;
    else hi = mid;
  }
  const before = points[lo - 1];
  const at = points[lo];
  if (!before || !at) return lo;
  return Math.abs(before.x - x) <= Math.abs(at.x - x) ? lo - 1 : lo;
}

/** Compute line geometry for `data`. Pure: no DOM access. */
export function layoutLineChart(data: readonly TimePoint[], options: LineChartOptions): LineLayout {
  const margin: Margin = { ...DEFAULT_MARGIN, ...options.margin };
  const innerWidth = Math.max(0, options.width - margin.left - margin.right);
  const innerHeight = Math.max(0, options.height - margin.top - margin.bottom);
  const sorted = [...data].sort((a, b) => a.date.getTime() - b.date.getTime());

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const values = sorted.map((d) => d.value);
  // With no data, use a placeholder domain so the scales still exist.
  const xDomain: [Date, Date] =
    first && last ? [first.date, last.date] : [new Date(0), new Date(1)];
  const yDomain: [number, number] =
    values.length > 0 ? [Math.min(...values), Math.max(...values)] : [0, 1];

  const xScale = timeScale(xDomain, [0, innerWidth], { nice: false });
  const yScale = linearScale(yDomain, [innerHeight, 0]);

  const points: LinePointGeometry[] = sorted.map((d) => ({
    date: d.date,
    value: d.value,
    x: xScale(d.date),
    y: yScale(d.value),
  }));

  return {
    points,
    path: linePath(points),
    areaPath: areaPath(points, innerHeight),
    innerWidth,
    innerHeight,
    margin,
    xScale,
    yScale,
  };
}

/** Draw the chart into `svg`. Redrawing updates the path in place. */
export function renderLineChart(
  svg: SVGSVGElement,
  data: readonly TimePoint[],
  options: LineChartOptions,
): LineLayout {
  const layout = layoutLineChart(data, options);
  const color = options.color ?? DEFAULT_COLOR;
  const root = select(svg);
  root.attr('width', options.width).attr('height', options.height);

  const plot = root
    .selectAll<SVGGElement, null>('g.line-chart')
    .data([null])
    .join('g')
    .attr('class', 'line-chart')
    .attr('transform', `translate(${String(layout.margin.left)},${String(layout.margin.top)})`);

  // Area first, so the line is drawn on top of it.
  const area = plot.selectAll<SVGPathElement, null>('path.area').data(options.area ? [null] : []);
  area.exit().remove();
  area
    .enter()
    .append('path')
    .attr('class', 'area')
    .merge(area)
    .attr('d', layout.areaPath)
    .attr('fill', color)
    .attr('fill-opacity', 0.2);

  plot
    .selectAll<SVGPathElement, null>('path.line')
    .data([null])
    .join('path')
    .attr('class', 'line')
    .attr('d', layout.path)
    .attr('fill', 'none')
    .attr('stroke', color)
    .attr('stroke-width', 2);

  const xAxis = plot
    .selectAll<SVGGElement, null>('g.x-axis')
    .data([null])
    .join('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${String(layout.innerHeight)})`)
    .node();
  const yAxis = plot
    .selectAll<SVGGElement, null>('g.y-axis')
    .data([null])
    .join('g')
    .attr('class', 'y-axis')
    .node();
  if (xAxis)
    renderAxis(xAxis, layout.xScale, { orientation: 'bottom', tickSize: 0, tickPadding: 6 });
  if (yAxis) {
    renderAxis(yAxis, layout.yScale, { orientation: 'left', tickCount: options.tickCount ?? 5 });
  }

  bindLineInteractions(svg, plot, layout, options);
  return layout;
}

function bindLineInteractions(
  svg: SVGSVGElement,
  plot: Selection<SVGGElement, null, SVGSVGElement, unknown>,
  layout: LineLayout,
  options: LineChartOptions,
): void {
  const tip = acquireTooltip(svg, options.tooltip);
  const tooltipOpts = options.tooltip;
  const format =
    typeof tooltipOpts === 'object' && tooltipOpts.format
      ? tooltipOpts.format
      : (p: TimePoint) => defaultTooltipContent(p, options.locale);

  // Crosshair: a vertical rule and a dot on the nearest point. Hidden until hover.
  const crosshair = plot
    .selectAll<SVGGElement, null>('g.crosshair')
    .data([null])
    .join('g')
    .attr('class', 'crosshair')
    .attr('pointer-events', 'none')
    .style('display', 'none');
  crosshair
    .selectAll<SVGLineElement, null>('line')
    .data([null])
    .join('line')
    .attr('y1', 0)
    .attr('y2', layout.innerHeight)
    .style('stroke', cssVar('textMuted', LIGHT_THEME.textMuted))
    .attr('stroke-dasharray', '4 3');
  crosshair
    .selectAll<SVGCircleElement, null>('circle')
    .data([null])
    .join('circle')
    .attr('r', 4)
    .style('fill', cssVar('surface', LIGHT_THEME.surface))
    .style('stroke', cssVar('text', LIGHT_THEME.text))
    .attr('stroke-width', 2);

  // Transparent overlay: catches the pointer over the whole plot area.
  const overlay = plot
    .selectAll<SVGRectElement, null>('rect.overlay')
    .data([null])
    .join('rect')
    .attr('class', 'overlay')
    .attr('width', layout.innerWidth)
    .attr('height', layout.innerHeight)
    .attr('fill', 'transparent');

  const plotNode = plot.node();
  const nearest = (event: MouseEvent): LinePointGeometry | undefined => {
    if (!plotNode) return undefined;
    const [px] = pointer(event, plotNode);
    const idx = nearestPointIndex(layout.points, px);
    return layout.points[idx];
  };

  overlay
    .on('mousemove', (event: MouseEvent) => {
      const p = nearest(event);
      if (!p) return;
      crosshair.style('display', null).attr('transform', `translate(${fmt(p.x)},0)`);
      crosshair.select('circle').attr('cy', p.y);
      tip?.show(format(p), { x: p.x + layout.margin.left, y: p.y + layout.margin.top });
    })
    .on('mouseleave', () => {
      crosshair.style('display', 'none');
      tip?.hide();
    })
    .on('click', (event: MouseEvent) => {
      const p = nearest(event);
      if (p) options.onPointClick?.({ date: p.date, value: p.value }, event);
    });
}

function defaultTooltipContent(point: TimePoint, locale?: LocaleName): TooltipContent {
  return {
    title: formatDate(point.date, { locale }),
    lines: [formatNumber(point.value, { locale })],
  };
}
