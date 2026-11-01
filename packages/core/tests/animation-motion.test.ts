// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const animateMock = vi.fn<(...args: unknown[]) => { then: (r: () => void) => Promise<void> }>(
  () => ({
    then: (r: () => void) => Promise.resolve().then(r),
  }),
);
vi.mock('motion', () => ({ animate: (...args: unknown[]) => animateMock(...args) }));

import { motionDriver, toMotionEase, toMotionKeyframes } from '../src/animation/motion';

beforeEach(() => {
  animateMock.mockClear();
});

describe('toMotionKeyframes', () => {
  it('turns frame objects into per-property arrays', () => {
    expect(
      toMotionKeyframes([
        { opacity: 0, transform: 'translateY(4px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ]),
    ).toEqual({ opacity: [0, 1], transform: ['translateY(4px)', 'translateY(0)'] });
  });

  it('skips offset, easing and composite keys', () => {
    expect(toMotionKeyframes([{ opacity: 0, offset: 0, easing: 'linear' }])).toEqual({
      opacity: [0],
    });
  });

  it('ignores non-string, non-number values', () => {
    expect(toMotionKeyframes([{ opacity: 0, other: null }])).toEqual({
      opacity: [0],
    });
  });
});

describe('toMotionEase', () => {
  it('maps CSS easing names and falls back to easeOut', () => {
    expect(toMotionEase('ease-in')).toBe('easeIn');
    expect(toMotionEase('ease-in-out')).toBe('easeInOut');
    expect(toMotionEase(' linear ')).toBe('linear');
    expect(toMotionEase('cubic-bezier(0.1,0.2,0.3,0.4)')).toBe('easeOut');
  });
});

describe('motionDriver', () => {
  it('calls motion with seconds and mapped easing, then resolves', async () => {
    await motionDriver.animate(document.createElement('div'), [{ opacity: 0 }, { opacity: 1 }], {
      duration: 300,
      delay: 50,
      easing: 'ease-out',
    });
    expect(animateMock).toHaveBeenCalledTimes(1);
    const [, keyframes, options] = animateMock.mock.calls[0] as unknown as [
      Element,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(keyframes).toEqual({ opacity: [0, 1] });
    expect(options).toEqual({ duration: 0.3, delay: 0.05, ease: 'easeOut' });
  });

  it('has the name motion', () => {
    expect(motionDriver.name).toBe('motion');
  });
});
