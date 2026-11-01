/**
 * Animation driver (PLAN.md §6). The core defines the interface and a default
 * driver built on the Web Animations API, which needs no dependency. The
 * `motion` driver ships as `@d3scope/core/animation/motion`.
 *
 * Every helper here skips the animation when the user prefers reduced motion.
 */

export interface AnimateOptions {
  /** Duration in milliseconds. Default 300. */
  duration?: number;
  /** Delay in milliseconds. Default 0. */
  delay?: number;
  /** CSS easing, e.g. `ease-out`. Default `ease-out`. */
  easing?: string;
}

export interface AnimationDriver {
  /** Name, for diagnostics. */
  readonly name: string;
  /**
   * Animate `el` through `keyframes` (CSS property → value, one object per frame).
   * Resolves when the animation has finished.
   */
  animate(el: Element, keyframes: Keyframe[], options: Required<AnimateOptions>): Promise<void>;
}

/** Whether the user asked for less motion (OS setting). False when `matchMedia` is missing. */
export function prefersReducedMotion(): boolean {
  if (typeof matchMedia !== 'function') return false;
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Default driver: the browser's Web Animations API. Resolves at once when it is missing. */
export const webAnimationsDriver: AnimationDriver = {
  name: 'web-animations',
  animate(el, keyframes, options) {
    if (typeof el.animate !== 'function') return Promise.resolve();
    const animation = el.animate(keyframes, {
      duration: options.duration,
      delay: options.delay,
      easing: options.easing,
      fill: 'none',
    });
    return animation.finished.then(() => undefined);
  },
};

let current: AnimationDriver = webAnimationsDriver;

/** The driver used by the helpers. */
export function getAnimationDriver(): AnimationDriver {
  return current;
}

/** Replace the driver, e.g. with the `motion` driver. */
export function setAnimationDriver(driver: AnimationDriver): void {
  current = driver;
}

/**
 * Fade an element in and move it up 4 px. Skipped (resolves at once) when the
 * user prefers reduced motion.
 */
export async function fadeIn(el: Element, options: AnimateOptions = {}): Promise<void> {
  if (prefersReducedMotion()) return;
  await current.animate(
    el,
    [
      { opacity: 0, transform: 'translateY(4px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ],
    {
      duration: options.duration ?? 300,
      delay: options.delay ?? 0,
      easing: options.easing ?? 'ease-out',
    },
  );
}
