import { describe, expect, it } from 'vitest';
import { bandScale, linearScale, logScale, timeScale } from '../src/scales/index.js';

describe('linearScale', () => {
  it('maps the domain onto the range', () => {
    const s = linearScale([0, 10], [0, 100], { nice: false });
    expect(s(5)).toBe(50);
    expect(s.domain()).toEqual([0, 10]);
  });

  it('rounds the domain by default (nice)', () => {
    const s = linearScale([0.3, 9.7], [0, 100]);
    expect(s.domain()).toEqual([0, 10]);
  });

  it('accepts a tick count for nice', () => {
    const s = linearScale([0.3, 9.7], [0, 100], { nice: 4 });
    expect(s.domain()[0]).toBeLessThanOrEqual(0.3);
    expect(s.domain()[1]).toBeGreaterThanOrEqual(9.7);
  });

  it('extrapolates by default and clamps when asked', () => {
    expect(linearScale([0, 10], [0, 100], { nice: false })(20)).toBe(200);
    expect(linearScale([0, 10], [0, 100], { nice: false, clamp: true })(20)).toBe(100);
  });
});

describe('logScale', () => {
  it('maps a positive domain logarithmically', () => {
    const s = logScale([1, 100], [0, 200], { nice: false });
    expect(s(10)).toBeCloseTo(100);
  });

  it('rejects non-positive domains', () => {
    expect(() => logScale([0, 10], [0, 1])).toThrow(RangeError);
    expect(() => logScale([-1, 10], [0, 1])).toThrow(RangeError);
  });
});

describe('timeScale', () => {
  it('maps dates onto the range', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2026-01-11T00:00:00Z');
    const s = timeScale([start, end], [0, 100], { nice: false });
    expect(s(new Date('2026-01-06T00:00:00Z'))).toBeCloseTo(50);
  });

  it('nices the domain to whole days by default', () => {
    const s = timeScale(
      [new Date('2026-01-01T06:00:00Z'), new Date('2026-01-10T18:00:00Z')],
      [0, 100],
    );
    expect(s.domain()[0]?.getHours()).toBe(0);
  });
});

describe('bandScale', () => {
  it('creates one band per category with the default padding', () => {
    const s = bandScale(['a', 'b', 'c'], [0, 300]);
    expect(s('a')).toBeDefined();
    // step = range / (n - padding + 2 * padding) = 300 / 3.1; bandwidth = step * (1 - padding)
    expect(s.bandwidth()).toBeCloseTo((300 / 3.1) * 0.9, 5);
  });

  it('honours custom padding and alignment', () => {
    const s = bandScale(['a', 'b'], [0, 100], { padding: 0, align: 0 });
    expect(s('a')).toBe(0);
    expect(s.bandwidth()).toBe(50);
  });
});
