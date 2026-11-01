/**
 * Line and area marks for the plot model.
 *
 * Points are grouped by an optional series accessor, sorted by x inside each
 * series (so the data order does not matter), and drawn as one `<path>` per
 * series built as a plain SVG string — no d3-shape dependency. Points whose
 * position is NaN or not finite break the path instead of emitting `NaN`.
 */
import { valueOf, type Accessor } from '../channel.js';
import { labelColorScale, type LabelColorScale } from '../color.js';
import { LIGHT_THEME } from '../../theme/index.js';
import type { Mark, PlotContext, Primitive } from '../types.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Round to 2 decimals so paths stay short (same convention as charts/line). */
function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Is `p` a pixel position we can draw (not NaN, not infinite)? */
function valid(p: number): boolean {
  return Number.isFinite(p);
}

/** One drawable point: pixel position plus the raw x value (for the area baseline). */
interface Point {
  x: number;
  y: number;
}

/** A group of points, in drawing order. */
/** Sorted, valid pixel points of one series, with its first datum for colours. */
interface Rendered {
  label: string;
  /** All points in x order, invalid ones included (they break the path). */
  points: Point[];
  /** The valid points, for the area closing corners and the empty check. */
  drawn: Point[];
  datum?: unknown;
}

export interface LineOptions<T> {
  x: Accessor<T>;
  y: Accessor<T>;
  series?: Accessor<T>;
  /** One colour for every series, or an accessor resolved through a colour scale. */
  stroke?: string | Accessor<T>;
  strokeWidth?: number;
}

export interface AreaOptions<T> {
  x: Accessor<T>;
  y: Accessor<T>;
  series?: Accessor<T>;
  fill?: string | Accessor<T>;
  opacity?: number;
  /** Baseline of the filled region, in data units. Default: 0. */
  baseline?: number;
}

/**
 * Sort key of an x value: dates and numbers compare numerically, categories
 * (band axes) keep their order of first appearance.
 */
function xRanks(values: readonly Primitive[]): Map<Primitive, number> {
  const ranks = new Map<Primitive, number>();
  if (values.some((v) => typeof v === 'string')) {
    for (const v of values) if (!ranks.has(v)) ranks.set(v, ranks.size);
  }
  return ranks;
}

function compareX(a: Primitive, b: Primitive, ranks: Map<Primitive, number>): number {
  const ra = ranks.get(a);
  const rb = ranks.get(b);
  if (ra !== undefined && rb !== undefined) return ra - rb;
  const na = a instanceof Date ? a.getTime() : (a as number);
  const nb = b instanceof Date ? b.getTime() : (b as number);
  return na - nb;
}

interface Datum {
  label: string;
  x: Primitive;
  y: Primitive;
  datum: unknown;
}

/** Read `(label, x, y)` from every datum, in data order. */
function readData<T>(
  data: readonly T[],
  x: Accessor<T>,
  y: Accessor<T>,
  series: Accessor<T> | undefined,
): Datum[] {
  return data.map((datum) => ({
    label: series === undefined ? '' : String(valueOf(datum, series)),
    x: valueOf(datum, x),
    y: valueOf(datum, y),
    datum,
  }));
}

/**
 * Group `rows` by series label (in order of first appearance), sort each group
 * by x, and map to pixel positions with `px` and `py`.
 */
function groupSeries(
  rows: readonly Datum[],
  px: (v: Primitive) => number,
  py: (v: Primitive) => number,
): Rendered[] {
  const labels: string[] = [];
  const groups = new Map<string, Datum[]>();
  for (const row of rows) {
    let g = groups.get(row.label);
    if (!g) {
      g = [];
      groups.set(row.label, g);
      labels.push(row.label);
    }
    g.push(row);
  }
  const out: Rendered[] = [];
  for (const label of labels) {
    const g = groups.get(label) ?? [];
    const ranks = xRanks(g.map((r) => r.x));
    const sorted = [...g].sort((a, b) => compareX(a.x, b.x, ranks));
    const points = sorted.map((r) => ({ x: px(r.x), y: py(r.y) }));
    const drawn = points.filter((p) => valid(p.x) && valid(p.y));
    const first = sorted[0];
    out.push({ label, points, drawn, datum: first?.datum });
  }
  return out;
}

