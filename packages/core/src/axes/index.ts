/**
 * Axes: thin wrappers over `d3-axis` (PLAN.md §3).
 *
 * `createAxis` builds the axis generator for a scale; `renderAxis` draws it into
 * an SVG group. Locale-aware tick formatting comes with the `format/` module;
 * until then the default d3 tick format is used.
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
  /** Formats each tick value. Default: the d3 tick format of the scale. */
  tickFormat?: (value: D) => string;
}

const factories = {
  top: axisTop,
  right: axisRight,
  bottom: axisBottom,
  left: axisLeft,
} as const;

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
  if (options.tickFormat !== undefined) {
    const format = options.tickFormat;
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
  select(group).call(createAxis(scale, options));
}
