/**
 * Polar charts (ADR 0002 step 8): the radar and the polar area chart.
 *
 * These charts use their own coordinate system, centred in the SVG, so they are
 * standalone modules and not plot marks. Angles start at 12 o'clock and run
 * clockwise, as in d3-shape's `pie`. The geometry lives in the pure exported
 * helpers (`polarPoint`, `sectorPath`, `polygonPoints`, `niceMax`) so it can be
 * tested without a DOM; the renderers only draw.
 */
import { createColorScale } from './color.js';
import type { ColorSpec } from './types.js';
import { cssVar, LIGHT_THEME } from '../theme/index.js';
import { renderCategoricalLegend, type LegendItem } from '../legends/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const TAU = Math.PI * 2;

/** A point in SVG user space. */
export interface PolarPoint {
  x: number;
  y: number;
}

/**
 * Pixel position of a point at `radius` from the centre, at `angleRad`
 * measured from 12 o'clock, clockwise (positive angles go right).
 * Pure: no DOM access.
 */
export function polarPoint(cx: number, cy: number, radius: number, angleRad: number): PolarPoint {
  return { x: cx + radius * Math.sin(angleRad), y: cy - radius * Math.cos(angleRad) };
}

/** An SVG polygon `points` attribute value from a list of points. Pure. */
export function polygonPoints(points: readonly PolarPoint[]): string {
  return points.map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(' ');
}

/**
 * SVG path for one circular sector, from the centre to `radius`, spanning
 * `[startAngle, endAngle]` (from 12 o'clock, clockwise). Empty for a zero
 * span. Pure.
 */
export function sectorPath(
  cx: number,
  cy: number,
  startAngle: number,
  endAngle: number,
  radius: number,
): string {
  const span = endAngle - startAngle;
  if (span <= 0 || radius <= 0) return '';
  const from = polarPoint(cx, cy, radius, startAngle);
  const to = polarPoint(cx, cy, radius, endAngle);
  const large = span > Math.PI ? 1 : 0;
  return [
    `M${fmt(cx)},${fmt(cy)}`,
    `L${fmt(from.x)},${fmt(from.y)}`,
    `A${fmt(radius)},${fmt(radius)} 0 ${String(large)} 1 ${fmt(to.x)},${fmt(to.y)}`,
    'Z',
  ].join(' ');
}

/**
 * Round `value` up to a "nice" number: a small integer (1, 2, 5) times a power
 * of ten. Used so the radar and polar radius ends on a round value. Pure.
 */
export function niceMax(value: number): number {
  if (!(value > 0) || !Number.isFinite(value)) return 1;
  const exponent = Math.floor(Math.log10(value));
  const base = Math.pow(10, exponent);
  const normalized = value / base;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * base;
}

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function make<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string>,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  return el;
}

/**
 * Set up `svg` for one of the polar charts: replace the previous content, set
 * the size, and return the single root group.
 */
function chartRoot(
  svg: SVGSVGElement,
  width: number,
  height: number,
  className: string,
): SVGGElement {
  svg.replaceChildren();
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  const root = make('g', { class: className });
  svg.appendChild(root);
  return root;
}

// ---------------------------------------------------------------------------
// Radar
// ---------------------------------------------------------------------------

export interface RadarSeries {
  name: string;
  /** One value per axis, in the same order as `axes`. */
  values: number[];
}

export interface RadarSpec {
  width: number;
  height: number;
  /** Axis (category) names, in order, at least 3. Drawn clockwise from the top. */
  axes: string[];
  /** One series per polygon; one value per axis. */
  series: RadarSeries[];
  /** Value at the outer ring. Default: the largest value, rounded to a nice number. */
  max?: number;
  /** Concentric grid polygons. Default: 4. */
  levels?: number;
  /** Colour categories and legend. */
  color?: ColorSpec;
  /** Polygon fill opacity, from 0 to 1. Default: 0.2. */
  fill?: number;
  /** Stroke width in pixels. Default: 2. */
  stroke?: number;
  /** Draw the axis labels. Default: `true`. */
  labels?: boolean;
  /** Locale for numbers. Default: the library locale. */
  locale?: 'fr-FR' | 'en-US';
}

