/**
 * Basic bar chart (`.task` core: "Chart basic template (barres)").
 *
 * `layoutBarChart` maps data to bar geometry with pure functions (no DOM), so it
 * is unit-tested directly. `renderBarChart` draws the bars and both axes into an
 * SVG element. Negative values grow below the zero line.
 */
import { renderAxis } from '../axes/index.js';
import { bandScale, linearScale } from '../scales/index.js';
import { pointer, select, type Selection } from 'd3-selection';
import type { ScaleBand, ScaleLinear } from 'd3-scale';
import {
  acquireTooltip,
  type TooltipContent,
  type TooltipOptions,
} from '../interaction/tooltip.js';

export interface BarDatum {
  /** Category name. Must be unique within a chart. */
  label: string;
  value: number;
  /** Optional bar colour. Falls back to `BarChartOptions.color`. */
  color?: string;
}

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface BarChartOptions {
  width: number;
  height: number;
  /** Space around the plot, for the axes. Default: 40 left, 16 others, 28 bottom. */
  margin?: Partial<Margin>;
  /** Space between bars, from 0 to 1. Default: 0.2. */
  padding?: number;
  /** Default bar colour. Default: `#4a9eed`. */
  color?: string;
  /** Approximate number of value ticks. Default: 5. */
  tickCount?: number;
  /**
   * Show a tooltip on hover. Off by default. `true` uses an SVG tooltip with the
   * label and value; an object customizes mode, container and content.
   */
  tooltip?: boolean | BarTooltipOptions;
  /** Called when a bar is clicked. */
  onBarClick?: (datum: BarDatum, event: MouseEvent) => void;
}

export interface BarTooltipOptions extends TooltipOptions {
  /** Content for a hovered bar. Default: the label as title and the value as a line. */
  format?: (datum: BarDatum) => TooltipContent;
}

export interface BarGeometry {
  label: string;
  value: number;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BarLayout {
  bars: BarGeometry[];
  /** Size of the plot area, inside the margins. */
  innerWidth: number;
  innerHeight: number;
  margin: Margin;
  /** Pixel position of the zero line inside the plot area. */
  zeroY: number;
  /** Scales used for the bars and axes. */
  xScale: ScaleBand<string>;
  yScale: ScaleLinear<number, number>;
}

const DEFAULT_MARGIN: Margin = { top: 16, right: 16, bottom: 28, left: 40 };
const DEFAULT_COLOR = '#4a9eed';

/** Compute bar geometry for `data`. Pure: no DOM access. */
export function layoutBarChart(data: readonly BarDatum[], options: BarChartOptions): BarLayout {
  const margin: Margin = { ...DEFAULT_MARGIN, ...options.margin };
  const innerWidth = Math.max(0, options.width - margin.left - margin.right);
  const innerHeight = Math.max(0, options.height - margin.top - margin.bottom);
  const color = options.color ?? DEFAULT_COLOR;

  const labels = data.map((d) => d.label);
  if (new Set(labels).size !== labels.length) {
    throw new RangeError('layoutBarChart: category labels must be unique');
  }

  const x = bandScale(labels, [0, innerWidth], { padding: options.padding ?? 0.2 });
  const values = data.map((d) => d.value);
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const y = linearScale([lo, hi], [innerHeight, 0]);
  const zeroY = y(0);

  const bars = data.map((d): BarGeometry => {
    const top = y(Math.max(d.value, 0));
    const bottom = y(Math.min(d.value, 0));
    return {
      label: d.label,
      value: d.value,
      color: d.color ?? color,
      x: x(d.label) ?? 0,
      y: top,
      width: x.bandwidth(),
      height: bottom - top,
    };
  });

  return { bars, innerWidth, innerHeight, margin, zeroY, xScale: x, yScale: y };
}

/**
 * Draw the chart into `svg`. Redrawing updates the bars in place (keyed by
 * label) and redraws both axes, so it is safe on every data update.
 */
export function renderBarChart(
  svg: SVGSVGElement,
  data: readonly BarDatum[],
  options: BarChartOptions,
): BarLayout {
  const layout = layoutBarChart(data, options);
  const root = select(svg);
  root.attr('width', options.width).attr('height', options.height);

  const plot = root
    .selectAll<SVGGElement, null>('g.bar-chart')
    .data([null])
    .join('g')
    .attr('class', 'bar-chart')
    .attr('transform', `translate(${String(layout.margin.left)},${String(layout.margin.top)})`);

  plot
    .selectAll<SVGRectElement, BarGeometry>('rect.bar')
    .data(layout.bars, (d) => d.label)
    .join('rect')
    .attr('class', 'bar')
    .attr('x', (d) => d.x)
    .attr('y', (d) => d.y)
    .attr('width', (d) => d.width)
    .attr('height', (d) => Math.abs(d.height))
    .attr('fill', (d) => d.color);

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

  if (xAxis) {
    renderAxis(xAxis, layout.xScale, { orientation: 'bottom', tickSize: 0, tickPadding: 6 });
  }
  if (yAxis) {
    renderAxis(yAxis, layout.yScale, { orientation: 'left', tickCount: options.tickCount ?? 5 });
  }

  bindBarInteractions(svg, plot.selectAll<SVGRectElement, BarGeometry>('rect.bar'), options);
  return layout;
}

function bindBarInteractions(
  svg: SVGSVGElement,
  bars: Selection<SVGRectElement, BarGeometry, SVGGElement, null>,
  options: BarChartOptions,
): void {
  const tip = acquireTooltip(svg, options.tooltip);
  const tooltipOpts = options.tooltip;
  const format =
    typeof tooltipOpts === 'object' && tooltipOpts.format
      ? tooltipOpts.format
      : defaultTooltipContent;
  const datumOf = (d: BarGeometry): BarDatum => ({
    label: d.label,
    value: d.value,
    color: d.color,
  });
  const showAt = (event: MouseEvent, d: BarGeometry): void => {
    const [x, y] = pointer(event, svg);
    tip?.show(format(datumOf(d)), { x, y });
  };

  bars
    .on('mouseenter', showAt)
    .on('mousemove', showAt)
    .on('mouseleave', () => {
      tip?.hide();
    })
    .on('click', (event: MouseEvent, d: BarGeometry) => {
      options.onBarClick?.(datumOf(d), event);
    });
}

function defaultTooltipContent(datum: BarDatum): TooltipContent {
  return { title: datum.label, lines: [String(datum.value)] };
}
