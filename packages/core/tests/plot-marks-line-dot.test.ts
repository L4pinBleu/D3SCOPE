// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { dot } from '../src/plot/marks/dot';
import { line } from '../src/plot/marks/line';
import { plot } from '../src/plot/plot';
import type { Mark } from '../src/plot/types';
import { cssVar, LIGHT_THEME } from '../src/theme/index';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

/** An attribute of every element in a selector, in document order. */
function attrs(svg: SVGSVGElement, selector: string, name: string): (string | null)[] {
  return Array.from(svg.querySelectorAll(selector), (el) => el.getAttribute(name));
}

/** The value of a single attribute, from the only matching element. */
function attr(svg: SVGSVGElement, selector: string, name: string): string | null | undefined {
  return svg.querySelector(selector)?.getAttribute(name);
}

/** Count the path commands in a `d` attribute. */
function commands(d: string | null | undefined): { m: number; l: number } {
  const s = d ?? '';
  return {
    m: (s.match(/M/g) ?? []).length,
    l: (s.match(/L/g) ?? []).length,
  };
}

describe('line()', () => {
  it('draws one path per series with the right number of M/L commands', () => {
    const svg = makeSvg();
    const rows = [
      { day: 'a', value: 1, kind: 'x' },
      { day: 'a', value: 3, kind: 'y' },
      { day: 'b', value: 2, kind: 'x' },
      { day: 'b', value: 4, kind: 'y' },
      { day: 'c', value: 5, kind: 'x' },
    ];
    plot(svg, {
      width: 300,
      height: 200,
      x: { type: 'band' },
      marks: [line(rows, { x: 'day', y: 'value', series: 'kind' })],
    });
    const ds = attrs(svg, 'path.d3s-line', 'd');
    expect(ds).toHaveLength(2);
    // The 'x' series has 3 points (a, b, c); the 'y' series has 2 (a, b).
    expect(commands(ds[0])).toEqual({ m: 1, l: 2 });
    expect(commands(ds[1])).toEqual({ m: 1, l: 1 });
    expect(attr(svg, 'path.d3s-line', 'fill')).toBe('none');
    svg.remove();
  });

  it('sorts the points by x even when the data is not ordered', () => {
    const svg = makeSvg();
    // Numeric x → a linear scale, so the path must follow x order, not row order.
    const rows = [
      { day: 3, value: 30, kind: 's' },
      { day: 1, value: 10, kind: 's' },
      { day: 2, value: 20, kind: 's' },
    ];
    plot(svg, {
      width: 300,
      height: 200,
      marks: [line(rows, { x: 'day', y: 'value' })],
    });
    const d = attr(svg, 'path.d3s-line', 'd') ?? '';
    const ys = [...d.matchAll(/[ML](-?\d+\.?\d*),(-?\d+\.?\d*)/g)].map((m) => Number(m[2]));
    // The y range is [height, 0]: a smaller value sits lower (a larger pixel).
    // Sorted x means values 10, 20, 30 in order → decreasing pixel y.
    expect(ys[0] ?? Number.NaN).toBeGreaterThan(ys[1] ?? Number.NaN);
    expect(ys[1] ?? Number.NaN).toBeGreaterThan(ys[2] ?? Number.NaN);
    svg.remove();
  });

  it('takes series colours from ctx.color, distinct per series', () => {
    const svg = makeSvg();
    const rows = [
      { day: '1', value: 1, kind: 'alpha' },
      { day: '2', value: 2, kind: 'beta' },
    ];
    plot(svg, {
      width: 300,
      height: 200,
      marks: [line(rows, { x: 'day', y: 'value', series: 'kind' })],
    });
    const strokes = attrs(svg, 'path.d3s-line', 'stroke');
    expect(strokes[0]).toBe(LIGHT_THEME.palette[0]);
    expect(strokes[1]).toBe(LIGHT_THEME.palette[1]);
    expect(strokes[0]).not.toBe(strokes[1]);
    svg.remove();
  });

  it('uses the literal stroke when given, overriding series colours', () => {
    const svg = makeSvg();
    const rows = [{ day: '1', value: 1, kind: 'alpha' }];
    plot(svg, {
      width: 300,
      height: 200,
      marks: [line(rows, { x: 'day', y: 'value', series: 'kind', stroke: '#ff0000' })],
    });
    expect(attr(svg, 'path.d3s-line', 'stroke')).toBe('#ff0000');
    svg.remove();

    const svg2 = makeSvg();
    plot(svg2, {
      width: 300,
      height: 200,
      marks: [line(rows, { x: 'day', y: 'value', stroke: '#00ff00' })],
    });
    expect(attr(svg2, 'path.d3s-line', 'stroke')).toBe('#00ff00');
    svg2.remove();
  });

  it('skips rows with a missing or NaN value', () => {
    const svg = makeSvg();
    const rows = [
      { day: '1', value: 1, kind: 's' },
      { day: '2', value: Number.NaN, kind: 's' },
      { day: '3', value: 3, kind: 's' },
    ];
    const mark = line(rows, { x: 'day', y: 'value' });
    expect(mark.yValues?.()).toEqual([1, 3]);
    plot(svg, { width: 300, height: 200, marks: [mark] });
    expect(commands(attr(svg, 'path.d3s-line', 'd'))).toEqual({ m: 1, l: 1 });
    svg.remove();

    const svg2 = makeSvg();
    const missing = [{ day: '1', value: null as unknown as number, kind: 's' }];
    plot(svg2, { width: 300, height: 200, marks: [line(missing, { x: 'day', y: 'value' })] });
    expect(svg2.querySelectorAll('path.d3s-line')).toHaveLength(0);
    svg2.remove();
  });

  it('works with a Date x on a time scale', () => {
    const svg = makeSvg();
    const rows = [
      { at: new Date(2026, 0, 1), value: 1, kind: 's' },
      { at: new Date(2026, 0, 2), value: 2, kind: 's' },
    ];
    const mark = line(rows, { x: 'at', y: 'value' });
    expect(mark.xValues?.()[0]).toBeInstanceOf(Date);
    plot(svg, { width: 300, height: 200, marks: [mark] });
    const d = attr(svg, 'path.d3s-line', 'd') ?? '';
    expect(commands(d)).toEqual({ m: 1, l: 1 });
    expect(d).toMatch(/^M\d/); // finite pixel positions
    svg.remove();
  });

  it('places band-x points at the centre of the band', () => {
    const svg = makeSvg();
    const rows = [
      { day: 'a', value: 1, kind: 's' },
      { day: 'b', value: 2, kind: 's' },
    ];
    const mark = line(rows, { x: 'day', y: 'value' });
    plot(svg, {
      width: 300,
      height: 200,
      x: { type: 'band', domain: ['a', 'b'] },
      marks: [mark],
    });
    // A second plot() would wipe the svg; build the reference context on its own svg.
    const ref = plot(makeSvg(), {
      width: 300,
      height: 200,
      x: { type: 'band', domain: ['a', 'b'] },
      marks: [],
    });
    const bw = ref.x.bandwidth();
    expect(bw).toBeGreaterThan(0);
    const d = attr(svg, 'path.d3s-line', 'd') ?? '';
    const xs = [...d.matchAll(/[ML](-?\d+\.?\d*),/g)].map((m) => Number(m[1]));
    expect(xs[0] ?? Number.NaN).toBeCloseTo(ref.x.position('a') + bw / 2, 5);
    expect(xs[1] ?? Number.NaN).toBeCloseTo(ref.x.position('b') + bw / 2, 5);
    svg.remove();
  });

  it('draws nothing for empty rows, and declares no values', () => {
    const svg = makeSvg();
    const mark = line([], { x: 'day', y: 'value', series: 'kind' });
    expect(mark.xValues?.()).toEqual([]);
    expect(mark.yValues?.()).toEqual([]);
    expect(mark.colorValues?.()).toEqual([]);
    plot(svg, { width: 300, height: 200, marks: [mark] });
    expect(svg.querySelectorAll('path.d3s-line')).toHaveLength(0);
    svg.remove();
  });

  it('declares the series categories as colour values', () => {
    const rows = [
      { day: '1', value: 1, kind: 'b' },
      { day: '2', value: 2, kind: 'a' },
      { day: '3', value: 3, kind: 'b' },
    ];
    const mark: Mark = line(rows, { x: 'day', y: 'value', series: 'kind' });
    expect(mark.colorValues?.()).toEqual(['b', 'a', 'b']);
  });
});

