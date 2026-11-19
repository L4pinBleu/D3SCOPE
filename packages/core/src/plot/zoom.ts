/**
 * Zoom and pan of the plot area (core interaction, composable plot model).
 *
 * The view of an axis is a linear transform of its pixel range: the base pixel
 * `p` of the axis is drawn at `k * p + t`, with `k >= 1` and `t <= 0`. Clamping
 * keeps the data covering the plot area, so the view never shows empty space.
 *
 * Mouse: the wheel zooms around the cursor, the left button drags to pan, the
 * right button drags a rectangle and zooms to it. Touch: one finger pans, two
 * fingers pinch. The view returns to the full view by a double-click, a reset
 * button, or both, as `resetOn` says.
 *
 * `plot()` keeps one session per SVG. Its view survives data updates, and every
 * handler redraws with the latest spec.
 */
import { cssVar } from '../theme/index.js';
import type {
  AxisView,
  AxisZoomLimits,
  PlotContext,
  PlotSpec,
  Primitive,
  ZoomReset,
  ZoomSpec,
  ZoomView,
} from './types.js';

/** Largest zoom factor on one axis. */
export const MAX_ZOOM = 1000;
/** Wheel sensitivity: a delta of 100 (one notch) scales the view by about 16 %. */
const WHEEL_SENSITIVITY = 0.0015;
/** Pinch sensitivity (trackpad, wheel with ctrlKey): a pinch zooms faster than a scroll. */
const PINCH_SENSITIVITY = 0.01;
/** Smallest selection, in pixels, that zooms an axis. Smaller drags are ignored. */
const MIN_SELECTION = 4;
const SVG_NS = 'http://www.w3.org/2000/svg';

export const IDENTITY_AXIS: AxisView = { k: 1, t: 0 };
export const IDENTITY_VIEW: ZoomView = { x: IDENTITY_AXIS, y: IDENTITY_AXIS };

