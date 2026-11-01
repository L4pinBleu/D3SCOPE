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

function toNumber(v: number | Date): number {
  return v instanceof Date ? v.getTime() : v;
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
  return { nice: spec.nice ?? !fixed, clamp: false };
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
      ticks: () => categories,
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
      return d3.ticks(count);
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