/** Compute the radar geometry. Pure: no DOM access. */
export function layoutRadar(spec: RadarSpec): {
  cx: number;
  cy: number;
  radius: number;
  max: number;
  levels: number;
} {
  const cx = spec.width / 2;
  const cy = spec.height / 2;
  const radius = Math.max(0, Math.min(spec.width, spec.height) / 2 - 24);
  const largest = Math.max(...spec.series.flatMap((s) => s.values.filter(Number.isFinite)), 0);
  const max = spec.max ?? niceMax(largest);
  return { cx, cy, radius, max, levels: spec.levels ?? 4 };
}

/**
 * Draw the radar chart into `svg`. Replaces the previous content, so it is
 * safe to call again on every data update.
 */
export function radarChart(svg: SVGSVGElement, spec: RadarSpec): void {
  if (!(spec.width > 0) || !(spec.height > 0)) {
    throw new RangeError('radarChart: width and height must be positive');
  }
  if (spec.axes.length < 3) {
    throw new RangeError(`radarChart: at least 3 axes are needed, got ${String(spec.axes.length)}`);
  }
  for (const series of spec.series) {
    if (series.values.length !== spec.axes.length) {
      throw new RangeError(
        `radarChart: series "${series.name}" has ${String(series.values.length)} values ` +
          `but there are ${String(spec.axes.length)} axes`,
      );
    }
  }
  const { cx, cy, radius, max, levels } = layoutRadar(spec);
  const color = createColorScale(
    spec.series.map((s) => s.name),
    spec.color,
  );
  const labelColor = cssVar('textMuted', LIGHT_THEME.textMuted);
  const gridColor = cssVar('grid', LIGHT_THEME.grid);
  const strokeWidth = Math.max(0, spec.stroke ?? 2);
  const fillOpacity = Math.min(1, Math.max(0, spec.fill ?? 0.2));

  const root = chartRoot(svg, spec.width, spec.height, 'd3s-radar');

  // Grid: `levels` concentric polygons plus one spoke per axis.
  for (let level = 1; level <= levels; level++) {
    const r = (radius * level) / levels;
    const points = polygonPoints(
      spec.axes.map((_, i) => polarPoint(cx, cy, r, (i * TAU) / spec.axes.length)),
    );
    root.appendChild(
      make('polygon', { class: 'd3s-radar-grid', points, fill: 'none', stroke: gridColor }),
    );
  }
  for (let i = 0; i < spec.axes.length; i++) {
    const tip = polarPoint(cx, cy, radius, (i * TAU) / spec.axes.length);
    root.appendChild(
      make('line', {
        class: 'd3s-radar-axis',
        x1: fmt(cx),
        y1: fmt(cy),
        x2: fmt(tip.x),
        y2: fmt(tip.y),
        stroke: gridColor,
      }),
    );
  }

  // Axis labels, pushed just outside the outer ring.
  if (spec.labels !== false) {
    for (let i = 0; i < spec.axes.length; i++) {
      const angle = (i * TAU) / spec.axes.length;
      const at = polarPoint(cx, cy, radius * 1.12, angle);
      const anchor =
        Math.abs(Math.sin(angle)) < 1e-9 ? 'middle' : Math.sin(angle) > 0 ? 'start' : 'end';
      const label = make('text', {
        class: 'd3s-radar-label',
        x: fmt(at.x),
        y: fmt(at.y),
        'text-anchor': anchor,
        'dominant-baseline': 'central',
        'font-size': '12',
        fill: labelColor,
      });
      label.textContent = spec.axes[i] ?? '';
      root.appendChild(label);
    }
  }

  // One polygon per series. Values above `max` are clamped for drawing only;
  // missing (non-finite) values count as 0 and are reported in `data-missing`.
  for (const series of spec.series) {
    let missing = 0;
    const points: PolarPoint[] = [];
    for (let i = 0; i < spec.axes.length; i++) {
      const value = series.values[i];
      if (typeof value !== 'number' || !Number.isFinite(value)) missing++;
      const clamped = Math.min(
        max,
        Math.max(0, typeof value === 'number' && Number.isFinite(value) ? value : 0),
      );
      const r = max > 0 ? (radius * clamped) / max : 0;
      points.push(polarPoint(cx, cy, r, (i * TAU) / spec.axes.length));
    }
    const polygon = make('polygon', {
      class: 'd3s-radar-series',
      points: polygonPoints(points),
      fill: color(series.name),
      'fill-opacity': fmt(fillOpacity),
      stroke: color(series.name),
      'stroke-width': String(strokeWidth),
    });
    if (missing > 0) polygon.setAttribute('data-missing', String(missing));
    root.appendChild(polygon);
  }

  // Legend above the chart, top-left, when asked for.
  if (spec.color?.legend === true && spec.series.length > 0) {
    const items: LegendItem[] = spec.series.map((s) => ({
      label: s.name,
      color: color(s.name),
    }));
    const group = make('g', { class: 'd3s-legend' });
    root.appendChild(group);
    renderCategoricalLegend(group, items, { orientation: 'horizontal' });
    group.setAttribute('transform', `translate(${String(8)},${String(8)})`);
  }
}