type Axis = 'x' | 'y';
type Region = 'plot' | 'x-axis' | 'y-axis';
interface Point {
  readonly x: number;
  readonly y: number;
}
interface Rect {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

interface Session {
  spec: PlotSpec;
  view: ZoomView;
  draw: (spec: PlotSpec, view: ZoomView) => PlotContext;
  ctx?: PlotContext;
  /** What the pointer is doing, so the hover cursor does not override it. */
  busy?: 'pan' | 'select' | 'pinch' | undefined;
}

/** Pinch in progress: the spread of the two fingers, and the view when it began. */
interface Pinch {
  readonly distance: number;
  readonly view: ZoomView;
}

/** Size of the reset button, in pixels. */
const RESET_WIDTH = 104;
const RESET_HEIGHT = 22;
const DEFAULT_RESET_LABEL = 'Réinitialiser';

interface Active {
  readonly session: Session;
  readonly ctx: PlotContext;
}

const sessions = new WeakMap<SVGSVGElement, Session>();
const listening = new WeakSet<SVGSVGElement>();
/** Touch points of each plot, by pointer id, in client pixels. */
const touches = new WeakMap<SVGSVGElement, Map<number, Point>>();
const pinches = new WeakMap<SVGSVGElement, Pinch>();

/** Pixel range of an axis as drawn in `view`, from its base range. */
export function viewRange(view: AxisView, base: readonly [number, number]): [number, number] {
  return [view.k * base[0] + view.t, view.k * base[1] + view.t];
}

/**
 * The bounds of one axis, in its base frame (the pixel range of the full view).
 * The view may show base pixels `pL` to `pH` only, with zoom factors from `kMin`
 * to `kMax`.
 */
export interface AxisBounds {
  readonly span: number;
  readonly pL: number;
  readonly pH: number;
  readonly kMin: number;
  readonly kMax: number;
}

/** Smallest zoom factor of an unlimited view (zoom out without bound). */
const UNLIMITED_MIN_K = 1e-9;

/** The bounds of a chart that keeps the full view as its largest view. */
export function defaultBounds(span: number): AxisBounds {
  return { span, pL: 0, pH: span, kMin: 1, kMax: MAX_ZOOM };
}

/**
 * The bounds of one axis, from its limits in data values. The limits are read on the
 * full view, so they do not move with the zoom. Without limits, the view stays in the
 * axis's own domain, unless `unlimited` lifts that bound.
 */
export function axisBounds(
  ctx: PlotContext,
  view: ZoomView,
  axis: Axis,
  limits: AxisZoomLimits | undefined,
  unlimited: boolean,
): AxisBounds {
  const scale = axis === 'x' ? ctx.x : ctx.y;
  const current = axis === 'x' ? view.x : view.y;
  const span = spanOf(ctx, axis);
  // Base pixel of a data value: its position on the full view, whatever the zoom.
  const base = (value: Primitive): number => (scale.position(value) - current.t) / current.k;

  const domain = scale.domain;
  const first = domain[0];
  const last = domain[domain.length - 1];
  const low = limits?.min ?? (unlimited ? undefined : first);
  const high = limits?.max ?? (unlimited ? undefined : last);
  const a = low === undefined ? -Infinity : base(low);
  const b = high === undefined ? Infinity : base(high);
  const pL = Math.min(a, b);
  const pH = Math.max(a, b);
  const size = pH - pL;
  let kMin = Number.isFinite(size) && size > 0 ? span / size : UNLIMITED_MIN_K;
  let kMax = MAX_ZOOM;

  // Span limits, in data units: only meaningful where the scale is linear in value.
  if (
    first !== undefined &&
    last !== undefined &&
    (scale.kind === 'linear' || scale.kind === 'time')
  ) {
    const fullPixels = Math.abs(base(last) - base(first));
    const dataFull = Math.abs(numberOf(last) - numberOf(first));
    if (fullPixels > 0 && dataFull > 0) {
      // Data units visible at a zoom factor of 1; the width shrinks as 1 / k.
      const widthAtOne = (dataFull * span) / fullPixels;
      if (limits?.minSpan !== undefined) kMax = Math.min(kMax, widthAtOne / limits.minSpan);
      if (limits?.maxSpan !== undefined) kMin = Math.max(kMin, widthAtOne / limits.maxSpan);
    }
  }
  if (kMax < kMin) kMax = kMin;
  return { span, pL, pH, kMin, kMax };
}

/** Check the limits of a chart before drawing it. */
export function validateZoomLimits(zoom: ZoomSpec | undefined): void {
  for (const limits of [zoom?.x, zoom?.y]) {
    if (limits === undefined) continue;
    if (limits.minSpan !== undefined && !(limits.minSpan > 0)) {
      throw new RangeError('plot: zoom limits minSpan must be positive');
    }
    if (limits.maxSpan !== undefined && !(limits.maxSpan > 0)) {
      throw new RangeError('plot: zoom limits maxSpan must be positive');
    }
    if (
      limits.minSpan !== undefined &&
      limits.maxSpan !== undefined &&
      limits.maxSpan < limits.minSpan
    ) {
      throw new RangeError('plot: zoom limits maxSpan must not be below minSpan');
    }
  }
}

/** A number from a data value: dates become their time, numbers stay numbers. */
function numberOf(value: Primitive): number {
  return value instanceof Date ? value.getTime() : Number(value);
}

/** The bounds of `axis` for the current view and zoom options. */
export function boundsFor(
  ctx: PlotContext,
  view: ZoomView,
  zoom: ZoomSpec,
  axis: Axis,
): AxisBounds {
  return axisBounds(
    ctx,
    view,
    axis,
    axis === 'x' ? zoom.x : zoom.y,
    zoom.isUnlimitedZoomOut === true,
  );
}

/**
 * Keep the view in its bounds: first the zoom factor, then the offset, so the
 * visible base pixels stay within `pL` and `pH`.
 */
export function clampAxis(
  view: AxisView,
  span: number,
  bounds: AxisBounds = defaultBounds(span),
): AxisView {
  const k = Math.min(bounds.kMax, Math.max(bounds.kMin, view.k));
  const lo = Number.isFinite(bounds.pH) ? bounds.span - k * bounds.pH : -Infinity;
  const hi = Number.isFinite(bounds.pL) ? 0 - k * bounds.pL : Infinity;
  const t = Math.min(hi, Math.max(lo, view.t));
  return { k, t };
}

/** Multiply the zoom of an axis by `factor`, keeping the pixel `pivot` in place. */
export function zoomAxis(
  view: AxisView,
  factor: number,
  pivot: number,
  span: number,
  bounds: AxisBounds = defaultBounds(span),
): AxisView {
  const k = Math.min(bounds.kMax, Math.max(bounds.kMin, view.k * factor));
  if (k === view.k) return view;
  return clampAxis({ k, t: pivot - (pivot - view.t) * (k / view.k) }, span, bounds);
}

/** Shift an axis by `delta` pixels, within its bounds. */
export function panAxis(
  view: AxisView,
  delta: number,
  span: number,
  bounds: AxisBounds = defaultBounds(span),
): AxisView {
  return clampAxis({ k: view.k, t: view.t + delta }, span, bounds);
}

/**
 * The view that spreads the pixels `a` to `b` of the current view over the whole
 * axis of length `span`.
 */
export function zoomToSpan(
  view: AxisView,
  a: number,
  b: number,
  span: number,
  bounds: AxisBounds = defaultBounds(span),
): AxisView {
  const base0 = (a - view.t) / view.k;
  const k = (span * view.k) / (b - a);
  return clampAxis({ k, t: -k * base0 }, span, bounds);
}

/** Zoom factor of a wheel event: above 1 when the wheel moves up (negative delta). */
export function wheelFactor(
  deltaY: number,
  deltaMode: number,
  sensitivity: number = WHEEL_SENSITIVITY,
): number {
  const pixels = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  return Math.exp(-pixels * sensitivity);
}

/**
 * Draw through the zoom session of `svg`. Creates the session on first use,
 * keeps its view across calls, and drops it when zoom is off.
 */
export function drawZoomable(
  svg: SVGSVGElement,
  spec: PlotSpec,
  draw: (spec: PlotSpec, view: ZoomView) => PlotContext,
): PlotContext {
  if (spec.zoom?.isEnabled !== true) {
    if (sessions.has(svg)) {
      svg.style.cursor = '';
      svg.style.touchAction = '';
    }
    sessions.delete(svg);
    return draw(spec, IDENTITY_VIEW);
  }
  // Reject bad limits when the chart is drawn, not at the first wheel event.
  validateZoomLimits(spec.zoom);
  const session: Session = sessions.get(svg) ?? { spec, view: IDENTITY_VIEW, draw };
  session.spec = spec;
  // Every redraw, from a handler or from here, adds the same decorations.
  session.draw = (next, view) => paint(svg, next, view, draw);
  sessions.set(svg, session);
  // A finger pans and two fingers pinch: the page must not scroll or zoom under them.
  svg.style.touchAction = 'none';
  if (!listening.has(svg)) {
    listening.add(svg);
    listen(svg);
  }
  session.ctx = session.draw(spec, session.view);
  return session.ctx;
}

/** Draw the chart, then the controls that zoom adds on top of it. */
function paint(
  svg: SVGSVGElement,
  spec: PlotSpec,
  view: ZoomView,
  draw: (spec: PlotSpec, view: ZoomView) => PlotContext,
): PlotContext {
  const ctx = draw(spec, view);
  if (resetsOn(spec.zoom, 'button')) {
    addResetButton(svg, ctx, spec.zoom?.resetLabel ?? DEFAULT_RESET_LABEL);
  }
  return ctx;
}

/** Whether `mode` resets the view, given the `resetOn` option (`dblclick` by default). */
function resetsOn(zoom: ZoomSpec | undefined, mode: 'dblclick' | 'button'): boolean {
  const on: ZoomReset = zoom?.resetOn ?? 'dblclick';
  return on === 'both' || on === mode;
}

/** Reset button above the top right of the plot area. Clicking it, or pressing Enter on it, resets the view. */
function addResetButton(svg: SVGSVGElement, ctx: PlotContext, label: string): void {
  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('class', 'd3s-zoom-reset');
  group.setAttribute('role', 'button');
  group.setAttribute('tabindex', '0');
  group.setAttribute('aria-label', label);
  group.setAttribute('style', 'cursor: pointer');
  const x = ctx.margin.left + ctx.innerWidth - RESET_WIDTH;
  const y = Math.max(0, ctx.margin.top - RESET_HEIGHT - 4);

  const box = document.createElementNS(SVG_NS, 'rect');
  box.setAttribute('x', String(x));
  box.setAttribute('y', String(y));
  box.setAttribute('width', String(RESET_WIDTH));
  box.setAttribute('height', String(RESET_HEIGHT));
  box.setAttribute('rx', '3');
  box.setAttribute('stroke-opacity', '0.4');
  box.setAttribute(
    'style',
    `fill: ${cssVar('surface', '#ffffff')}; stroke: ${cssVar('text', '#1f2328')}`,
  );
  group.appendChild(box);

  const text = document.createElementNS(SVG_NS, 'text');
  text.setAttribute('x', String(x + RESET_WIDTH / 2));
  text.setAttribute('y', String(y + RESET_HEIGHT / 2));
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'central');
  text.setAttribute('font-size', '12');
  text.setAttribute('style', `fill: ${cssVar('text', '#1f2328')}`);
  text.textContent = label;
  group.appendChild(text);

