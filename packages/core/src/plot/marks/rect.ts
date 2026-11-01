/**
 * Bar marks. `rectY` draws vertical bars from a baseline to each value (band
 * scale on x); `rectX` draws horizontal bars the other way (band scale on y).
 */
import { LIGHT_THEME } from '../../theme/index.js';
import { valueOf, valuesOf } from '../channel.js';
import type { Accessor } from '../channel.js';
import { labelColorScale, type LabelColorScale } from '../color.js';
import type { Mark, PlotContext, Primitive } from '../types.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Fraction of the band taken by a bar when no size is given. */
const BAND_FILL = 0.9;

/** Options of both bar marks; `width` is for `rectY`, `height` for `rectX`. */
interface RectOptions<T> {
  x: Accessor<T>;
  y: Accessor<T>;
  fill?: string | Accessor<T>;
  width?: number;
  height?: number;
  baseline?: number;
}

/** A bar mark, with its colour scale when `fill` is an accessor. */
export type BarMark = Mark & { readonly colorScale?: LabelColorScale };

/** Resolved fill: either one fixed colour, or a label → colour scale. */
interface ResolvedFill<T> {
  fixedColor: string | undefined;
  scale: LabelColorScale | undefined;
  labelOf: (d: T) => string;
}

/**
 * A string `fill` is ambiguous: a field name and a colour are both strings. It
 * is a field accessor when it is a key of some datum (so `fill: 'cat'` colours
 * per label, `fill: '#ff0000'` colours every bar), otherwise a fixed colour.
 */
function isDatumKey(fill: string, data: readonly unknown[]): boolean {
  return data.some((d) => typeof d === 'object' && d !== null && fill in d);
}

/** Build the fill resolver: one colour for all bars, or one per label. */
function resolveFill<T>(
  fill: string | Accessor<T> | undefined,
  data: readonly T[],
): ResolvedFill<T> {
  if (fill === undefined) {
    return { fixedColor: LIGHT_THEME.accent, scale: undefined, labelOf: () => '' };
  }
  if (typeof fill === 'function') {
    return {
      fixedColor: undefined,
      scale: labelColorScale([]),
      labelOf: (d: T) => String(valueOf(d, fill)),
    };
  }
  if (isDatumKey(fill, data)) {
    const key = fill;
    return {
      fixedColor: undefined,
      scale: labelColorScale([]),
      labelOf: (d: T) => String(valueOf(d, key as Accessor<T>)),
    };
  }
  return { fixedColor: fill, scale: undefined, labelOf: () => '' };
}

/** A value a bar can be drawn at: a finite number. */
function drawable(v: Primitive): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Append one bar rect to `layer`. */
function barRect(
  layer: SVGGElement,
  attrs: { x: number; y: number; width: number; height: number; fill: string },
): void {
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('class', 'd3s-bar');
  rect.setAttribute('x', String(attrs.x));
  rect.setAttribute('y', String(attrs.y));
  rect.setAttribute('width', String(attrs.width));
  rect.setAttribute('height', String(attrs.height));
  rect.setAttribute('fill', attrs.fill);
  layer.appendChild(rect);
}

/** Pre-register every fill label on the scale, so colours are stable. */
function primeScale<T>(resolved: ResolvedFill<T>, data: readonly T[]): void {
  if (!resolved.scale) return;
  for (const d of data) resolved.scale(resolved.labelOf(d));
}

/** Colour of one bar, given its datum. */
function colorOf<T>(resolved: ResolvedFill<T>, d: T): string {
  if (resolved.scale) return resolved.scale(resolved.labelOf(d));
  return resolved.fixedColor ?? LIGHT_THEME.accent;
}

/** The bar mark object; `colorScale` is set only for an accessor fill. */
function finishMark(mark: BarMark, scale: LabelColorScale | undefined): BarMark {
  if (scale) (mark as { colorScale?: LabelColorScale }).colorScale = scale;
  return mark;
}

/**
 * Vertical bars: one rect per datum, from `baseline` (default 0) to the y
 * value. The bar sits at the x position (the band start for a band scale on
 * x): 90% of the band wide, `width` px centred on the position when given.
 * NaN or non-finite values are skipped.
 */
export function rectY<T>(data: readonly T[], options: RectOptions<T>): BarMark {
  const baseline = options.baseline ?? 0;
  const resolved = resolveFill(options.fill, data);
  primeScale(resolved, data);
  return finishMark(
    {
      name: 'rect-y',
      xValues: () => valuesOf(data, options.x),
      yValues: () => {
        const out: Primitive[] = valuesOf(data, options.y);
        if (out.every((v) => !drawable(v) || v > baseline)) out.push(baseline);
        return out;
      },
      render(ctx: PlotContext): void {
        const layer = ctx.layer('rect-y');
        const basePos = ctx.y.position(baseline);
        if (!Number.isFinite(basePos)) return;
        for (const d of data) {
          const yv = valueOf(d, options.y);
          if (!drawable(yv)) continue;
          const xPos = ctx.x.position(valueOf(d, options.x));
          const yPos = ctx.y.position(yv);
          if (!Number.isFinite(xPos) || !Number.isFinite(yPos)) continue;
          let width: number;
          let x = xPos;
          if (options.width !== undefined) {
            width = options.width;
            x = xPos - width / 2;
          } else {
            width = ctx.x.kind === 'band' ? ctx.x.bandwidth() * BAND_FILL : 0;
          }
          barRect(layer, {
            x,
            y: Math.min(yPos, basePos),
            width,
            height: Math.abs(basePos - yPos),
            fill: colorOf(resolved, d),
          });
        }
      },
    },
    resolved.scale,
  );
}

/**
 * Horizontal bars: one rect per datum, from `baseline` (default 0) to the x
 * value. The bar sits at the y position (the band start for a band scale on
 * y): 90% of the band tall, `height` px centred on the position when given.
 * NaN or non-finite values are skipped.
 */
export function rectX<T>(data: readonly T[], options: RectOptions<T>): BarMark {
  const baseline = options.baseline ?? 0;
  const resolved = resolveFill(options.fill, data);
  primeScale(resolved, data);
  return finishMark(
    {
      name: 'rect-x',
      xValues: () => {
        const out: Primitive[] = valuesOf(data, options.x);
        if (out.every((v) => !drawable(v) || v > baseline)) out.push(baseline);
        return out;
      },
      yValues: () => valuesOf(data, options.y),
      render(ctx: PlotContext): void {
        const layer = ctx.layer('rect-x');
        const basePos = ctx.x.position(baseline);
        if (!Number.isFinite(basePos)) return;
        for (const d of data) {
          const xv = valueOf(d, options.x);
          if (!drawable(xv)) continue;
          const yPos = ctx.y.position(valueOf(d, options.y));
          const xPos = ctx.x.position(xv);
          if (!Number.isFinite(yPos) || !Number.isFinite(xPos)) continue;
          let height: number;
          let y = yPos;
          if (options.height !== undefined) {
            height = options.height;
            y = yPos - height / 2;
          } else {
            height = ctx.y.kind === 'band' ? ctx.y.bandwidth() * BAND_FILL : 0;
          }
          barRect(layer, {
            x: Math.min(xPos, basePos),
            y,
            width: Math.abs(basePos - xPos),
            height,
            fill: colorOf(resolved, d),
          });
        }
      },
    },
    resolved.scale,
  );
}