/** `M x,y L x,y …`, with a new `M` after every gap of invalid points. */
export function lineSegments(points: readonly Point[]): string {
  let d = '';
  let pen = false;
  for (const p of points) {
    if (!valid(p.x) || !valid(p.y)) {
      pen = false;
      continue;
    }
    d += `${pen ? ' L' : 'M'}${fmt(p.x)},${fmt(p.y)}`;
    pen = true;
  }
  return d;
}

/** Colour of each series: a plain string, or an accessor through a colour scale. */
function seriesColor<T>(
  data: readonly T[],
  value: string | Accessor<T> | undefined,
): { colorOf: (label: string, datum: unknown) => string; scale?: LabelColorScale } {
  if (value === undefined || typeof value === 'string') {
    const color = value ?? LIGHT_THEME.accent;
    return { colorOf: () => color };
  }
  const scale = labelColorScale(data.map((d) => String(valueOf(d, value))));
  return {
    colorOf: (label, datum) =>
      scale(datum === undefined ? label : String(valueOf(datum as T, value))),
    scale,
  };
}

/**
 * A connected line: one `<path class="d3s-line">` per series, in layer `line`.
 * When `stroke` is an accessor, the mark carries a `colorScale` property (a
 * `LabelColorScale` built from the stroke labels) so a legend can reuse it.
 */
export function line<T>(data: readonly T[], options: LineOptions<T>): Mark {
  const { x, y, series, strokeWidth } = options;
  const { colorOf, scale } = seriesColor(data, options.stroke);
  const rows = readData(data, x, y, series);
  const xs = rows.map((r) => r.x);
  const ys = rows.map((r) => r.y);
  const mark: Mark = {
    name: 'line',
    xValues: () => xs,
    yValues: () => ys,
    render(ctx: PlotContext): void {
      const rendered = groupSeries(
        rows,
        (v) => ctx.x.position(v),
        (v) => ctx.y.position(v),
      );
      const layer = ctx.layer('line');
      for (const s of rendered) {
        if (s.drawn.length === 0) continue;
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('class', 'd3s-line');
        path.setAttribute('d', lineSegments(s.points));
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', colorOf(s.label, s.datum));
        path.setAttribute('stroke-width', String(strokeWidth ?? 2));
        layer.appendChild(path);
      }
    },
  };
  if (scale) Object.assign(mark, { colorScale: scale });
  return mark;
}

/**
 * A filled area under the line, closed down to `baseline` (default 0, in data
 * units): one `<path class="d3s-line">` per series in layer `area`, with
 * `fill-opacity` (default 0.25) and no stroke. The baseline value is part of
 * `yValues()`, so the y domain includes it.
 */
export function area<T>(data: readonly T[], options: AreaOptions<T>): Mark {
  const { x, y, series, opacity, baseline = 0 } = options;
  const { colorOf } = seriesColor(data, options.fill);
  const fillOpacity = opacity ?? 0.25;
  const rows = readData(data, x, y, series);
  const xs = rows.map((r) => r.x);
  const ys: Primitive[] = rows.map((r) => r.y);
  if (valid(baseline)) ys.push(baseline);
  const mark: Mark = {
    name: 'area',
    xValues: () => xs,
    yValues: () => ys,
    render(ctx: PlotContext): void {
      const rendered = groupSeries(
        rows,
        (v) => ctx.x.position(v),
        (v) => ctx.y.position(v),
      );
      const layer = ctx.layer('area');
      const baseY = ctx.y.position(baseline);
      for (const s of rendered) {
        if (s.drawn.length === 0) continue;
        let d = lineSegments(s.points);
        const first = s.drawn[0];
        const last = s.drawn[s.drawn.length - 1];
        if (d !== '' && first && last && valid(baseY)) {
          d += ` L${fmt(last.x)},${fmt(baseY)} L${fmt(first.x)},${fmt(baseY)} Z`;
        }
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('class', 'd3s-line');
        path.setAttribute('d', d);
        path.setAttribute('fill', colorOf(s.label, s.datum));
        path.setAttribute('fill-opacity', String(fillOpacity));
        path.setAttribute('stroke', 'none');
        layer.appendChild(path);
      }
    },
  };
  return mark;
}
