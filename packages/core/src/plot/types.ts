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
  /**
   * Scale type. Default: inferred from the values (number → linear, Date → time, text → band).
   * A name registered by a plugin's `scales` (Plugin API 1.1) is also accepted.
   */
  type?: ScaleKind | (string & {});
  /**
   * Lower bound of the domain. A number, a `Date`, or — on a time axis — an ISO
   * string such as `2026-01-01`. Turns off `nice` on this axis.
   */
  min?: number | Date | string;
  /**
   * Upper bound of the domain. A number, a `Date`, or — on a time axis — an ISO
   * string such as `2026-01-31`. Turns off `nice` on this axis.
   */
  max?: number | Date | string;
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
  /** Base of a logarithmic axis. Default: `10`. Log axes only. */
  base?: number;
  /** Add the multiples of the base inside each decade as minor ticks. Log axes only. */
  minorTicks?: boolean;
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
  /** Colour categories and legend. */
  color?: ColorSpec;
  /** Locale for default tick labels. Default: the library locale. */
  locale?: LocaleName | undefined;
  /** Optional chart title, drawn centred above the plot area in the top margin. */
  title?: string;
  /** Optional subtitle, drawn below the title (or above the plot area when there is no title). */
  subtitle?: string;
  /** Zoom and pan of the plot area. Off unless `isEnabled` is `true`. */
  zoom?: ZoomSpec;
  /**
   * Called after every draw, including the redraws of a zoom, once the built-in
   * layers are in place. Use it for decorations that `plot()` does not draw: the
   * SVG is cleared on each draw, so anything added outside this hook is lost.
   */
  onRender?: (ctx: PlotContext) => void;
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
  /** Colour of each category, from the `color` spec or the marks' categories. */
  readonly color: ColorScale;
  /** A new group in the plot area, drawn after the groups created before it. */
  layer(name: string): SVGGElement;
}

/** Colour categories: marks declare them, the plot maps each one to a colour. */
export interface ColorSpec {
  /** Categories, in order. Default: the categories the marks declare, by first appearance. */
  domain?: readonly string[];
  /** Colours, used in order and then repeated. Default: the theme palette. */
  range?: readonly string[];
  /** Draw a horizontal legend above the plot area. Default: `false`. */
  legend?: boolean;
}

/** Maps a category to its colour. Only categories of the domain are known. */
export interface ColorScale {
  readonly domain: readonly string[];
  (category: string): string;
}

/**
 * A mark: one visual layer of the plot (points, bars, gridlines…).
 *
 * `xValues` and `yValues` list the values the mark needs on each axis, so the
 * domain can be computed. `colorValues` lists the colour categories it uses.
 * `render` draws the mark with `ctx.layer()`.
 */
export interface Mark {
  readonly name: string;
  xValues?(): readonly Primitive[];
  yValues?(): readonly Primitive[];
  colorValues?(): readonly string[];
  render(ctx: PlotContext): void;
}

/** Axes that zoom. */
export type ZoomAxes = 'x' | 'y' | 'both';

/**
 * How the wheel acts when several axes can zoom.
 * - `independent`: a wheel over an axis zooms that axis only; a wheel over the plot zooms every zoomable axis.
 * - `joint`: a wheel zooms every zoomable axis by the same factor, so their ratio is kept.
 */
export type ZoomLink = 'independent' | 'joint';

/** Zoom and pan of the plot area. */
export interface ZoomSpec {
  /** Turn zoom and pan on. Default: `false`. */
  isEnabled?: boolean;
  /** Axes that zoom. Default: `both`. Band (category) axes never zoom. */
  axes?: ZoomAxes;
  /** Wheel behaviour across axes. Default: `independent`. */
  link?: ZoomLink;
  /** Zoom with the mouse wheel. Default: `true`. */
  isWheelEnabled?: boolean;
  /** Pan by dragging with the left button. Default: `true`. */
  isDragEnabled?: boolean;
  /**
   * Zoom to a zone drawn by dragging with the right button, or with the left button
   * while Shift or Ctrl is held (for a trackpad). Default: `true`.
   */
  isSelectionEnabled?: boolean;
}

/** View of one axis: a base pixel `p` is drawn at `k * p + t`, with `k >= 1` and `t <= 0`. */
export interface AxisView {
  readonly k: number;
  readonly t: number;
}

/** View of the plot: one transform per axis. The full view is `k = 1`, `t = 0` on both. */
export interface ZoomView {
  readonly x: AxisView;
  readonly y: AxisView;
}
