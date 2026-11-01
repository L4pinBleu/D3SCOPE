// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fadeIn,
  getAnimationDriver,
  prefersReducedMotion,
  setAnimationDriver,
  webAnimationsDriver,
  type AnimationDriver,
} from '../src/animation/index';

function stubMatchMedia(reduce: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)' ? reduce : false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  setAnimationDriver(webAnimationsDriver);
});

describe('prefersReducedMotion', () => {
  it('reads the OS setting through matchMedia', () => {
    stubMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
    stubMatchMedia(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it('is false when matchMedia is missing', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('webAnimationsDriver', () => {
  it('resolves at once when element.animate is not available', async () => {
    const el = document.createElement('div');
    await expect(
      webAnimationsDriver.animate(el, [{ opacity: 0 }, { opacity: 1 }], {
        duration: 100,
        delay: 0,
        easing: 'linear',
      }),
    ).resolves.toBeUndefined();
  });

  it('calls element.animate with the options and waits for finished', async () => {
    const el = document.createElement('div');
    const animate = vi.fn(() => ({ finished: Promise.resolve() }));
    Object.defineProperty(el, 'animate', { value: animate });
    const frames = [{ opacity: 0 }, { opacity: 1 }];
    await webAnimationsDriver.animate(el, frames, { duration: 250, delay: 10, easing: 'ease-out' });
    expect(animate).toHaveBeenCalledWith(frames, {
      duration: 250,
      delay: 10,
      easing: 'ease-out',
      fill: 'none',
    });
  });
});

describe('fadeIn', () => {
  it('runs the current driver with fade keyframes and default timing', async () => {
    stubMatchMedia(false);
    const seen: { keyframes: Keyframe[]; duration: number; easing: string }[] = [];
    const driver: AnimationDriver = {
      name: 'spy',
      animate: (_el, keyframes, options) => {
        seen.push({ keyframes, duration: options.duration, easing: options.easing });
        return Promise.resolve();
      },
    };
    setAnimationDriver(driver);
    expect(getAnimationDriver()).toBe(driver);
    await fadeIn(document.createElement('div'));
    expect(seen).toHaveLength(1);
    expect(seen[0]?.duration).toBe(300);
    expect(seen[0]?.easing).toBe('ease-out');
    expect(seen[0]?.keyframes[0]).toEqual({ opacity: 0, transform: 'translateY(4px)' });
  });

  it('skips the animation under reduced motion', async () => {
    stubMatchMedia(true);
    const animate = vi.fn(() => Promise.resolve());
    setAnimationDriver({ name: 'spy', animate });
    await fadeIn(document.createElement('div'));
    expect(animate).not.toHaveBeenCalled();
  });

  it('passes custom duration, delay and easing through', async () => {
    stubMatchMedia(false);
    const animate = vi.fn<AnimationDriver['animate']>(() => Promise.resolve());
    setAnimationDriver({ name: 'spy', animate });
    await fadeIn(document.createElement('div'), { duration: 500, delay: 20, easing: 'linear' });
    expect(animate.mock.calls[0]?.[2]).toEqual({ duration: 500, delay: 20, easing: 'linear' });
  });
});
