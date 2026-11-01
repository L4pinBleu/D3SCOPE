/**
 * Scales: thin wrappers over `d3-scale` with D3SCOPE defaults (PLAN.md §3).
 *
 * Defaults: `nice` on for continuous scales, so axes end on round values;
 * `clamp` off, so out-of-domain values extrapolate (set it in options to clamp).
 */
import {
  scaleBand,
  scaleLinear,
  scaleLog,
  scaleTime,
  type ScaleBand,
  type ScaleLinear,
  type ScaleLogarithmic,
  type ScaleTime,
} from 'd3-scale';

export type NumericDomain = readonly [number, number];
export type TimeDomain = readonly [Date, Date];
export type Range = readonly [number, number];

export interface ContinuousScaleOptions {
  /** Round the domain to readable values. Default `true`. */
  nice?: boolean | number;
  /** Clamp outputs to the range. Default `false`. */
  clamp?: boolean;
}

export interface BandScaleOptions {
  /** Space between bands, from 0 to 1. Default `0.1`. */
  padding?: number;
  /** Align bands within the range, from 0 to 1. Default `0.5`. */
  align?: number;
}

/** Linear scale, e.g. values on the y axis. */
export function linearScale(
  domain: NumericDomain,
  range: Range,
  options: ContinuousScaleOptions = {},
): ScaleLinear<number, number> {
  const scale = scaleLinear()
    .domain([...domain])
    .range([...range]);
  applyContinuous(scale, options);
  return scale;
}

/** Logarithmic scale. The domain must be strictly positive. */
export function logScale(
  domain: NumericDomain,
  range: Range,
  options: ContinuousScaleOptions = {},
): ScaleLogarithmic<number, number> {
  if (domain[0] <= 0 || domain[1] <= 0) {
    throw new RangeError('logScale: domain must be strictly positive');
  }
  const scale = scaleLog()
    .domain([...domain])
    .range([...range]);
  applyContinuous(scale, options);
  return scale;
}

/** Time scale, e.g. the x axis of a price history. */
export function timeScale(
  domain: TimeDomain,
  range: Range,
  options: ContinuousScaleOptions = {},
): ScaleTime<number, number> {
  const scale = scaleTime()
    .domain([...domain])
    .range([...range]);
  applyContinuous(scale, options);
  return scale;
}

/** Band scale for categories, e.g. the bars of a bar chart. */
export function bandScale(
  categories: readonly string[],
  range: Range,
  options: BandScaleOptions = {},
): ScaleBand<string> {
  return scaleBand()
    .domain([...categories])
    .range([...range])
    .padding(options.padding ?? 0.1)
    .align(options.align ?? 0.5);
}

function applyContinuous<S extends { nice(count?: number): S; clamp(v: boolean): S }>(
  scale: S,
  options: ContinuousScaleOptions,
): void {
  const { nice = true, clamp = false } = options;
  if (nice === true) {
    scale.nice();
  } else if (typeof nice === 'number') {
    scale.nice(nice);
  }
  scale.clamp(clamp);
}
