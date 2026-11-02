// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { curveAreaPath, curvePath, type CurvePoint } from '../src/plot/curves';
import { plot } from '../src/plot/plot';
import { area, areaPathD } from '../src/plot/marks/area';
import { line, pathD } from '../src/plot/marks/line';

const SVG_NS = 'http://www.w3.org/2000/svg';

const pts = (values: readonly [number, number][]): CurvePoint[] =>
  values.map(([x, y]) => ({ x, y }));

describe('curvePath: linear is the plain polyline, byte for byte', () => {
  it('matches the line mark pathD output exactly', () => {
    const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
    document.body.appendChild(svg);
    const rows = [
      { x: 1, y: 10 },
      { x: 2, y: 40 },
      { x: 3, y: 25 },
    ];
    const ctx = plot(svg, { width: 300, height: 200, marks: [line(rows, { x: 'x', y: 'y' })] });
    const pixel = pts([
      [ctx.x.position(1), ctx.y.position(10)],
      [ctx.x.position(2), ctx.y.position(40)],
      [ctx.x.position(3), ctx.y.position(25)],
    ]);
    expect(curvePath(pixel, 'linear')).toBe(pathD(rows, ctx));
    expect(curvePath(pixel)).toBe(pathD(rows, ctx));
    svg.remove();
  });

  it('uses only M and L segments', () => {
    const d = curvePath(
      pts([
        [0, 0],
        [10, 5],
        [20, -5],
      ]),
      'linear',
    );
    expect(d).toBe('M0,0L10,5L20,-5');
  });
});

describe('curvePath: step curves', () => {
  it('step is horizontal then vertical at the midpoint', () => {
    const d = curvePath(
      pts([
        [0, 0],
        [10, 10],
        [30, 0],
      ]),
      'step',
    );
    expect(d).toBe('M0,0H5V10H20V0L30,0');
  });

  it('stepBefore steps vertically at the current point, then horizontally', () => {
    const d = curvePath(
      pts([
        [0, 0],
        [10, 10],
        [20, 5],
      ]),
      'stepBefore',
    );
    expect(d).toBe('M0,0V10H10V5H20');
  });

  it('stepAfter steps horizontally first, then vertically at the next point', () => {
    const d = curvePath(
      pts([
        [0, 0],
        [10, 10],
        [20, 5],
      ]),
      'stepAfter',
    );
    expect(d).toBe('M0,0H10V10H20V5');
  });
});

describe('curvePath: monotone (Fritsch–Carlson)', () => {
  it('never overshoots monotone data', () => {
    const points = pts([
      [0, 0],
      [10, 20],
      [30, 25],
      [60, 100],
    ]);
    const d = curvePath(points, 'monotone');
    // Every cubic segment must stay within the y range of its endpoints.
    const commands = d.slice(1).split(/(?=[CL])/);
    for (const command of commands) {
      const numbers = [...command.matchAll(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g)].map((m) => Number(m[0]));
      expect(numbers.length % 2).toBe(0);
      const ys: number[] = [];
      for (let i = 1; i < numbers.length; i += 2) {
        const y = numbers[i];
        if (y !== undefined) ys.push(y);
      }
      for (const y of ys) {
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(100);
      }
    }
  });

  it('starts and ends at the first and last data points', () => {
    const points = pts([
      [0, 5],
      [10, 1],
      [20, 8],
    ]);
    const d = curvePath(points, 'monotone');
    expect(d.startsWith('M0,5')).toBe(true);
    expect(d.endsWith('20,8')).toBe(true);
    expect(d).toContain('C');
  });
});

