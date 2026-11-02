import { describe, expect, it } from 'vitest';
import { curvePath, type CurvePoint } from '../src/plot/curves';

/** Control points of each cubic segment, from the path string. */
function segments(d: string): number[][] {
  return [...d.matchAll(/C([-\d.e]+),([-\d.e]+) ([-\d.e]+),([-\d.e]+) ([-\d.e]+),([-\d.e]+)/g)].map(
    (m) => m.slice(1).map(Number),
  );
}

/** A tiny seeded generator, so the sweep is the same on every run. */
function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function maxOvershoot(points: CurvePoint[]): number {
  const d = curvePath(points, 'monotone');
  const segs = segments(d);
  let worst = 0;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const a = points[i];
    const b = points[i + 1];
    if (!s || !a || !b) continue;
    const lo = Math.min(a.y, b.y);
    const hi = Math.max(a.y, b.y);
    const over = Math.max(
      lo - Math.min(s[1] ?? 0, s[3] ?? 0),
      Math.max(s[1] ?? 0, s[3] ?? 0) - hi,
      0,
    );
    worst = Math.max(worst, over);
  }
  return worst;
}

describe('monotone curve: no overshoot', () => {
  it('keeps the control points inside the segment for a steep jump after a flat part', () => {
    // Regression: the first limiter scaled one tangent only and dipped below the data.
    const points: CurvePoint[] = [
      { x: 0, y: 0.215 },
      { x: 1.307, y: 2.233 },
      { x: 1.932, y: 2.271 },
      { x: 2.591, y: 16.533 },
      { x: 4.772, y: 18.264 },
    ];
    expect(maxOvershoot(points)).toBeLessThan(1e-6);
  });

  it('keeps every segment inside its end values on random monotone data', () => {
    const rand = rng(42);
    for (let trial = 0; trial < 500; trial++) {
      const n = 3 + Math.floor(rand() * 6);
      const up = rand() < 0.5;
      let x = 0;
      let y = rand() * 10 - 5;
      const points: CurvePoint[] = [];
      for (let i = 0; i < n; i++) {
        points.push({ x, y });
        x += 0.2 + rand() * 3;
        y += (up ? 1 : -1) * rand() * (rand() < 0.2 ? 20 : 3);
      }
      expect(maxOvershoot(points)).toBeLessThan(1e-6);
    }
  });
});
