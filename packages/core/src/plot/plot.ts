/**
 * `plot(svg, spec)`: lays out the plot area, computes the scales from the marks,
 * draws the marks in order, then the axes and their titles.
 */
import { select } from 'd3-selection';
import type { AxisDomain, AxisScale } from 'd3-axis';
import { createAxis, defaultTickFormat, renderAxis } from '../axes/index.js';
import { renderCategoricalLegend, type LegendItem } from '../legends/index.js';
import { cssVar, LIGHT_THEME } from '../theme/index.js';
import { createColorScale } from './color.js';
import { gridX, gridY } from './grid.js';
import { createAxisScale, inferKind, tickValues } from './scales.js';
import { reveal } from './reveal.js';
import { drawZoomable, viewRange } from './zoom.js';
import type {
  AxisSpec,
  Mark,
  PlotContext,
  PlotMargin,
  PlotSpec,
  PlotScale,
  Primitive,
  ZoomView,
} from './types.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFAULT_MARGIN: PlotMargin = { top: 16, right: 16, bottom: 28, left: 40 };
/** Space reserved for an axis title, in pixels. */
const TITLE_SPACE = 18;
/** Space reserved above the plot for the colour legend, in pixels. */
const LEGEND_SPACE = 22;
/** Space reserved above the plot for the chart title, in pixels. */
const TITLE_BLOCK_SPACE = 22;
/** Space reserved above the plot for the chart subtitle, in pixels. */
const SUBTITLE_BLOCK_SPACE = 16;
/** Unique ids for clip paths, so several plots on one page do not clash. */
let clipCounter = 0;
/** SVGs already drawn once: only the first display is animated. */
const drawnOnce = new WeakSet<SVGSVGElement>();

/**
 * Draw `spec` into `svg`. Any previous content of the SVG is replaced, so the
 * function is safe to call again on every data update. With `zoom.isEnabled`,
 * the wheel, drag and double-click change the view, and the view is kept
 * across calls.
 */
export function plot(svg: SVGSVGElement, spec: PlotSpec): PlotContext {
  let isFirst = !drawnOnce.has(svg);
  drawnOnce.add(svg);
  return drawZoomable(svg, spec, (s, view) => {
    const ctx = drawPlot(svg, s, view);
    // Only the very first draw of this SVG plays the animation, not the zoom redraws
    // or the data updates.
    if (isFirst) {
      isFirst = false;
      reveal(ctx, s.animation);
    }
    return ctx;
  });
}

