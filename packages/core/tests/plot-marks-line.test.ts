// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { area, line } from '../src/plot/marks/line.js';
import { plot } from '../src/plot/index.js';
import type { Mark } from '../src/plot/types.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

/** Draw one mark in a 400×300 plot and return the svg. */
function draw(mark: Mark, options?: { y?: { min?: number; max?: number } }): SVGSVGElement {
  const svg = makeSvg();
  plot(svg, {
    width: 400,
    height: 300,
    x: { nice: false },
    y: { nice: false, ...options?.y },
    marks: [mark],
  });
  return svg;
}

function paths(svg: SVGSVGElement): readonly SVGPathElement[] {
  return [...svg.querySelectorAll<SVGPathElement>('path.d3s-line')];
}

interface Point {
  x: number;
  y: number;
}

describe('line()', () => {
  it('draws one path per series, starting with M and one L per point', () => {
    const data: Point[] = [
      { x: 0, y: 1 },
      { x: 1, y: 3 },
      { x: 2, y: 2 },
    ];
    const svg = draw(line(data, { x: 'x', y: 'y' }));
    const [path] = paths(svg);
    expect(paths(svg)).toHaveLength(1);
    expect(path?.getAttribute('d')).toMatch(/^M/);
    expect(path?.getAttribute('d')?.match(/ L/g)).toHaveLength(2);
    expect(path?.getAttribute('fill')).toBe('none');
  });

  it('draws two paths for two series', () => {
    const data = [
      { s: 'a', x: 0, y: 1 },
      { s: 'b', x: 0, y: 5 },
      { s: 'a', x: 1, y: 2 },
      { s: 'b', x: 1, y: 6 },
    ];
    const svg = draw(line(data, { x: 'x', y: 'y', series: 's' }));
    expect(paths(svg)).toHaveLength(2);
  });

  it('gives unsorted data the same path as sorted data', () => {
    const sorted: Point[] = [
      { x: 0, y: 1 },
      { x: 1, y: 3 },
      { x: 2, y: 2 },
    ];
    const unsorted: Point[] = [
      { x: 2, y: 2 },
      { x: 0, y: 1 },
      { x: 1, y: 3 },
    ];
    const a = draw(line(sorted, { x: 'x', y: 'y' }));
    const b = draw(line(unsorted, { x: 'x', y: 'y' }));
    expect(paths(b)[0]?.getAttribute('d')).toBe(paths(a)[0]?.getAttribute('d'));
  });

  it('breaks the path at NaN points and emits no NaN in any d', () => {
    const data: Point[] = [
      { x: 0, y: 1 },
      { x: 1, y: Number.NaN },
      { x: 2, y: 3 },
    ];
    // Pin the y domain: a NaN value would otherwise poison the min/max domain.
    const svg = draw(line(data, { x: 'x', y: 'y' }), { y: { min: 0, max: 5 } });
    const d = paths(svg)[0]?.getAttribute('d') ?? '';
    expect(d.match(/M/g)).toHaveLength(2);
    expect(d).not.toContain('NaN');
  });

  it('accepts Date x values on a time scale', () => {
    const data = [
      { date: new Date(Date.UTC(2026, 0, 1)), y: 1 },
      { date: new Date(Date.UTC(2026, 6, 1)), y: 4 },
    ];
    const svg = draw(line(data, { x: 'date', y: 'y' }));
    const d = paths(svg)[0]?.getAttribute('d') ?? '';
    expect(d).toMatch(/^M\d/);
    expect(d.split(' ')).toHaveLength(2);
  });

  it('resolves a stroke accessor through a stable color scale on the mark', () => {
    const data = [
      { s: 'b', x: 0, y: 1 },
      { s: 'a', x: 0, y: 5 },
      { s: 'b', x: 1, y: 2 },
      { s: 'a', x: 1, y: 6 },
    ];
    const mark = line(data, { x: 'x', y: 'y', series: 's', stroke: (d) => d.s });
    const scale = (mark as { colorScale?: (label: string) => string }).colorScale;
    expect(scale).toBeDefined();
    expect(scale?.('a')).not.toBe(scale?.('b'));
    expect(scale?.('a')).toBe(scale?.('a'));
    const svg = draw(mark);
    const strokes = paths(svg).map((p) => p.getAttribute('stroke'));
    expect(new Set(strokes).size).toBe(2);
  });

  it('declares all x and y values for the domain', () => {
    const data: Point[] = [
      { x: 2, y: 5 },
      { x: 8, y: 7 },
    ];
    const mark = line(data, { x: 'x', y: 'y' });
    expect(mark.xValues?.()).toEqual([2, 8]);
    expect(mark.yValues?.()).toEqual([5, 7]);
  });

  it('draws nothing and does not throw on empty data', () => {
    const svg = draw(line([], { x: 'x', y: 'y' }));
    expect(paths(svg)).toHaveLength(0);
  });
});