  group.addEventListener('click', (e) => {
    e.stopPropagation();
    resetZoom(svg);
  });
  group.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    resetZoom(svg);
  });
  svg.appendChild(group);
}

/** The view of `svg`, or `undefined` when zoom is off. */
export function getZoomView(svg: SVGSVGElement): ZoomView | undefined {
  const session = sessions.get(svg);
  return session?.spec.zoom?.isEnabled === true ? session.view : undefined;
}

/** Back to the full view. Does nothing when zoom is off. */
export function resetZoom(svg: SVGSVGElement): void {
  const active = activeSession(svg);
  if (active) redraw(active, IDENTITY_VIEW);
}

function activeSession(svg: SVGSVGElement): Active | undefined {
  const session = sessions.get(svg);
  const ctx = session?.ctx;
  if (!session || !ctx || session.spec.zoom?.isEnabled !== true) return undefined;
  return { session, ctx };
}

function redraw(active: Active, view: ZoomView): void {
  active.session.view = view;
  active.session.ctx = active.session.draw(active.session.spec, view);
}

function listen(svg: SVGSVGElement): void {
  svg.addEventListener(
    'wheel',
    (e) => {
      onWheel(svg, e);
    },
    { passive: false },
  );
  svg.addEventListener('pointerdown', (e) => {
    trackTouch(svg, e);
    onPointerDown(svg, e);
  });
  svg.addEventListener('pointermove', (e) => {
    onHover(svg, e);
    onTouchMove(svg, e);
  });
  svg.addEventListener('pointerup', (e) => {
    onTouchEnd(svg, e);
  });
  svg.addEventListener('pointercancel', (e) => {
    onTouchEnd(svg, e);
  });
  svg.addEventListener('contextmenu', (e) => {
    onContextMenu(svg, e);
  });
  svg.addEventListener('dblclick', (e) => {
    onDoubleClick(svg, e);
  });
}

