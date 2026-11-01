/**
 * Types of the composable plot model (ADR 0002).
 *
 * A plot is a list of marks drawn on two scales (x, y). Each mark declares the
 * values it needs on each axis, so the domains are computed from the data, and
 * draws itself in a layer of the plot area.
 */
import type { LocaleName } from '../format/index.js';

/** A value on an axis: a number, a date, or a category name. */
export type Primitive = number | Date | string;

/** Scale kinds. `band` is for categories. */
export type ScaleKind = 'linear' | 'log' | 'time' | 'band';

export type AxisPosition = 'top' | 'right' | 'bottom' | 'left';

export interface GridStyle {
  /** Line colour. Default: the theme's grid token. */
  color?: string;
  /** SVG dash pattern, e.g. `4 4`. Default: solid. */
  dash?: string;
  /** Line opacity, from 0 to 1. Default: 1. */
  opacity?: number;
}

/** Options of one axis. Every field is optional; the defaults are in `plot()`. */
export interface AxisSpec {
  /** Scale type. Default: inferred from the values (number → linear, Date → time, text → band). */
  type?: ScaleKind;
  /** Lower bound of the domain. Turns off `nice` on this axis. */
  min?: number | Date;
  /** Upper bound of the domain. Turns off `nice` on this axis. */
  max?: number | Date;
  /** Round the domain to readable values. Default: `true` unless `min` or `max` is set. */
  nice?: boolean;
  /** Distance between two ticks, in data units. Numeric linear axes only. */
  step?: number;
  /** Approximate number of ticks when `step` is not set. Default: 5. */
  ticks?: number;
  /** Formats a tick. Default: locale-aware numbers and dates. */
  tickFormat?: (value: Primitive) => string;
  /** Axis title, drawn next to the axis. */
  label?: string;
  /** Gridlines at the ticks. `true` uses the theme colour. */
  grid?: boolean | GridStyle;
  /** Side of the plot. Default: x at the bottom, y at the left. */
  position?: AxisPosition;
  /** Reverse the direction of the axis. Default: `false`. */
  reverse?: boolean;
  /** Category order for band axes. Default: order of first appearance in the data. */
  domain?: readonly string[];
}

export interface PlotMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PlotSpec {
  /** Outer width of the SVG, in pixels. */
  width: number;
  /** Outer height of the SVG, in pixels. */
  height: number;
  /** Space around the plot area. Missing sides keep their default. */
  margin?: Partial<PlotMargin>;
  x?: AxisSpec;
  y?: AxisSpec;
  /** Locale for default tick labels. Default: the library locale. */
  locale?: LocaleName | undefined;
  /** Marks, drawn in this order (later marks are drawn on top). */
  marks: readonly Mark[];
}

/** A scale as the plot sees it: maps a value to a pixel position. */
export interface PlotScale {
  readonly kind: ScaleKind;
  /** The underlying d3 scale (used by the axis helpers). */
  readonly d3: unknown;
  /** Pixel position of a value. For band scales, the start of its band. */
  position(value: Primitive): number;
  /** Width of one band in pixels; `0` for continuous scales. */
  bandwidth(): number;
  /** Tick values for this axis, in data units. */
  ticks(count: number): Primitive[];
  /** The domain, in data units (categories for band scales). */
  readonly domain: readonly Primitive[];
  /** Pixel range `[start, end]`. */
  readonly range: readonly [number, number];
}

/** Everything a mark needs to draw itself. */
export interface PlotContext {
  readonly svg: SVGSVGElement;
  readonly width: number;
  readonly height: number;
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly margin: PlotMargin;
  readonly x: PlotScale;
  readonly y: PlotScale;
  readonly xSpec: AxisSpec;
  readonly ySpec: AxisSpec;
  readonly locale: LocaleName | undefined;
  /**
   * Values outside a fixed `min`/`max`, per axis. They are drawn clipped to the
   * plot area, and the SVG gets `data-d3s-out-of-domain="true"`.
   */
  readonly outOfDomain: { readonly x: number; readonly y: number };
  /** A new group in the plot area, drawn after the groups created before it. */
  layer(name: string): SVGGElement;
}

/**
 * A mark: one visual layer of the plot (points, bars, gridlines…).
 *
 * `xValues` and `yValues` list the values the mark needs on each axis, so the
 * domain can be computed. `render` draws the mark with `ctx.layer()`.
 */
export interface Mark {
  readonly name: string;
  xValues?(): readonly Primitive[];
  yValues?(): readonly Primitive[];
  render(ctx: PlotContext): void;
}