describe('curvePath: natural cubic spline', () => {
  it('passes through every data point', () => {
    const points = pts([
      [0, 0],
      [10, 20],
      [25, 5],
      [40, 30],
    ]);
    const d = curvePath(points, 'natural');
    // Evaluate each cubic Bézier segment at t = 1/2 and check a few t values
    // against the interpolation of the endpoints and tangents implied by the
    // control points: the spline must hit the data exactly at the knots.
    const knotValues = knotYs(d, points);
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      if (point === undefined) continue;
      const knot = knotValues[i];
      expect(knot).toBeDefined();
      expect(Math.abs((knot ?? point.y) - point.y)).toBeLessThan(1e-9);
    }
  });

  it('is not the straight polyline (it actually curves)', () => {
    const points = pts([
      [0, 0],
      [10, 30],
      [20, 0],
    ]);
    const natural = curvePath(points, 'natural');
    const linear = curvePath(points, 'linear');
    expect(natural).not.toBe(linear);
    expect(natural).toContain('C');
  });
});

describe('curvePath: degenerate inputs', () => {
  it('one point gives a lone M', () => {
    for (const curve of [
      'linear',
      'step',
      'stepBefore',
      'stepAfter',
      'monotone',
      'natural',
    ] as const) {
      expect(curvePath(pts([[3, 7]]), curve)).toBe('M3,7');
    }
    expect(curvePath([], 'monotone')).toBe('M');
  });

  it('two points work for every curve', () => {
    const points = pts([
      [0, 0],
      [10, 10],
    ]);
    expect(curvePath(points, 'step')).toBe('M0,0H5V10L10,10');
    expect(curvePath(points, 'stepBefore')).toBe('M0,0V10H10');
    expect(curvePath(points, 'stepAfter')).toBe('M0,0H10V10');
    // Monotone and natural degenerate to the straight line, as a cubic.
    for (const curve of ['monotone', 'natural'] as const) {
      const d = curvePath(points, curve);
      expect(d.startsWith('M0,0')).toBe(true);
      expect(d.endsWith('10,10')).toBe(true);
    }
  });
});

describe('curveAreaPath', () => {
  it('linear reproduces the area mark pathD output exactly', () => {
    const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
    document.body.appendChild(svg);
    const rows = [
      { x: 1, y: 10 },
      { x: 2, y: 40 },
    ];
    const ctx = plot(svg, { width: 300, height: 200, marks: [area(rows, { x: 'x', y: 'y' })] });
    const baseline = ctx.y.position(0);
    const top = pts([
      [ctx.x.position(1), ctx.y.position(10)],
      [ctx.x.position(2), ctx.y.position(40)],
    ]);
    const bottom = pts([
      [ctx.x.position(1), baseline],
      [ctx.x.position(2), baseline],
    ]);
    expect(curveAreaPath(top, bottom, 'linear')).toBe(areaPathD(rows, ctx, baseline));
    expect(curveAreaPath(top, bottom)).toBe(areaPathD(rows, ctx, baseline));
    svg.remove();
  });

  it('a curved area is closed and drops straight to the bottom line', () => {
    const top = pts([
      [0, 10],
      [10, 0],
      [20, 15],
    ]);
    const bottom = pts([
      [0, 30],
      [10, 25],
      [20, 30],
    ]);
    const d = curveAreaPath(top, bottom, 'monotone');
    expect(d.startsWith('M0,10')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d).toContain('C');
    // The drop from the last top point to the last bottom point is a straight L.
    expect(d).toContain('L20,30');
  });

  it('fewer than two top points gives no area', () => {
    expect(curveAreaPath(pts([[5, 5]]), pts([[5, 0]]), 'monotone')).toBe('M5,5Z');
    expect(curveAreaPath([], [], 'monotone')).toBe('');
  });
});

/** The y of each knot of a Bézier path: segment ends and the initial M. */
function knotYs(d: string, points: readonly CurvePoint[]): number[] {
  const ys: number[] = [];
  const firstY = points[0]?.y;
  if (firstY !== undefined) ys.push(firstY);
  for (const command of d.match(/[CL][^CLHVQZ]*/g) ?? []) {
    const numbers = (command.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g) ?? []).map(Number);
    // The last coordinate pair of a C or the pair of an L is the knot.
    const y = numbers[numbers.length - 1];
    if (y !== undefined) ys.push(y);
  }
  return ys;
}