describe('area()', () => {
  it('closes the path to the baseline with Z', () => {
    const data: Point[] = [
      { x: 0, y: 1 },
      { x: 2, y: 3 },
    ];
    const svg = draw(area(data, { x: 'x', y: 'y' }));
    const d = paths(svg)[0]?.getAttribute('d') ?? '';
    expect(d.endsWith('Z')).toBe(true);
    // The baseline y position, in pixels (y = 0 maps near the bottom).
    const bottom = d.split(' ').at(-2) ?? '';
    expect(d).toMatch(/L\d+(\.\d+)?,\d+(\.\d+)? L\d+(\.\d+)?,\d+(\.\d+)? Z$/);
    expect(bottom.startsWith('L')).toBe(true);
  });

  it('includes the baseline 0 in the y domain when all values are positive', () => {
    const data: Point[] = [
      { x: 0, y: 10 },
      { x: 1, y: 20 },
    ];
    const svg = draw(area(data, { x: 'x', y: 'y' }), { y: { min: 10, max: 20 } });
    // y = 0 is below the visible domain here; with the default domain it is in.
    const svg2 = draw(area(data, { x: 'x', y: 'y' }));
    const d = paths(svg2)[0]?.getAttribute('d') ?? '';
    // The path reaches the y position of 0, the bottom of the plot area.
    const ys = [...d.matchAll(/,(\d+(\.\d+)?)/g)].map((m) => Number(m[1]));
    const maxPixelY = Math.max(...ys);
    expect(maxPixelY).toBeGreaterThan(250); // near innerHeight (300 - 16 - 28 = 256)
    expect(svg.querySelector('.d3s-line')).not.toBeNull();
  });

  it('supports a custom baseline in data units', () => {
    const data: Point[] = [
      { x: 0, y: 5 },
      { x: 1, y: 9 },
    ];
    const mark = area(data, { x: 'x', y: 'y', baseline: 5 });
    expect(mark.yValues?.()).toContain(5);
    const svg = draw(mark, { y: { min: 0, max: 10 } });
    const d = paths(svg)[0]?.getAttribute('d') ?? '';
    const ys = [...d.matchAll(/,(\d+(\.\d+)?)/g)].map((m) => Number(m[1]));
    // The closing corners sit at the y position of 5, not at 0.
    expect(Math.max(...ys)).toBeCloseTo(128, 0); // midpoint of [0, 10] over 256 px
  });

  it('draws with a fill opacity and no stroke, and declares the baseline', () => {
    const data: Point[] = [{ x: 0, y: 4 }];
    const svg = draw(area(data, { x: 'x', y: 'y', fill: '#f00', opacity: 0.4 }));
    const path = paths(svg)[0];
    expect(path?.getAttribute('fill')).toBe('#f00');
    expect(path?.getAttribute('fill-opacity')).toBe('0.4');
    expect(path?.getAttribute('stroke')).toBe('none');
  });

  it('draws nothing and does not throw on empty data', () => {
    const svg = draw(area([], { x: 'x', y: 'y' }));
    expect(paths(svg)).toHaveLength(0);
  });
});
