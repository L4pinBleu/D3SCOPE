/**
 * Continuous legend: a colour gradient with tick labels, for a numeric range
 * (PLAN.md §3, `legends/`; the categorical legend lives in `index.ts`).
 *
 * `layoutContinuousLegend` is pure and unit-tested. `renderContinuousLegend`
 * draws the gradient (an SVG `linearGradient` inside the group), the bar and the
 * labels. Colours are `#rrggbb` hex strings and are interpolated per channel in
 * sRGB, which is enough for a legend.
 */
import { select } from 'd3-selection';
import { defaultTickFormat } from '../axes/index.js';
import type { LocaleName } from '../format/index.js';
import { linearScale } from '../scales/index.js';
import { cssVar, LIGHT_THEME } from '../theme/index.js';

export type ContinuousOrientation = 'horizontal' | 'vertical';

export interface ContinuousLegendOptions {
  /** Gradient colours from low to high, as `#rrggbb`. At least two. Default: white to the accent colour. */
  colors?: readonly string[];
  /** `horizontal` (default) or `vertical` (low at the bottom). */
  orientation?: ContinuousOrientation;
  /** Length of the bar in px. Default: 160. */
  length?: number;
  /** Thickness of the bar in px. Default: 12. */
  thickness?: number;
  /** Approximate number of labels. Default: 5. */
  tickCount?: number;
  /** Number of gradient stops. Default: 10. */
  stops?: number;
  /** Label font size in px. Default: 12. */
  fontSize?: number;
  /** Locale for the labels. Default: the library locale (`fr-FR`). */
  locale?: LocaleName | undefined;
}

export interface GradientStop {
  /** Position along the bar, from 0 (low) to 1 (high). */
  offset: number;
  color: string;
}

export interface ContinuousTick {
  value: number;
  /** Position along the bar, in px, from the low end. */
  position: number;
  label: string;
}

export interface ContinuousLegendLayout {
  orientation: ContinuousOrientation;
  length: number;
  thickness: number;
  stops: GradientStop[];
  ticks: ContinuousTick[];
  /** Domain covered by the bar. */
  domain: [number, number];
}

const DEFAULT_COLORS: readonly string[] = ['#ffffff', LIGHT_THEME.accent];

/** `#rrggbb` → [r, g, b]. Other formats throw. */
export function parseHexColor(hex: string): [number, number, number] {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m?.[1]) throw new RangeError(`parseHexColor: expected #rrggbb, got "${hex}"`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Colour at `t` (0 to 1) along a list of colours, interpolated per channel. */
export function interpolateColor(colors: readonly string[], t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  const segments = colors.length - 1;
  const scaled = clamped * segments;
  const i = Math.min(segments - 1, Math.floor(scaled));
  const local = scaled - i;
  const a = parseHexColor(colors[i] ?? '#000000');
  const b = parseHexColor(colors[i + 1] ?? '#000000');
  const channel = (k: 0 | 1 | 2): string => {
    const v = Math.round(a[k] + (b[k] - a[k]) * local);
    return v.toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

/** Compute the gradient and ticks for `domain`. Pure: no DOM access. */
export function layoutContinuousLegend(
  domain: readonly [number, number],
  options: ContinuousLegendOptions = {},
): ContinuousLegendLayout {
  const colors = options.colors ?? DEFAULT_COLORS;
  if (colors.length < 2) throw new RangeError('layoutContinuousLegend: at least two colours');
  colors.forEach((c) => {
    parseHexColor(c);
  });
  const [lo, hi] = domain;
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo > hi) {
    throw new RangeError('layoutContinuousLegend: domain must be finite and ordered (low, high)');
  }

  const orientation = options.orientation ?? 'horizontal';
  const length = options.length ?? 160;
  const thickness = options.thickness ?? 12;
  const stopCount = Math.max(2, options.stops ?? 10);
  const stops: GradientStop[] = Array.from({ length: stopCount }, (_, i) => {
    const offset = i / (stopCount - 1);
    return { offset, color: interpolateColor(colors, offset) };
  });

  // Ticks sit on a linear scale from 0 to `length`. A flat domain gets one tick at the middle.
  const scale = linearScale([lo, hi], [0, length], { nice: true });
  const tickCount = options.tickCount ?? 5;
  const values = lo === hi ? [lo] : scale.ticks(tickCount);
  const format = defaultTickFormat(scale, tickCount, options.locale);
  const ticks: ContinuousTick[] = values.map((value) => ({
    value,
    position: lo === hi ? length / 2 : scale(value),
    label: format ? format(value) : String(value),
  }));

  return { orientation, length, thickness, stops, ticks, domain: [lo, hi] };
}

let nextGradientId = 0;

/**
 * Draw the continuous legend into `group`. Redrawing replaces its contents; the
 * gradient gets a fresh id each time, so older gradients never clash.
 */
export function renderContinuousLegend(
  group: SVGGElement,
  domain: readonly [number, number],
  options: ContinuousLegendOptions = {},
): ContinuousLegendLayout {
  const layout = layoutContinuousLegend(domain, options);
  const fontSize = options.fontSize ?? 12;
  const horizontal = layout.orientation === 'horizontal';
  const id = `d3scope-legend-gradient-${String(nextGradientId++)}`;

  const root = select(group);
  root.selectAll('*').remove();

  const defs = root.append('defs');
  const gradient = defs
    .append('linearGradient')
    .attr('id', id)
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', horizontal ? '100%' : '0%')
    .attr('y2', horizontal ? '0%' : '100%');
  for (const stop of layout.stops) {
    gradient
      .append('stop')
      .attr('offset', `${String(Math.round(stop.offset * 100))}%`)
      .attr('stop-color', stop.color);
  }

  const bar = horizontal
    ? { x: 0, y: 0, width: layout.length, height: layout.thickness }
    : { x: 0, y: 0, width: layout.thickness, height: layout.length };
  root
    .append('rect')
    .attr('class', 'gradient')
    .attr('x', bar.x)
    .attr('y', bar.y)
    .attr('width', bar.width)
    .attr('height', bar.height)
    .attr('fill', `url(#${id})`);

  // Vertical legends read low at the bottom, so position 0 maps to the bottom edge.
  const at = (position: number): number => (horizontal ? position : layout.length - position);
  const labelGap = 4;
  const labelOffset = layout.thickness + labelGap;

  for (const tick of layout.ticks) {
    const p = at(tick.position);
    const x = horizontal ? p : labelOffset;
    const y = horizontal ? labelOffset : p;
    root
      .append('text')
      .attr('class', 'tick-label')
      .attr('x', x)
      .attr('y', y)
      .attr('font-size', fontSize)
      .attr('text-anchor', horizontal ? 'middle' : 'start')
      .attr('dominant-baseline', horizontal ? 'hanging' : 'central')
      .style('fill', cssVar('text', LIGHT_THEME.text))
      .text(tick.label);
  }
  return layout;
}
