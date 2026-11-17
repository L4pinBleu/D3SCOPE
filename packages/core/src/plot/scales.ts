/**
 * Domains and scales for the plot model. Pure functions, no DOM: they are the
 * part that is tested in detail.
 */
import {
  bandScale,
  linearScale,
  logScale,
  timeScale,
  type ContinuousScaleOptions,
} from '../scales/index.js';
import type { AxisSpec, Primitive, PlotScale, ScaleKind } from './types.js';
import { BUILTIN_SCALES, getScaleFactory } from '../plugin/extensions.js';

/** Upper bound on generated ticks, so a tiny `step` cannot freeze the page. */
const MAX_TICKS = 1000;

/** Infer the scale kind from the first value. Mixed kinds are an error. */
export function inferKind(values: readonly Primitive[]): ScaleKind {
  const first = values[0];
  if (first === undefined) return 'linear';
  let kind: ScaleKind;
  if (first instanceof Date) kind = 'time';
  else if (typeof first === 'number') kind = 'linear';
  else kind = 'band';
  for (const v of values) {
    const k = v instanceof Date ? 'time' : typeof v === 'number' ? 'linear' : 'band';
    if (k !== kind) throw new TypeError('plot: an axis cannot mix numbers, dates and text');
  }
  return kind;
}

/**
 * Domain of a continuous axis: `min`/`max` from the spec, else the extent of the
 * values. With no values and no bounds, the domain is `[0, 1]`.
 */
export function continuousDomain(
  values: readonly Primitive[],
  spec: AxisSpec,
): [number, number] | [Date, Date] {
  const isTime = spec.type === 'time' || values.some((v) => v instanceof Date);
  const nums = values.map((v) => (v instanceof Date ? v.getTime() : Number(v)));
  const lo0 = nums.length > 0 ? Math.min(...nums) : 0;
  const hi0 = nums.length > 0 ? Math.max(...nums) : 1;
  const lo = spec.min !== undefined ? toNumber(spec.min) : lo0;
  const hi = spec.max !== undefined ? toNumber(spec.max) : hi0;
  if (hi < lo) throw new RangeError(`plot: max (${String(hi)}) is below min (${String(lo)})`);
  if (lo === hi) {
    // A flat series still needs a visible span.
    const pad = lo === 0 ? 1 : Math.abs(lo) * 0.1;
    return isTime ? [new Date(lo - pad), new Date(hi + pad)] : [lo - pad, hi + pad];
  }
  return isTime ? [new Date(lo), new Date(hi)] : [lo, hi];
}

/**
 * A bound or value as a number: dates become timestamps, and strings are read
 * as ISO dates first (time axes), then as plain numbers.
 */
function toNumber(v: number | Date | string): number {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isNaN(t) ? Number(v) : t;
  }
  return v;
}

/**
 * Ticks every `step`, inside `[lo, hi]`. Values are rounded to the decimals of
 * the step, so `0.1` does not produce `0.30000000000000004`.
 */
export function stepTicks(domain: readonly [number, number], step: number): number[] {
  if (!(step > 0) || !Number.isFinite(step)) {
    throw new RangeError('plot: step must be a positive number');
  }
  const lo = Math.min(domain[0], domain[1]);
  const hi = Math.max(domain[0], domain[1]);
  const decimals = decimalsOf(step);
  const first = Math.ceil(lo / step - 1e-9);
  const last = Math.floor(hi / step + 1e-9);
  if (last - first + 1 > MAX_TICKS) {
    throw new RangeError(`plot: step ${String(step)} gives more than ${String(MAX_TICKS)} ticks`);
  }
  const out: number[] = [];
  for (let k = first; k <= last; k++) {
    out.push(Number((k * step).toFixed(decimals)));
  }
  return out;
}

