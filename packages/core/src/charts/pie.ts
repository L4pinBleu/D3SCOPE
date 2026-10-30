/**
 * Pie and donut chart (PLAN.md §9.2 step 6). Slices are arcs drawn as SVG paths.
 *
 * `layoutPie` and `arcPath` are pure and unit-tested directly. `renderPieChart`
 * draws the slices, reuses the chart tooltip, and reports clicks. Setting
 * `innerRadius` above 0 makes a donut.
 *
 * Angles start at 12 o'clock and run clockwise, as in d3-shape's `pie`.
 */
import { formatNumber, formatPercent, type LocaleName } from '../format/index.js';
import { pointer, select, type Selection } from 'd3-selection';
import { LIGHT_THEME } from '../theme/index.js';
import {
  acquireTooltip,
  type TooltipContent,
  type TooltipOptions,
} from '../interaction/tooltip.js';

export interface PieDatum {
  label: string;
  /** Must be zero or positive. Zero slices are kept in the data but draw nothing. */
  value: number;
  /** Slice colour. Falls back to `PIE_PALETTE` by index. */
  color?: string;
}

export interface PieSlice {
  label: string;
  value: number;
  /** Share of the total, from 0 to 1. */
  share: number;
  color: string;
  startAngle: number;
  endAngle: number;
}

export interface PieTooltipOptions extends TooltipOptions {
  /** Content for a hovered slice. Default: label as title, value and share as lines. */
  format?: (slice: PieSlice) => TooltipContent;
}

export interface PieChartOptions {
  width: number;
  height: number;
  /** Outer radius in px. Default: half the smaller side, minus 4 px. */
  outerRadius?: number;
  /** Inner radius in px. 0 draws a pie, above 0 a donut. Default: 0. */
  innerRadius?: number;
  /** Gap between slices in radians. Default: 0. */
  padAngle?: number;
  /** Hover tooltip, off by default. */
  tooltip?: boolean | PieTooltipOptions;
  /** Called when a slice is clicked. */
  onSliceClick?: (slice: PieSlice, event: MouseEvent) => void;
  /** Locale for default tooltip text. Default: the library locale (`fr-FR`). */
  locale?: LocaleName;
}

export interface PieLayout {
  slices: PieSlice[];
  outerRadius: number;
  innerRadius: number;
  /** Centre of the chart, in SVG user space. */
  cx: number;
  cy: number;
}

/** Default slice palette, in order. */
export const PIE_PALETTE: readonly string[] = LIGHT_THEME.palette;

const TAU = Math.PI * 2;

/** Compute slice angles and shares. Pure: no DOM access. */
export function layoutPie(data: readonly PieDatum[]): PieSlice[] {
  for (const d of data) {
    if (!(d.value >= 0) || !Number.isFinite(d.value)) {
      throw new RangeError(`layoutPie: value for "${d.label}" must be a finite number >= 0`);
    }
  }
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let angle = 0;
  return data.map((d, i): PieSlice => {
    const share = total > 0 ? d.value / total : 0;
    const start = angle;
    angle += share * TAU;
    return {
      label: d.label,
      value: d.value,
      share,
      color: d.color ?? PIE_PALETTE[i % PIE_PALETTE.length] ?? LIGHT_THEME.accent,
      startAngle: start,
      endAngle: angle,
    };
  });
}

/**
 * SVG path for one annular sector, centred on the origin. Angles are measured
 * from 12 o'clock, clockwise. A full circle is split in two so the arc is drawn.
 */
