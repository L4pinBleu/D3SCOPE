/**
 * Timing shared by the plot animations (zoom, first display): `d3-ease` easings
 * and the duration bounds.
 */
import { easeCubicOut, easeElasticOut, easeLinear } from 'd3-ease';
import { prefersReducedMotion } from '../animation/index.js';
import type { ZoomAnimation, ZoomEasing } from './types.js';

/** Default duration of an animation, in milliseconds. */
export const DEFAULT_DURATION = 400;
/** Longest animation, in milliseconds. */
export const MAX_DURATION = 5000;

export const EASINGS: Readonly<Record<ZoomEasing, (t: number) => number>> = {
  linear: easeLinear,
  'cubic-out': easeCubicOut,
  'elastic-out': easeElasticOut,
};

/** Duration and easing of an animation. */
export interface Timing {
  readonly duration: number;
  readonly ease: (t: number) => number;
}

/**
 * The timing of `spec`, or `undefined` when nothing is to be animated: no spec (unless
 * `force`), the spec turned off, a zero duration, or a user who prefers reduced motion.
 */
export function timingOf(spec: ZoomAnimation | undefined, force?: boolean): Timing | undefined {
  const wanted = force ?? (spec !== undefined && spec.isEnabled !== false);
  if (!wanted || prefersReducedMotion()) return undefined;
  const duration = Math.min(MAX_DURATION, Math.max(0, spec?.duration ?? DEFAULT_DURATION));
  if (!(duration > 0)) return undefined;
  return { duration, ease: EASINGS[spec?.easing ?? 'cubic-out'] };
}