/** Pointer position in the plot frame: the origin is the top-left corner of the plot area. */
function plotPoint(svg: SVGSVGElement, active: Active, clientX: number, clientY: number): Point {
  const rect = svg.getBoundingClientRect();
  const { sx, sy } = screenScale(active.session.spec, rect);
  return {
    x: (clientX - rect.left) * sx - active.ctx.margin.left,
    y: (clientY - rect.top) * sy - active.ctx.margin.top,
  };
}

/** SVG pixels per unit of the drawn size, in case CSS scales the SVG. */
function screenScale(spec: PlotSpec, rect: DOMRect): { sx: number; sy: number } {
  return {
    sx: rect.width > 0 ? spec.width / rect.width : 1,
    sy: rect.height > 0 ? spec.height / rect.height : 1,
  };
}

function regionOf(p: Point, ctx: PlotContext): Region | undefined {
  const { innerWidth, innerHeight, margin, height } = ctx;
  const inX = p.x >= 0 && p.x <= innerWidth;
  const inY = p.y >= 0 && p.y <= innerHeight;
  if (inX && inY) return 'plot';
  if (inX && p.y > innerHeight && p.y <= height - margin.top) return 'x-axis';
  if (inY && p.x < 0 && p.x >= -margin.left) return 'y-axis';
  return undefined;
}