export function arcPath(
  startAngle: number,
  endAngle: number,
  innerRadius: number,
  outerRadius: number,
): string {
  const span = endAngle - startAngle;
  if (span <= 0) return '';
  if (span >= TAU - 1e-9) {
    const half = arcPath(startAngle, startAngle + Math.PI, innerRadius, outerRadius);
    const other = arcPath(startAngle + Math.PI, startAngle + TAU, innerRadius, outerRadius);
    return `${half} ${other}`;
  }
  const point = (r: number, a: number): string =>
    `${fmt(r * Math.sin(a))},${fmt(-r * Math.cos(a))}`;
  const large = span > Math.PI ? 1 : 0;
  const outerStart = point(outerRadius, startAngle);
  const outerEnd = point(outerRadius, endAngle);
  const innerEnd = point(innerRadius, endAngle);
  const innerStart = point(innerRadius, startAngle);
  if (innerRadius <= 0) {
    return `M0,0 L${outerStart} A${fmt(outerRadius)},${fmt(outerRadius)} 0 ${String(large)} 1 ${outerEnd} Z`;
  }
  return [
    `M${outerStart}`,
    `A${fmt(outerRadius)},${fmt(outerRadius)} 0 ${String(large)} 1 ${outerEnd}`,
    `L${innerEnd}`,
    `A${fmt(innerRadius)},${fmt(innerRadius)} 0 ${String(large)} 0 ${innerStart}`,
    'Z',
  ].join(' ');
}

/** Round to 2 decimals so paths stay short. */
function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Geometry for `data`: slices plus the centre and radii for `options`. Pure. */
export function layoutPieChart(data: readonly PieDatum[], options: PieChartOptions): PieLayout {
  const outerRadius =
    options.outerRadius ?? Math.max(0, Math.min(options.width, options.height) / 2 - 4);
  const innerRadius = Math.min(Math.max(0, options.innerRadius ?? 0), outerRadius);
  return {
    slices: layoutPie(data),
    outerRadius,
    innerRadius,
    cx: options.width / 2,
    cy: options.height / 2,
  };
}

/** Draw the chart into `svg`. Redrawing updates the slices in place. */
export function renderPieChart(
  svg: SVGSVGElement,
  data: readonly PieDatum[],
  options: PieChartOptions,
): PieLayout {
  const layout = layoutPieChart(data, options);
  const root = select(svg);
  root.attr('width', options.width).attr('height', options.height);

  const plot = root
    .selectAll<SVGGElement, null>('g.pie-chart')
    .data([null])
    .join('g')
    .attr('class', 'pie-chart')
    .attr('transform', `translate(${fmt(layout.cx)},${fmt(layout.cy)})`);

  const padAngle = Math.max(0, options.padAngle ?? 0);
  const slices = plot
    .selectAll<SVGPathElement, PieSlice>('path.slice')
    .data(layout.slices, (d) => d.label)
    .join('path')
    .attr('class', 'slice')
    .attr('d', (d) => {
      const start = d.startAngle + padAngle / 2;
      const end = d.endAngle - padAngle / 2;
      return arcPath(start, end, layout.innerRadius, layout.outerRadius);
    })
    .attr('fill', (d) => d.color);

  bindPieInteractions(svg, slices, options);
  return layout;
}

function bindPieInteractions(
  svg: SVGSVGElement,
  slices: Selection<SVGPathElement, PieSlice, SVGGElement, null>,
  options: PieChartOptions,
): void {
  const tip = acquireTooltip(svg, options.tooltip);
  const tooltipOpts = options.tooltip;
  const format =
    typeof tooltipOpts === 'object' && tooltipOpts.format
      ? tooltipOpts.format
      : (s: PieSlice) => defaultTooltipContent(s, options.locale);

  const showAt = (event: MouseEvent, d: PieSlice): void => {
    const [x, y] = pointer(event, svg);
    tip?.show(format(d), { x, y });
  };

  slices
    .on('mouseenter', showAt)
    .on('mousemove', showAt)
    .on('mouseleave', () => {
      tip?.hide();
    })
    .on('click', (event: MouseEvent, d: PieSlice) => {
      options.onSliceClick?.(d, event);
    });
}

function defaultTooltipContent(slice: PieSlice, locale?: LocaleName): TooltipContent {
  return {
    title: slice.label,
    lines: [
      `${formatNumber(slice.value, { locale })} (${formatPercent(slice.share, { decimals: 1, locale })})`,
    ],
  };
}
