/**
 * `plot(svg, spec)`: lays out the plot area, computes the scales from the marks,
 * draws the marks in order, then the axes and their titles.
 */
import { select } from 'd3-selection';
import type { AxisDomain, AxisScale } from 'd3-axis';
import { createAxis, renderAxis } from '../axes/index.js';
import { cssVar, LIGHT_THEME } from '../theme/index.js';
import { gridX, gridY } from './grid.js';
import { createPlotScale, inferKind, tickValues } from './scales.js';
import type { AxisSpec, Mark, PlotContext, PlotMargin, PlotSpec, Primitive } from './types.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFAULT_MARGIN: PlotMargin = { top: 16, right: 16, bottom: 28, left: 40 };
/** Space reserved for an axis title, in pixels. */
const TITLE_SPACE = 18;
/** Unique ids for clip paths, so several plots on one page do not clash. */
let clipCounter = 0;

/**
 * Draw `spec` into `svg`. Any previous content of the SVG is replaced, so the
 * function is safe to call again on every data update.
 */
export function plot(svg: SVGSVGElement, spec: PlotSpec): PlotContext {
  if (!(spec.width > 0) || !(spec.height > 0)) {
    throw new RangeError('plot: width and height must be positive');
  }
  const xSpec: AxisSpec = spec.x ?? {};
  const ySpec: AxisSpec = spec.y ?? {};
  const margin = resolveMargin(spec, xSpec, ySpec);
  const innerWidth = spec.width - margin.left - margin.right;
  const innerHeight = spec.height - margin.top - margin.bottom;
  if (innerWidth <= 0 || innerHeight <= 0) {
    throw new RangeError('plot: the margins leave no room for the plot area');
  }

  const xValues = collect(spec.marks, 'xValues');
  const yValues = collect(spec.marks, 'yValues');
  const xKind = xSpec.type ?? inferKind(xValues.length > 0 ? xValues : (xSpec.domain ?? []));
  const yKind = ySpec.type ?? inferKind(yValues);
  const x = createPlotScale(xKind, xValues, [0, innerWidth], xSpec);
  const y = createPlotScale(yKind, yValues, [innerHeight, 0], ySpec);
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
  return ctx;
}

function resolveMargin(spec: PlotSpec, xSpec: AxisSpec, ySpec: AxisSpec): PlotMargin {
  const m = { ...DEFAULT_MARGIN, ...spec.margin };
  if (ySpec.label !== undefined) m.left += TITLE_SPACE;
  if (xSpec.label !== undefined) m.bottom += TITLE_SPACE;
  return m;
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

function toNum(v: number | Date): number {
  return v instanceof Date ? v.getTime() : v;
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
  if (spec.step === undefined) {
    renderAxis(group, d3Scale, options);
    return;
  }
  // A fixed step: give d3-axis the tick values explicitly.
  const generator = createAxis(d3Scale, options);
  generator.tickValues(tickValues(scale, spec) as unknown as AxisDomain[]);
  select(group)
    .style('color', cssVar('textMuted', LIGHT_THEME.textMuted))
    .style('font-family', cssVar('fontFamily', LIGHT_THEME.fontFamily))
    .call(generator);
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