// ---------------------------------------------------------------------------
// Polar area
// ---------------------------------------------------------------------------

export interface PolarAreaDatum {
  label: string;
  /** Must be a finite number >= 0. Zero draws nothing. */
  value: number;
}

export interface PolarAreaSpec {
  width: number;
  height: number;
  /** One equal-angle sector per datum. */
  data: PolarAreaDatum[];
  /** Value at the outer ring. Default: the largest value, rounded to a nice number. */
  max?: number;
  /** Colour categories and legend. */
  color?: ColorSpec;
  /** Draw the sector labels. Default: `true`. */
  labels?: boolean;
  /** Locale for numbers. Default: the library locale. */
  locale?: 'fr-FR' | 'en-US';
}

/** Compute the polar area geometry. Pure: no DOM access. */
export function layoutPolarArea(spec: PolarAreaSpec): {
  cx: number;
  cy: number;
  radius: number;
  max: number;
} {
  const cx = spec.width / 2;
  const cy = spec.height / 2;
  const outerRadius = Math.max(0, Math.min(spec.width, spec.height) / 2 - 12);
  const largest = Math.max(...spec.data.map((d) => d.value).filter(Number.isFinite), 0);
  const max = spec.max ?? niceMax(largest);
  return { cx, cy, radius: outerRadius, max };
}

/**
 * Draw the polar area chart into `svg`. Replaces the previous content, so it
 * is safe to call again on every data update. The radius of each sector grows
 * with the square root of its value over `max`, so the AREA is proportional
 * to the value.
 */
export function polarArea(svg: SVGSVGElement, spec: PolarAreaSpec): void {
  if (!(spec.width > 0) || !(spec.height > 0)) {
    throw new RangeError('polarArea: width and height must be positive');
  }
  for (const datum of spec.data) {
    if (!(datum.value >= 0) || !Number.isFinite(datum.value)) {
      throw new RangeError(
        `polarArea: value for "${datum.label}" must be a finite number >= 0, got ${String(datum.value)}`,
      );
    }
  }
  const { cx, cy, radius, max } = layoutPolarArea(spec);
  const color = createColorScale(
    spec.data.map((d) => d.label),
    spec.color,
  );
  const labelColor = cssVar('textMuted', LIGHT_THEME.textMuted);
  const sectorAngle = spec.data.length > 0 ? TAU / spec.data.length : 0;

  const root = chartRoot(svg, spec.width, spec.height, 'd3s-polar-area');

  for (let i = 0; i < spec.data.length; i++) {
    const datum = spec.data[i];
    if (datum === undefined || datum.value <= 0) continue;
    const start = i * sectorAngle;
    const r = max > 0 ? radius * Math.sqrt(Math.min(1, datum.value / max)) : 0;
    if (r <= 0) continue;
    root.appendChild(
      make('path', {
        class: 'd3s-polar-sector',
        d: sectorPath(cx, cy, start, start + sectorAngle, r),
        fill: color(datum.label),
      }),
    );
    if (spec.labels !== false) {
      const at = polarPoint(cx, cy, r * 1.1, start + sectorAngle / 2);
      const anchor =
        Math.abs(Math.sin(start + sectorAngle / 2)) < 1e-9
          ? 'middle'
          : Math.sin(start + sectorAngle / 2) > 0
            ? 'start'
            : 'end';
      const label = make('text', {
        class: 'd3s-polar-label',
        x: fmt(at.x),
        y: fmt(at.y),
        'text-anchor': anchor,
        'dominant-baseline': 'central',
        'font-size': '12',
        fill: labelColor,
      });
      label.textContent = datum.label;
      root.appendChild(label);
    }
  }

  if (spec.color?.legend === true && spec.data.length > 0) {
    const items: LegendItem[] = spec.data.map((d) => ({
      label: d.label,
      color: color(d.label),
    }));
    const group = make('g', { class: 'd3s-legend' });
    root.appendChild(group);
    renderCategoricalLegend(group, items, { orientation: 'horizontal' });
    group.setAttribute('transform', `translate(${String(8)},${String(8)})`);
  }
}
