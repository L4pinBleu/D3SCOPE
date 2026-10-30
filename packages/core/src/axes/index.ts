/**
 * Axes: thin wrappers over `d3-axis` (PLAN.md §3).
 *
 * `createAxis` builds the axis generator for a scale; `renderAxis` draws it into
 * an SVG group. Default tick labels are locale-aware (see `format/`).
 */
import {
  axisBottom,
  axisLeft,
  axisRight,
  axisTop,
  type Axis,
  type AxisDomain,
  type AxisScale,
} from 'd3-axis';
import { select } from 'd3-selection';
import { formatDate, formatNumber, type LocaleName } from '../format/index.js';
import { cssVar, LIGHT_THEME } from '../theme/index.js';

export type AxisOrientation = 'top' | 'right' | 'bottom' | 'left';

export interface AxisOptions<D extends AxisDomain> {
  /** Side of the plot the axis is drawn on. */
  orientation: AxisOrientation;
  /** Approximate number of ticks. d3 default: 10. */
  tickCount?: number;
  /** Length of tick marks in pixels. d3 default: 6. */
  tickSize?: number;
  /** Distance between tick marks and labels in pixels. d3 default: 3. */
  tickPadding?: number;
  /**
   * Formats each tick value. Default: locale-aware numbers and dates (see
   * `locale`); band scales keep their category labels.
   */
  tickFormat?: (value: D) => string;
  /** Locale for default tick labels. Default: the library locale (`fr-FR`). */
  locale?: LocaleName | undefined;
}

const factories = {
  top: axisTop,
  right: axisRight,
  bottom: axisBottom,
  left: axisLeft,
} as const;

/** Locale-aware default labels for a numeric or time scale; `undefined` for band scales. */
export function defaultTickFormat<D extends AxisDomain>(
  scale: AxisScale<D>,
  tickCount: number,
  locale: LocaleName | undefined,
): ((value: D) => string) | undefined {
  const domain = scale.domain() as unknown[];
  const sample = domain[0];
  if (sample instanceof Date) {
    return (value) => formatDate(value as unknown as Date, { locale });
  }
  if (typeof sample !== 'number') return undefined;

  // Decimals follow the tick step, so 0.25 steps show two digits and 1000 steps none.
  const ticks = (scale as unknown as { ticks(count: number): number[] }).ticks(tickCount);
  const first = ticks[0];
  const second = ticks[1];
  const step = first !== undefined && second !== undefined ? Math.abs(second - first) : 1;
  const decimals = step >= 1 || step === 0 ? 0 : Math.min(10, Math.ceil(-Math.log10(step)));
  return (value) => formatNumber(value as unknown as number, { decimals, locale });
}

/** Build the d3 axis generator for `scale`, configured from `options`. */
export function createAxis<D extends AxisDomain>(
  scale: AxisScale<D>,
  options: AxisOptions<D>,
): Axis<D> {
  const axis = factories[options.orientation](scale);
  if (options.tickCount !== undefined) {
    axis.ticks(options.tickCount);
  }
  if (options.tickSize !== undefined) {
    axis.tickSize(options.tickSize);
  }
  if (options.tickPadding !== undefined) {
    axis.tickPadding(options.tickPadding);
  }
  const format =
    options.tickFormat ?? defaultTickFormat(scale, options.tickCount ?? 10, options.locale);
  if (format !== undefined) {
    axis.tickFormat((value) => format(value));
  }
  return axis;
}

/**
 * Draw (or redraw) the axis inside `group`. Redrawing replaces the previous
 * ticks, so it is safe to call on every data update.
 */
export function renderAxis<D extends AxisDomain>(
  group: SVGGElement,
  scale: AxisScale<D>,
  options: AxisOptions<D>,
): void {
  // d3-axis draws with `currentColor`, so the themed colour goes on the group.
  select(group)
    .style('color', cssVar('textMuted', LIGHT_THEME.textMuted))
    .style('font-family', cssVar('fontFamily', LIGHT_THEME.fontFamily))
    .call(createAxis(scale, options));
}