function decimalsOf(step: number): number {
  const text = String(step);
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

/** Tick values of a scale, honouring `step` and `ticks`. */
export function tickValues(scale: PlotScale, spec: AxisSpec): Primitive[] {
  return scale.ticks(spec.ticks ?? 5);
}

/** Options given to the d3 scale for a continuous axis. */
function continuousOptions(spec: AxisSpec): ContinuousScaleOptions {
  const fixed = spec.min !== undefined || spec.max !== undefined;
  const opts: ContinuousScaleOptions = { nice: spec.nice ?? !fixed, clamp: false };
  if (spec.base !== undefined) opts.base = spec.base;
  return opts;
}

/**
 * Build the scale for an axis whose `type` is a built-in kind or the name of a
 * scale a plugin registered (Plugin API 1.1). Throws `RangeError` for a name
 * that is neither.
 */
export function createAxisScale(
  kind: string,
  values: readonly Primitive[],
  range: readonly [number, number],
  spec: AxisSpec,
): PlotScale {
  if (BUILTIN_SCALES.includes(kind)) {
    return createPlotScale(kind as ScaleKind, values, range, spec);
  }
  const factory = getScaleFactory(kind);
  if (!factory) throw new RangeError(`plot: unknown scale type "${kind}"`);
  return factory(values, range, spec);
}

/**
 * Build a scale for an axis. `range` is the pixel range before any reversal;
 * `reverse` swaps its ends.
 */
export function createPlotScale(
  kind: ScaleKind,
  values: readonly Primitive[],
  range: readonly [number, number],
  spec: AxisSpec,
): PlotScale {
  const r: [number, number] = spec.reverse ? [range[1], range[0]] : [range[0], range[1]];
  if (kind === 'band') {
    const categories = spec.domain ? [...spec.domain] : uniqueStrings(values);
    const scale = bandScale(categories, r, { padding: 0.1, align: 0.5 });
    return {
      kind,
      d3: scale,
      position: (v) => scale(String(v)) ?? Number.NaN,
      bandwidth: () => scale.bandwidth(),
      ticks: () => {
        if (spec.step !== undefined) {
          throw new RangeError('plot: step is only supported on linear axes');
        }
        return categories;
      },
      domain: categories,
      range: r,
    };
  }

  const domain = continuousDomain(values, { ...spec, type: kind });
  const opts = continuousOptions(spec);
  if (kind === 'time') {
    const scale = timeScale([domain[0] as Date, domain[1] as Date], r, opts);
    return continuousScale(kind, scale, spec, [domain[0], domain[1]], r);
  }
  if (kind === 'log') {
    const scale = logScale([domain[0] as number, domain[1] as number], r, opts);
    return continuousScale(kind, scale, spec, [domain[0], domain[1]], r);
  }
  const scale = linearScale([domain[0] as number, domain[1] as number], r, opts);
  return continuousScale(kind, scale, spec, [domain[0], domain[1]], r);
}

interface D3Continuous {
  (v: number | Date): number;
  domain(): (number | Date)[];
  ticks(count?: number): (number | Date)[];
}

function continuousScale(
  kind: ScaleKind,
  scale: unknown,
  spec: AxisSpec,
  domain: readonly [number | Date, number | Date],
  range: readonly [number, number],
): PlotScale {
  const d3 = scale as D3Continuous;
  const toScalar = (v: Primitive): number | Date => (typeof v === 'string' ? Number(v) : v);
  return {
    kind,
    d3: scale,
    position: (v) => d3(toScalar(v)),
    bandwidth: () => 0,
    ticks: (count) => {
      if (spec.step !== undefined) {
        if (kind !== 'linear') {
          throw new RangeError('plot: step is only supported on linear axes');
        }
        return stepTicks([Number(domain[0]), Number(domain[1])], spec.step);
      }
      const values = d3.ticks(count);
      if (kind === 'log') {
        // Log axes: decade ticks by default; multiples inside each decade only with minorTicks.
        const base = spec.base ?? 10;
        const decades = logDecadeTicks(domain as [number, number], base);
        return spec.minorTicks === true
          ? logMinorTicks(domain as [number, number], decades, base)
          : decades;
      }
      return values;
    },
    domain: d3.domain(),
    range,
  };
}

function uniqueStrings(values: readonly Primitive[]): string[] {
  const seen = new Set<string>();
  for (const v of values) seen.add(String(v));
  return [...seen];
}

/**
 * Decade ticks of a log axis: base^e for each whole exponent e whose value lies
 * inside the domain.
 */
export function logDecadeTicks(domain: readonly [number, number], base: number): number[] {
  const lo = Math.min(domain[0], domain[1]);
  const hi = Math.max(domain[0], domain[1]);
  if (!(lo > 0) || !(hi > 0)) return [];
  const logBase = Math.log(base);
  const e0 = Math.floor(Math.log(lo) / logBase - 1e-9);
  const e1 = Math.ceil(Math.log(hi) / logBase + 1e-9);
  const out: number[] = [];
  for (let e = e0; e <= e1; e++) {
    const v = Number(Math.pow(base, e).toPrecision(12));
    if (v >= lo && v <= hi) out.push(v);
  }
  return out;
}

/**
 * Minor ticks of a log axis: the multiples of the base inside each decade of
 * the domain, merged with the decade ticks and sorted.
 */
export function logMinorTicks(
  domain: readonly [number, number],
  ticks: readonly number[],
  base: number,
): number[] {
  const lo = Math.min(domain[0], domain[1]);
  const hi = Math.max(domain[0], domain[1]);
  const logBase = Math.log(base);
  const e0 = Math.floor(Math.log(lo) / logBase + 1e-9);
  const e1 = Math.ceil(Math.log(hi) / logBase - 1e-9);
  const out = new Set<number>(ticks);
  for (let e = e0; e <= e1; e++) {
    for (let m = 2; m < base; m++) {
      const v = Number((Math.pow(base, e) * m).toPrecision(12));
      if (v > lo && v < hi) out.add(v);
    }
  }
  return [...out].sort((a, b) => a - b);
}
