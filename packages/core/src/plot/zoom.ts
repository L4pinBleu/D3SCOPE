/**
 * Zoom and pan of the plot area (core interaction, composable plot model).
 *
 * The view of an axis is a linear transform of its pixel range: the base pixel
 * `p` of the axis is drawn at `k * p + t`, with `k >= 1` and `t <= 0`. Clamping
 * keeps the data covering the plot area, so the view never shows empty space.
 *
 * `plot()` keeps one session per SVG. Its view survives data updates, and the
 * wheel, drag and double-click handlers redraw with the latest spec.
 */
import type { AxisView, PlotContext, PlotSpec, ZoomSpec, ZoomView } from './types.js';

/** Largest zoom factor on one axis. */
export const MAX_ZOOM = 1000;
/** Wheel sensitivity: a delta of 100 (one notch) scales the view by about 16 %. */
const WHEEL_SENSITIVITY = 0.0015;

export const IDENTITY_AXIS: AxisView = { k: 1, t: 0 };
export const IDENTITY_VIEW: ZoomView = { x: IDENTITY_AXIS, y: IDENTITY_AXIS };

type Axis = 'x' | 'y';
type Region = 'plot' | 'x-axis' | 'y-axis';
interface Point {
  readonly x: number;
  readonly y: number;
}

interface Session {
  spec: PlotSpec;
  view: ZoomView;
  draw: (spec: PlotSpec, view: ZoomView) => PlotContext;
  ctx?: PlotContext;
}

interface Active {
  readonly session: Session;
  readonly ctx: PlotContext;
}

const sessions = new WeakMap<SVGSVGElement, Session>();
const listening = new WeakSet<SVGSVGElement>();

/** Pixel range of an axis as drawn in `view`, from its base range. */
export function viewRange(view: AxisView, base: readonly [number, number]): [number, number] {
  return [view.k * base[0] + view.t, view.k * base[1] + view.t];
}

/** Keep the data covering the plot: `t` stays within `[span * (1 - k), 0]`. */
export function clampAxis(view: AxisView, span: number): AxisView {
  const k = Math.min(MAX_ZOOM, Math.max(1, view.k));
  const t = Math.min(0, Math.max(span * (1 - k), view.t));
  return { k, t };
}

/** Multiply the zoom of an axis by `factor`, keeping the pixel `pivot` in place. */
export function zoomAxis(view: AxisView, factor: number, pivot: number, span: number): AxisView {
  const k = Math.min(MAX_ZOOM, Math.max(1, view.k * factor));
  if (k === view.k) return view;
  return clampAxis({ k, t: pivot - (pivot - view.t) * (k / view.k) }, span);
}

/** Shift an axis by `delta` pixels, within the clamped range. */
export function panAxis(view: AxisView, delta: number, span: number): AxisView {
  return clampAxis({ k: view.k, t: view.t + delta }, span);
}

/** Zoom factor of a wheel event: above 1 when the wheel moves up (negative delta). */
export function wheelFactor(deltaY: number, deltaMode: number): number {
  const pixels = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  return Math.exp(-pixels * WHEEL_SENSITIVITY);
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
    sessions.delete(svg);
    return draw(spec, IDENTITY_VIEW);
  }
  const session: Session = sessions.get(svg) ?? { spec, view: IDENTITY_VIEW, draw };
  session.spec = spec;
  session.draw = draw;
  sessions.set(svg, session);
  if (!listening.has(svg)) {
    listening.add(svg);
    listen(svg);
  }
  session.ctx = draw(spec, session.view);
  return session.ctx;
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
    onPointerDown(svg, e);
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
  const factor = wheelFactor(e.deltaY, e.deltaMode);
  let view = active.session.view;
  for (const axis of targets) {
    const span = spanOf(active.ctx, axis);
    view = withAxis(view, axis, zoomAxis(view[axis], factor, pivotOf(p, axis, span), span));
  }
  redraw(active, view);
}

function onPointerDown(svg: SVGSVGElement, e: PointerEvent): void {
  if (e.button !== 0) return;
  const active = activeSession(svg);
  if (!active || active.session.spec.zoom?.isDragEnabled === false) return;
  if (regionOf(plotPoint(svg, active, e.clientX, e.clientY), active.ctx) !== 'plot') return;
  let lastX = e.clientX;
  let lastY = e.clientY;

  function stop(): void {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', stop);
  }

  function onMove(m: PointerEvent): void {
    const current = activeSession(svg);
    if (!current) {
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
      view = withAxis(view, axis, panAxis(view[axis], delta[axis], span));
    }
    redraw(current, view);
  }

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', stop);
}

function onDoubleClick(svg: SVGSVGElement, e: MouseEvent): void {
  const active = activeSession(svg);
  if (!active) return;
  if (regionOf(plotPoint(svg, active, e.clientX, e.clientY), active.ctx) !== 'plot') return;
  redraw(active, IDENTITY_VIEW);
}