/** Draw one frame of `spec` with the given zoom view. */
function drawPlot(svg: SVGSVGElement, spec: PlotSpec, view: ZoomView): PlotContext {
  if (!(spec.width > 0) || !(spec.height > 0)) {
    throw new RangeError('plot: width and height must be positive');
  }
  const xSpec: AxisSpec = spec.x ?? {};
  const ySpec: AxisSpec = spec.y ?? {};
  const color = createColorScale(collectColors(spec.marks), spec.color);
  const showLegend = spec.color?.legend === true && color.domain.length > 0;
  const margin = resolveMargin(spec, xSpec, ySpec, showLegend);
  const innerWidth = spec.width - margin.left - margin.right;
  const innerHeight = spec.height - margin.top - margin.bottom;
  if (innerWidth <= 0 || innerHeight <= 0) {
    throw new RangeError('plot: the margins leave no room for the plot area');
  }

  const xValues = collect(spec.marks, 'xValues');
  const yValues = collect(spec.marks, 'yValues');
  const xKind = xSpec.type ?? inferKind(xValues.length > 0 ? xValues : (xSpec.domain ?? []));
  const yKind = ySpec.type ?? inferKind(yValues);
  // Band axes have no zoom: their categories keep the full range.
  const xRange: [number, number] =
    xKind === 'band' ? [0, innerWidth] : viewRange(view.x, [0, innerWidth]);
  const yRange: [number, number] =
    yKind === 'band' ? [innerHeight, 0] : viewRange(view.y, [innerHeight, 0]);
  const x = createAxisScale(xKind, xValues, xRange, xSpec);
  const y = createAxisScale(yKind, yValues, yRange, ySpec);
  const outOfDomain = { x: countOutside(xValues, xSpec), y: countOutside(yValues, ySpec) };

  svg.replaceChildren();
  svg.setAttribute('width', String(spec.width));
  svg.setAttribute('height', String(spec.height));
  if (outOfDomain.x + outOfDomain.y > 0) svg.setAttribute('data-d3s-out-of-domain', 'true');
  const root = document.createElementNS(SVG_NS, 'g');
  root.setAttribute('class', 'd3s-plot');
  root.setAttribute('transform', `translate(${String(margin.left)},${String(margin.top)})`);
  svg.appendChild(root);

  // Every mark layer is clipped to the plot area, so values outside min/max
  // do not spill over the axes.
  const clipId = `d3s-clip-${String(++clipCounter)}`;
  const defs = document.createElementNS(SVG_NS, 'defs');
  const clip = document.createElementNS(SVG_NS, 'clipPath');
  clip.setAttribute('id', clipId);
  const clipRect = document.createElementNS(SVG_NS, 'rect');
  clipRect.setAttribute('width', String(innerWidth));
  clipRect.setAttribute('height', String(innerHeight));
  clip.appendChild(clipRect);
  defs.appendChild(clip);
  root.appendChild(defs);

  const ctx: PlotContext = {
    svg,
    width: spec.width,
    height: spec.height,
    innerWidth,
    innerHeight,
    margin,
    x,
    y,
    xSpec,
    ySpec,
    locale: spec.locale,
    outOfDomain,
    color,
    layer(name) {
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', `d3s-layer d3s-${name}`);
      g.setAttribute('clip-path', `url(#${clipId})`);
      root.appendChild(g);
      return g;
    },
  };

  // Gridlines from the axis `grid` options go first, so marks are drawn on top.
  const gridMarks: Mark[] = [];
  if (ySpec.grid) gridMarks.push(gridY(typeof ySpec.grid === 'object' ? ySpec.grid : {}));
  if (xSpec.grid) gridMarks.push(gridX(typeof xSpec.grid === 'object' ? xSpec.grid : {}));
  for (const mark of [...gridMarks, ...spec.marks]) mark.render(ctx);

  drawAxes(ctx, root);
  const titleHeight =
    (spec.title !== undefined ? TITLE_BLOCK_SPACE : 0) +
    (spec.subtitle !== undefined ? SUBTITLE_BLOCK_SPACE : 0);
  if (showLegend) {
    drawLegend(
      svg,
      color.domain.map((c) => ({ label: c, color: color(c) })),
      margin,
      titleHeight,
    );
  }
  drawTitle(svg, spec);
  spec.onRender?.(ctx);
  return ctx;
}

function resolveMargin(
  spec: PlotSpec,
  xSpec: AxisSpec,
  ySpec: AxisSpec,
  legend: boolean,
): PlotMargin {
  const m = { ...DEFAULT_MARGIN, ...spec.margin };
  if (ySpec.label !== undefined) m.left += TITLE_SPACE;
  if (xSpec.label !== undefined) m.bottom += TITLE_SPACE;
  if (legend) m.top += LEGEND_SPACE;
  if (spec.title !== undefined) m.top += TITLE_BLOCK_SPACE;
  if (spec.subtitle !== undefined) m.top += SUBTITLE_BLOCK_SPACE;
  return m;
}

/** Draw the colour legend in the space above the plot area, below the title block. */
function drawLegend(
  svg: SVGSVGElement,
  items: readonly LegendItem[],
  margin: PlotMargin,
  offsetY: number,
): void {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'd3s-legend');
  g.setAttribute('transform', `translate(${String(margin.left)},${String(4 + offsetY)})`);
  svg.appendChild(g);
  renderCategoricalLegend(g, items, { orientation: 'horizontal' });
}

/**
 * Draw the chart title and subtitle, centred on the SVG width.
 *
 * When a legend is shown, the title block is drawn above the legend, so the
 * legend stays next to the plot area.
 */
function drawTitle(svg: SVGSVGElement, spec: PlotSpec): void {
  if (spec.title === undefined && spec.subtitle === undefined) return;
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'd3s-title-group');
  svg.appendChild(g);
  let y = 20;
  if (spec.title !== undefined) {
    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('class', 'd3s-title');
    t.setAttribute('x', String(spec.width / 2));
    t.setAttribute('y', String(y));
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('fill', cssVar('text', LIGHT_THEME.text));
    t.setAttribute('font-family', cssVar('fontFamily', LIGHT_THEME.fontFamily));
    t.setAttribute('font-size', '16');
    t.textContent = spec.title;
    g.appendChild(t);
    y += 16;
  }
  if (spec.subtitle !== undefined) {
    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('class', 'd3s-subtitle');
    t.setAttribute('x', String(spec.width / 2));
    t.setAttribute('y', String(y));
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('fill', cssVar('textMuted', LIGHT_THEME.textMuted));
    t.setAttribute('font-family', cssVar('fontFamily', LIGHT_THEME.fontFamily));
    t.setAttribute('font-size', '12');
    t.textContent = spec.subtitle;
    g.appendChild(t);
  }
}