/** Axes that can zoom: as configured, and continuous (band axes keep their categories). */
function zoomableAxes(ctx: PlotContext, zoom: ZoomSpec): Axis[] {
  const wanted = zoom.axes ?? 'both';
  const axes: Axis[] = [];
  if ((wanted === 'x' || wanted === 'both') && ctx.x.kind !== 'band') axes.push('x');
  if ((wanted === 'y' || wanted === 'both') && ctx.y.kind !== 'band') axes.push('y');
  return axes;
}

function spanOf(ctx: PlotContext, axis: Axis): number {
  return axis === 'x' ? ctx.innerWidth : ctx.innerHeight;
}

/** The pointer coordinate on `axis`, clamped to the plot area. */
function pivotOf(p: Point, axis: Axis, span: number): number {
  return Math.min(span, Math.max(0, axis === 'x' ? p.x : p.y));
}

function withAxis(view: ZoomView, axis: Axis, next: AxisView): ZoomView {
  return axis === 'x' ? { x: next, y: view.y } : { x: view.x, y: next };
}

function onWheel(svg: SVGSVGElement, e: WheelEvent): void {
  const active = activeSession(svg);
  if (!active) return;
  const zoom: ZoomSpec = active.session.spec.zoom ?? {};
  if (zoom.isWheelEnabled === false) return;
  const p = plotPoint(svg, active, e.clientX, e.clientY);
  const region = regionOf(p, active.ctx);
  if (!region) return;
  const axes = zoomableAxes(active.ctx, zoom);
  const targets =
    region === 'plot' || zoom.link === 'joint'
      ? axes
      : axes.filter((axis) => axis === (region === 'x-axis' ? 'x' : 'y'));
  if (targets.length === 0) return;
  e.preventDefault();
  // A trackpad pinch arrives as a wheel event with ctrlKey: it zooms faster per event.
  const factor = e.ctrlKey
    ? wheelFactor(e.deltaY, e.deltaMode, PINCH_SENSITIVITY)
    : wheelFactor(e.deltaY, e.deltaMode);
  let view = active.session.view;
  for (const axis of targets) {
    const span = spanOf(active.ctx, axis);
    const bounds = boundsFor(active.ctx, view, zoom, axis);
    view = withAxis(view, axis, zoomAxis(view[axis], factor, pivotOf(p, axis, span), span, bounds));
  }
  redraw(active, view);
}

/** Grab cursor over the plot area, the default cursor elsewhere. */
function onHover(svg: SVGSVGElement, e: PointerEvent): void {
  const active = activeSession(svg);
  if (!active || active.session.busy) return;
  const inPlot = regionOf(plotPoint(svg, active, e.clientX, e.clientY), active.ctx) === 'plot';
  svg.style.cursor = inPlot ? 'grab' : '';
}

/** Keep the browser menu away from the right-button selection. */
function onContextMenu(svg: SVGSVGElement, e: MouseEvent): void {
  const active = activeSession(svg);
  if (!active) return;
  if (regionOf(plotPoint(svg, active, e.clientX, e.clientY), active.ctx) === 'plot') {
    e.preventDefault();
  }
}

