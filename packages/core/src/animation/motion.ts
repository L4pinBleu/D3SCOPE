/**
 * `motion` driver (`@d3scope/core/animation/motion`). `motion` is an optional
 * peer dependency: install it only if you import this subpath.
 */
import { animate } from 'motion';
import type { AnimateOptions, AnimationDriver } from './index.js';

/**
 * Convert frame objects `[{opacity: 0}, {opacity: 1}]` to motion's
 * per-property arrays `{opacity: [0, 1]}`.
 */
export function toMotionKeyframes(frames: Keyframe[]): Record<string, (string | number)[]> {
  const out: Record<string, (string | number)[]> = {};
  for (const frame of frames) {
    for (const [prop, value] of Object.entries(frame)) {
      if (prop === 'offset' || prop === 'easing' || prop === 'composite') continue;
      if (typeof value !== 'string' && typeof value !== 'number') continue;
      (out[prop] ??= []).push(value);
    }
  }
  return out;
}

export const motionDriver: AnimationDriver = {
  name: 'motion',
  async animate(el, keyframes, options: Required<AnimateOptions>) {
    // motion takes seconds; the public options use milliseconds.
    await animate(el, toMotionKeyframes(keyframes), {
      duration: options.duration / 1000,
      delay: options.delay / 1000,
      ease: toMotionEase(options.easing),
    });
  },
};

const EASE_NAMES: Record<string, 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'> = {
  linear: 'linear',
  'ease-in': 'easeIn',
  'ease-out': 'easeOut',
  'ease-in-out': 'easeInOut',
  ease: 'easeInOut',
};

/** Map CSS easing names to motion's. Unknown names fall back to `easeOut`. */
export function toMotionEase(easing: string): 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' {
  return EASE_NAMES[easing.trim()] ?? 'easeOut';
}