function collectColors(marks: readonly Mark[]): string[] {
  const out: string[] = [];
  for (const mark of marks) {
    const values = mark.colorValues?.();
    if (values) out.push(...values);
  }
  return out;
}

function collect(marks: readonly Mark[], key: 'xValues' | 'yValues'): Primitive[] {
  const out: Primitive[] = [];
  for (const mark of marks) {
    const values = mark[key]?.();
    if (values) out.push(...values);
  }
  return out;
}

/** Number of values outside a fixed `min`/`max` on a continuous axis. Band axes have none. */
export function countOutside(values: readonly Primitive[], spec: AxisSpec): number {
  if (spec.min === undefined && spec.max === undefined) return 0;
  const lo = spec.min === undefined ? -Infinity : toNum(spec.min);
  const hi = spec.max === undefined ? Infinity : toNum(spec.max);
  let count = 0;
  for (const v of values) {
    if (typeof v === 'string') continue;
    const n = toNum(v);
    if (n < lo || n > hi) count++;
  }
  return count;
}

function toNum(v: number | Date | string): number {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isNaN(t) ? Number(v) : t;
  }
  return v;
}

function drawAxes(ctx: PlotContext, root: SVGGElement): void {
  const xPos = ctx.xSpec.position ?? 'bottom';
  const yPos = ctx.ySpec.position ?? 'left';
  const xGroup = appendGroup(root, 'd3s-axis-x');
  const yGroup = appendGroup(root, 'd3s-axis-y');
  if (xPos === 'bottom')
    xGroup.setAttribute('transform', `translate(0,${String(ctx.innerHeight)})`);
  if (yPos === 'right') yGroup.setAttribute('transform', `translate(${String(ctx.innerWidth)},0)`);
  drawAxis(ctx, 'x', xGroup, xPos);
  drawAxis(ctx, 'y', yGroup, yPos);
  if (ctx.xSpec.label !== undefined) {
    title(root, ctx.xSpec.label, ctx.innerWidth / 2, ctx.innerHeight + TITLE_SPACE + 4, 0);
  }
  if (ctx.ySpec.label !== undefined) {
    title(root, ctx.ySpec.label, -ctx.innerHeight / 2, -TITLE_SPACE - 4, -90);
  }
}

function drawAxis(
  ctx: PlotContext,
  axis: 'x' | 'y',
  group: SVGGElement,
  side: NonNullable<AxisSpec['position']>,
): void {
  const scale = axis === 'x' ? ctx.x : ctx.y;
  const spec = axis === 'x' ? ctx.xSpec : ctx.ySpec;
  // The scale is a d3 scale underneath; the axis helpers take it through this cast.
  const d3Scale = scale.d3 as AxisScale<AxisDomain>;
  const options = {
    orientation: side,
    tickCount: spec.ticks ?? 5,
    locale: ctx.locale,
    ...(spec.tickFormat
      ? { tickFormat: spec.tickFormat as unknown as (v: AxisDomain) => string }
      : {}),
  };
  if (scale.kind === 'band') {
    renderAxis(group, d3Scale, options);
    return;
  }
  // While zoomed, the ticks are taken from the part of the axis that is visible,
  // so a zoomed axis keeps its labels, and their format follows that part. Without
  // zoom the visible part is the whole domain and the ticks do not change.
  const span = axis === 'x' ? ctx.innerWidth : ctx.innerHeight;
  const part = visiblePart(scale, span);
  const count = options.tickCount;
  const isInView = (value: Primitive): boolean => {
    const p = scale.position(value);
    return p >= -VISIBLE_EPSILON && p <= span + VISIBLE_EPSILON;
  };
  // Automatic ticks of the visible part (the whole axis when not zoomed).
  const automatic = (): Primitive[] =>
    (part?.copy ?? (d3Scale as unknown as ContinuousD3)).ticks(count) as Primitive[];
  let all: Primitive[];
  if (spec.minorTicks === true) {
    all = tickValues(scale, spec);
  } else if (spec.step !== undefined) {
    all =
      part !== undefined && scale.kind === 'linear'
        ? stepValues(part.lo, part.hi, spec.step)
        : tickValues(scale, spec);
  } else {
    all = automatic();
  }
  // A fixed step (or minor ticks) can leave fewer than two ticks in a zoomed window,
  // e.g. a 10 step over a window of 3. Then the automatic ticks of the window are used.
  if (part !== undefined && all.filter(isInView).length < 2) all = automatic();
  const inView = all.filter(isInView);
  const format =
    spec.tickFormat ??
    (part !== undefined
      ? defaultTickFormat(part.copy as unknown as AxisScale<AxisDomain>, count, ctx.locale)
      : undefined);
  const generator = createAxis(d3Scale, {
    ...options,
    ...(format !== undefined ? { tickFormat: format as unknown as (v: AxisDomain) => string } : {}),
  });
  generator.tickValues(inView as unknown as AxisDomain[]);
  select(group)
    .style('color', cssVar('textMuted', LIGHT_THEME.textMuted))
    .style('font-family', cssVar('fontFamily', LIGHT_THEME.fontFamily))
    .call(generator);
  clampDomainLine(group, side, scale.range, span);
}