function onPointerDown(svg: SVGSVGElement, e: PointerEvent): void {
  const active = activeSession(svg);
  if (!active) return;
  // The reset button handles its own click, and a second finger never starts a pan.
  if (isOnResetButton(e.target)) return;
  if (e.pointerType === 'touch' && (touches.get(svg)?.size ?? 0) > 1) return;
  const zoom: ZoomSpec = active.session.spec.zoom ?? {};
  const p = plotPoint(svg, active, e.clientX, e.clientY);
  if (regionOf(p, active.ctx) !== 'plot') return;
  // Selection: right button, or left button with Shift or Ctrl (no right button on a trackpad).
  const selecting = e.button === 2 || (e.button === 0 && (e.shiftKey || e.ctrlKey));
  if (selecting) {
    if (zoom.isSelectionEnabled !== false) startSelection(svg, active, p);
  } else if (e.button === 0 && zoom.isDragEnabled !== false) {
    startPan(svg, active, e);
  }
}

/** Left button: move the view with the pointer. */
function startPan(svg: SVGSVGElement, active: Active, e: PointerEvent): void {
  const { session } = active;
  session.busy = 'pan';
  svg.style.cursor = 'grabbing';
  let lastX = e.clientX;
  let lastY = e.clientY;

  function stop(): void {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', stop);
    // A pinch that took over the pointers keeps its state.
    if (session.busy === 'pan') session.busy = undefined;
    svg.style.cursor = 'grab';
  }

  function onMove(m: PointerEvent): void {
    const current = activeSession(svg);
    if (current?.session.busy !== 'pan') {
      stop();
      return;
    }
    const { sx, sy } = screenScale(current.session.spec, svg.getBoundingClientRect());
    const delta = { x: (m.clientX - lastX) * sx, y: (m.clientY - lastY) * sy };
    lastX = m.clientX;
    lastY = m.clientY;
    let view = current.session.view;
    const zoom: ZoomSpec = current.session.spec.zoom ?? {};
    for (const axis of zoomableAxes(current.ctx, zoom)) {
      const span = spanOf(current.ctx, axis);
      const bounds = boundsFor(current.ctx, view, zoom, axis);
      view = withAxis(view, axis, panAxis(view[axis], delta[axis], span, bounds));
    }
    redraw(current, view);
  }

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', stop);
}