describe('dot()', () => {
  it('draws one circle per row at the right cx and cy', () => {
    const svg = makeSvg();
    const rows = [
      { day: '1', value: 10, kind: 's' },
      { day: '2', value: 20, kind: 's' },
    ];
    plot(svg, {
      width: 300,
      height: 200,
      x: { type: 'linear', min: 1, max: 2 },
      y: { type: 'linear', min: 10, max: 20 },
      marks: [dot(rows, { x: 'day', y: 'value', r: 4 })],
    });
    const circles = svg.querySelectorAll('circle.d3s-dot');
    expect(circles).toHaveLength(2);
    expect(attr(svg, 'circle.d3s-dot', 'r')).toBe('4');
    // A second plot() would wipe the svg; build the reference context on its own svg.
    const ref = plot(makeSvg(), {
      width: 300,
      height: 200,
      x: { type: 'linear', min: 1, max: 2 },
      y: { type: 'linear', min: 10, max: 20 },
      marks: [],
    });
    const cxs = attrs(svg, 'circle.d3s-dot', 'cx');
    const cys = attrs(svg, 'circle.d3s-dot', 'cy');
    expect(cxs[0]).toBe(String(ref.x.position(1)));
    expect(cys[0]).toBe(String(ref.y.position(10)));
    expect(cxs[1]).toBe(String(ref.x.position(2)));
    svg.remove();
  });

  it('fills by category through ctx.color, and honours a literal fill', () => {
    const svg = makeSvg();
    const rows = [
      { day: '1', value: 1, kind: 'a' },
      { day: '2', value: 2, kind: 'b' },
    ];
    plot(svg, {
      width: 300,
      height: 200,
      marks: [dot(rows, { x: 'day', y: 'value', fill: 'kind' })],
    });
    const fills = attrs(svg, 'circle.d3s-dot', 'fill');
    expect(fills[0]).toBe(LIGHT_THEME.palette[0]);
    expect(fills[1]).toBe(LIGHT_THEME.palette[1]);
    svg.remove();

    const svg2 = makeSvg();
    plot(svg2, {
      width: 300,
      height: 200,
      marks: [dot(rows, { x: 'day', y: 'value', fill: '#123456' })],
    });
    expect(attr(svg2, 'circle.d3s-dot', 'fill')).toBe('#123456');
    svg2.remove();
  });

  it('applies opacity and the default radius', () => {
    const svg = makeSvg();
    const rows = [{ day: '1', value: 1, kind: 's' }];
    plot(svg, {
      width: 300,
      height: 200,
      marks: [dot(rows, { x: 'day', y: 'value', opacity: 0.5 })],
    });
    expect(attr(svg, 'circle.d3s-dot', 'r')).toBe('3');
    expect(attr(svg, 'circle.d3s-dot', 'fill-opacity')).toBe('0.5');
    svg.remove();
  });

  it('skips invalid rows and draws nothing for empty rows', () => {
    const svg = makeSvg();
    const rows = [
      { day: '1', value: Number.NaN, kind: 's' },
      { day: '2', value: 2, kind: 's' },
    ];
    const mark = dot(rows, { x: 'day', y: 'value' });
    expect(mark.yValues?.()).toEqual([2]);
    plot(svg, { width: 300, height: 200, marks: [mark] });
    expect(svg.querySelectorAll('circle.d3s-dot')).toHaveLength(1);
    svg.remove();

    const svg2 = makeSvg();
    const empty = dot([], { x: 'day', y: 'value' });
    expect(empty.xValues?.()).toEqual([]);
    expect(empty.yValues?.()).toEqual([]);
    plot(svg2, { width: 300, height: 200, marks: [empty] });
    expect(svg2.querySelectorAll('circle.d3s-dot')).toHaveLength(0);
    svg2.remove();
  });

  it('defaults the fill to the theme accent', () => {
    const svg = makeSvg();
    const rows = [{ day: '1', value: 1, kind: 's' }];
    plot(svg, { width: 300, height: 200, marks: [dot(rows, { x: 'day', y: 'value' })] });
    // The default fill is the theme accent, wired through a CSS variable.
    expect(attr(svg, 'circle.d3s-dot', 'fill')).toBe(cssVar('accent', LIGHT_THEME.accent));
    svg.remove();
  });
});