/** Tolerance, in pixels, when a tick is tested against the visible plot. */
const VISIBLE_EPSILON = 1e-6;

/** The part of a continuous d3 scale that the axis helpers use. */
interface ContinuousD3 {
  invert(pixel: number): unknown;
  copy(): ContinuousD3;
  domain(values: unknown[]): ContinuousD3;
  ticks(count: number): unknown[];
}

/** The visible part of an axis: its scale over the visible values, and their range. */
interface VisiblePart {
  /** A copy of the scale whose domain is the visible values (same range). */
  readonly copy: ContinuousD3;
  readonly lo: number;
  readonly hi: number;
}

function numberOf(value: unknown): number {
  return value instanceof Date ? value.getTime() : Number(value);
}

/**
 * The values shown on the visible part of a continuous axis. Undefined when the
 * scale cannot be inverted there (band axes, or a log axis with values below 0).
 */
function visiblePart(scale: PlotScale, span: number): VisiblePart | undefined {
  if (scale.kind === 'band') return undefined;
  const d3 = scale.d3 as ContinuousD3;
  const a = d3.invert(0);
  const b = d3.invert(span);
  const lo = Math.min(numberOf(a), numberOf(b));
  const hi = Math.max(numberOf(a), numberOf(b));
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return undefined;
  if (scale.kind === 'log' && lo <= 0) return undefined;
  return { copy: d3.copy().domain([a, b]), lo, hi };
}

/** Multiples of `step` between `lo` and `hi` (fixed-step linear axes). */
function stepValues(lo: number, hi: number, step: number): Primitive[] {
  if (!(step > 0)) throw new RangeError('plot: step must be positive');
  const out: Primitive[] = [];
  const first = Math.ceil(lo / step - 1e-9);
  const last = Math.floor(hi / step + 1e-9);
  for (let k = first; k <= last; k += 1) out.push(Number((k * step).toPrecision(12)));
  return out;
}

/**
 * Stop the axis line at the plot's edges. While zoomed, the scale extends past
 * the plot, and d3 would draw the line past the plot too. The line keeps d3's
 * shape (tick marks at both ends) between the clamped range ends.
 */
function clampDomainLine(
  group: SVGGElement,
  side: NonNullable<AxisSpec['position']>,
  range: readonly [number, number],
  span: number,
): void {
  const domain = group.querySelector('path.domain');
  if (!domain) return;
  const clamp = (v: number): number => Math.min(span, Math.max(0, v));
  const [r0, r1] = range;
  const c0 = clamp(r0);
  const c1 = clamp(r1);
  if (c0 === r0 && c1 === r1) return;
  const tick = 6;
  const d =
    side === 'bottom'
      ? `M${String(c0)},${String(tick)}V0.5H${String(c1)}V${String(tick)}`
      : side === 'top'
        ? `M${String(c0)},${String(-tick)}V0.5H${String(c1)}V${String(-tick)}`
        : side === 'left'
          ? `M${String(-tick)},${String(c0)}H0.5V${String(c1)}H${String(-tick)}`
          : `M${String(tick)},${String(c0)}H0.5V${String(c1)}H${String(tick)}`;
  domain.setAttribute('d', d);
}

function appendGroup(parent: SVGGElement, cls: string): SVGGElement {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', cls);
  parent.appendChild(g);
  return g;
}

function title(parent: SVGGElement, text: string, x: number, y: number, rotate: number): void {
  const t = document.createElementNS(SVG_NS, 'text');
  t.setAttribute('x', String(x));
  t.setAttribute('y', String(y));
  t.setAttribute('text-anchor', 'middle');
  t.setAttribute('fill', cssVar('textMuted', LIGHT_THEME.textMuted));
  t.setAttribute('font-family', cssVar('fontFamily', LIGHT_THEME.fontFamily));
  t.setAttribute('font-size', '12');
  if (rotate !== 0) {
    t.setAttribute('transform', `rotate(${String(rotate)},${String(x)},${String(y)})`);
  }
  t.textContent = text;
  parent.appendChild(t);
}