/** Right button: draw a rectangle, then zoom to it on release. */
function startSelection(svg: SVGSVGElement, active: Active, start: Point): void {
  const { session, ctx } = active;
  session.busy = 'select';
  svg.style.cursor = 'crosshair';
  const layer = document.createElementNS(SVG_NS, 'g');
  layer.setAttribute('class', 'd3s-zoom-selection');
  layer.setAttribute(
    'transform',
    `translate(${String(ctx.margin.left)},${String(ctx.margin.top)})`,
  );
  const box = document.createElementNS(SVG_NS, 'rect');
  box.setAttribute('fill', '#3366dd');
  box.setAttribute('fill-opacity', '0.12');
  box.setAttribute('stroke', '#3366dd');
  box.setAttribute('stroke-dasharray', '4 3');
  layer.appendChild(box);
  svg.appendChild(layer);
  let end = start;

  function paint(): void {
    const rect = toRect(start, end);
    box.setAttribute('x', String(rect.x0));
    box.setAttribute('y', String(rect.y0));
    box.setAttribute('width', String(rect.x1 - rect.x0));
    box.setAttribute('height', String(rect.y1 - rect.y0));
  }

  function stop(): void {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    layer.remove();
    session.busy = undefined;
    svg.style.cursor = '';
  }

  function onMove(m: PointerEvent): void {
    const current = activeSession(svg);
    if (!current) {
      stop();
      return;
    }
    end = clampPoint(plotPoint(svg, current, m.clientX, m.clientY), ctx);
    paint();
  }

  function onUp(): void {
    stop();
    const current = activeSession(svg);
    if (current) zoomToRect(current, toRect(start, end));
  }

  paint();
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

function toRect(a: Point, b: Point): Rect {
  return {
    x0: Math.min(a.x, b.x),
    x1: Math.max(a.x, b.x),
    y0: Math.min(a.y, b.y),
    y1: Math.max(a.y, b.y),
  };
}

function clampPoint(p: Point, ctx: PlotContext): Point {
  return {
    x: Math.min(ctx.innerWidth, Math.max(0, p.x)),
    y: Math.min(ctx.innerHeight, Math.max(0, p.y)),
  };
}

/** Zoom each zoomable axis to the rectangle; an axis with a thin selection stays as it is. */
function zoomToRect(active: Active, rect: Rect): void {
  const zoom: ZoomSpec = active.session.spec.zoom ?? {};
  let view = active.session.view;
  let changed = false;
  for (const axis of zoomableAxes(active.ctx, zoom)) {
    const a = axis === 'x' ? rect.x0 : rect.y0;
    const b = axis === 'x' ? rect.x1 : rect.y1;
    if (b - a < MIN_SELECTION) continue;
    const bounds = boundsFor(active.ctx, view, zoom, axis);
    view = withAxis(view, axis, zoomToSpan(view[axis], a, b, spanOf(active.ctx, axis), bounds));
    changed = true;
  }
  if (changed) redraw(active, view);
}

function onDoubleClick(svg: SVGSVGElement, e: MouseEvent): void {
  const active = activeSession(svg);
  if (!active || !resetsOn(active.session.spec.zoom, 'dblclick')) return;
  if (regionOf(plotPoint(svg, active, e.clientX, e.clientY), active.ctx) !== 'plot') return;
  redraw(active, IDENTITY_VIEW);
}

function isOnResetButton(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('.d3s-zoom-reset') !== null;
}

/** Remember each touch point, and start a pinch when the second finger lands. */
function trackTouch(svg: SVGSVGElement, e: PointerEvent): void {
  if (e.pointerType !== 'touch') return;
  let points = touches.get(svg);
  if (!points) {
    points = new Map();
    touches.set(svg, points);
  }
  points.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (points.size === 2) beginPinch(svg, points);
}

function beginPinch(svg: SVGSVGElement, points: Map<number, Point>): void {
  const active = activeSession(svg);
  const distance = pinchDistance(points);
  if (!active || distance === 0) return;
  // Stops a pan that the first finger started: the pinch owns the pointers now.
  active.session.busy = 'pinch';
  svg.style.cursor = '';
  pinches.set(svg, { distance, view: active.session.view });
}

/** Distance between the first two touch points, in pixels. */
function pinchDistance(points: ReadonlyMap<number, Point>): number {
  const [a, b] = [...points.values()];
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
}

function onTouchMove(svg: SVGSVGElement, e: PointerEvent): void {
  if (e.pointerType !== 'touch') return;
  const points = touches.get(svg);
  if (!points?.has(e.pointerId)) return;
  points.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const pinch = pinches.get(svg);
  if (pinch) pinchTo(svg, pinch, points);
}

/** Zoom every zoomable axis by the change of spread, keeping the midpoint of the fingers in place. */
function pinchTo(svg: SVGSVGElement, pinch: Pinch, points: ReadonlyMap<number, Point>): void {
  const active = activeSession(svg);
  const zoom: ZoomSpec = active?.session.spec.zoom ?? {};
  const distance = pinchDistance(points);
  if (!active || zoom.isWheelEnabled === false || distance === 0) return;
  const [a, b] = [...points.values()];
  if (!a || !b) return;
  const factor = distance / pinch.distance;
  const mid = plotPoint(svg, active, (a.x + b.x) / 2, (a.y + b.y) / 2);
  let view = pinch.view;
  for (const axis of zoomableAxes(active.ctx, zoom)) {
    const span = spanOf(active.ctx, axis);
    const bounds = boundsFor(active.ctx, view, zoom, axis);
    const next = zoomAxis(pinch.view[axis], factor, pivotOf(mid, axis, span), span, bounds);
    view = withAxis(view, axis, next);
  }
  redraw(active, view);
}

function onTouchEnd(svg: SVGSVGElement, e: PointerEvent): void {
  if (e.pointerType !== 'touch') return;
  const points = touches.get(svg);
  if (!points) return;
  points.delete(e.pointerId);
  if (points.size < 2 && pinches.has(svg)) {
    pinches.delete(svg);
    const session = sessions.get(svg);
    if (session?.busy === 'pinch') session.busy = undefined;
  }
  if (points.size === 0) touches.delete(svg);
}
