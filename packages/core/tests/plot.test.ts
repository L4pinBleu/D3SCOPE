// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  countOutside,
  gridX,
  gridY,
  plot,
  stepTicks,
  createPlotScale,
  continuousDomain,
  inferKind,
} from '../src/plot/index';
import type { Mark, PlotContext } from '../src/plot/types';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

/** A mark that only declares its values and records the context it was given. */
function probe(
  xs?: (number | Date | string)[],
  ys?: (number | Date | string)[],
): Mark & { ctx?: PlotContext } {
  const m: Mark & { ctx?: PlotContext } = {
    name: 'probe',
    render(ctx) {
      m.ctx = ctx;
    },
  };
  if (xs) m.xValues = () => xs;
  if (ys) m.yValues = () => ys;
  return m;
}

describe('inferKind', () => {
  it('infers from the values, and rejects a mix', () => {
    expect(inferKind([1, 2])).toBe('linear');
    expect(inferKind([new Date(0)])).toBe('time');
    expect(inferKind(['a', 'b'])).toBe('band');
    expect(inferKind([])).toBe('linear');
    expect(() => inferKind([1, 'a'])).toThrow(TypeError);
  });
});

describe('continuousDomain', () => {
  it('uses the extent of the values', () => {
    expect(continuousDomain([3, 9, 5], {})).toEqual([3, 9]);
  });

  it('uses min and max when given', () => {
    expect(continuousDomain([3, 9], { min: 0, max: 100 })).toEqual([0, 100]);
  });

  it('falls back to [0, 1] with no values', () => {
    expect(continuousDomain([], {})).toEqual([0, 1]);
  });

  it('gives a flat series a visible span', () => {
    const [a, b] = continuousDomain([5, 5], {}) as [number, number];
    expect(a).toBeLessThan(5);
    expect(b).toBeGreaterThan(5);
  });

  it('rejects max below min', () => {
    expect(() => continuousDomain([1], { min: 10, max: 2 })).toThrow(RangeError);
  });
});

describe('stepTicks', () => {
  it('produces ticks every step inside the domain', () => {
    expect(stepTicks([0, 100], 20)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(stepTicks([0, 1], 0.25)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it('rounds to the decimals of the step (no 0.30000000000000004)', () => {
    expect(stepTicks([0, 0.5], 0.1)).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5]);
  });

  it('works on a reversed domain and a domain that does not start on a step', () => {
    expect(stepTicks([100, 5], 30)).toEqual([30, 60, 90]);
  });

  it('rejects a non-positive step and too many ticks', () => {
    expect(() => stepTicks([0, 1], 0)).toThrow(RangeError);
    expect(() => stepTicks([0, 1], Number.NaN)).toThrow(RangeError);
    expect(() => stepTicks([0, 1e9], 1)).toThrow(RangeError);
  });
});

describe('createPlotScale', () => {
  it('maps the domain to the range, without nice when min and max are set', () => {
    const s = createPlotScale('linear', [2, 8], [0, 100], { min: 0, max: 10 });
    expect(s.domain).toEqual([0, 10]);
    expect(s.position(0)).toBeCloseTo(0);
    expect(s.position(10)).toBeCloseTo(100);
  });

  it('reverses the range when reverse is set', () => {
    const s = createPlotScale('linear', [0, 10], [0, 100], { nice: false, reverse: true });
    expect(s.position(0)).toBeCloseTo(100);
    expect(s.position(10)).toBeCloseTo(0);
  });

  it('builds a band scale with the given category order', () => {
    const s = createPlotScale('band', ['b', 'a', 'b'], [0, 300], { domain: ['a', 'b', 'c'] });
    expect(s.kind).toBe('band');
    expect(s.domain).toEqual(['a', 'b', 'c']);
    expect(s.position('a')).toBeLessThan(s.position('b'));
    expect(s.bandwidth()).toBeGreaterThan(0);
    expect(s.ticks(5)).toEqual(['a', 'b', 'c']);
  });

  it('builds a time scale from dates', () => {
    const t0 = new Date(Date.UTC(2026, 0, 1));
    const t1 = new Date(Date.UTC(2026, 11, 31));
    const s = createPlotScale('time', [t0, t1], [0, 365], { nice: false });
    expect(s.kind).toBe('time');
    expect(s.position(t0)).toBeCloseTo(0);
    expect(s.position(t1)).toBeCloseTo(365);
  });

  it('builds a log scale', () => {
    const s = createPlotScale('log', [1, 1000], [100, 0], { nice: false });
    expect(s.kind).toBe('log');
    expect(s.position(1)).toBeCloseTo(100);
    expect(s.position(1000)).toBeCloseTo(0);
  });

  it('only supports step on linear axes', () => {
    const s = createPlotScale('time', [new Date(0), new Date(1000)], [0, 100], { step: 1 });
    expect(() => s.ticks(5)).toThrow(RangeError);
  });
});

describe('plot()', () => {
  it('lays out the plot area inside the margins and computes the scales', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 400,
      height: 300,
      x: { nice: false },
      y: { nice: false },
      marks: [probe([0, 10], [0, 50])],
    });
    expect(ctx.innerWidth).toBe(400 - 40 - 16);
    expect(ctx.innerHeight).toBe(300 - 16 - 28);
    expect(ctx.y.position(0)).toBeCloseTo(ctx.innerHeight);
    expect(ctx.y.position(50)).toBeCloseTo(0);
    expect(svg.getAttribute('width')).toBe('400');
    svg.remove();
  });

  it('replaces the previous drawing on every call', () => {
    const svg = makeSvg();
    plot(svg, { width: 200, height: 150, marks: [probe([1, 2], [1, 2])] });
    plot(svg, { width: 200, height: 150, marks: [probe([1, 2], [1, 2])] });
    expect(svg.querySelectorAll('g.d3s-plot')).toHaveLength(1);
    svg.remove();
  });

  it('draws the marks in order, before the axes', () => {
    const svg = makeSvg();
    const order: string[] = [];
    const a: Mark = {
      name: 'a',
      render: (ctx) => {
        order.push('a');
        ctx.layer('a');
      },
    };
    const b: Mark = {
      name: 'b',
      render: (ctx) => {
        order.push('b');
        ctx.layer('b');
      },
    };
    plot(svg, { width: 200, height: 150, marks: [a, b] });
    const layers = [...svg.querySelectorAll('.d3s-layer')].map((n) => n.getAttribute('class'));
    expect(order).toEqual(['a', 'b']);
    expect(layers).toEqual(['d3s-layer d3s-a', 'd3s-layer d3s-b']);
    expect(svg.querySelector('.d3s-axis-x')).not.toBeNull();
    svg.remove();
  });

  it('draws a gridline at each tick when the axis grid is on', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      y: { min: 0, max: 100, step: 20, grid: { color: '#ccc', dash: '4 4' } },
      marks: [probe([0, 10], [0, 100])],
    });
    const lines = svg.querySelectorAll('.d3s-grid-y line');
    expect(lines).toHaveLength(6);
    expect(lines[0]?.getAttribute('stroke')).toBe('#ccc');
    expect(lines[0]?.getAttribute('stroke-dasharray')).toBe('4 4');
    expect(ctx.y.domain).toEqual([0, 100]);
    svg.remove();
  });

  it('draws the axis ticks at the step when step is set', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 300,
      height: 200,
      y: { min: 0, max: 100, step: 25 },
      marks: [probe([0, 10], [0, 100])],
    });
    const labels = [...svg.querySelectorAll('.d3s-axis-y .tick text')].map((n) => n.textContent);
    expect(labels).toHaveLength(5);
    svg.remove();
  });

  it('draws gridlines from gridX and gridY marks', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 300,
      height: 200,
      x: { min: 0, max: 10, step: 5 },
      y: { min: 0, max: 10, step: 5 },
      marks: [gridX(), gridY(), probe([0, 10], [0, 10])],
    });
    expect(svg.querySelectorAll('.d3s-grid-x line')).toHaveLength(3);
    expect(svg.querySelectorAll('.d3s-grid-y line')).toHaveLength(3);
    svg.remove();
  });

  it('reserves room for axis titles and draws them', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      x: { label: 'Mois' },
      y: { label: 'Ventes' },
      marks: [probe([0, 1], [0, 1])],
    });
    expect(ctx.margin.left).toBe(40 + 18);
    expect(ctx.margin.bottom).toBe(28 + 18);
    const texts = [...svg.querySelectorAll('text')].map((n) => n.textContent);
    expect(texts).toContain('Mois');
    expect(texts).toContain('Ventes');
    svg.remove();
  });

  it('moves the y axis to the right side', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 300,
      height: 200,
      y: { position: 'right' },
      marks: [probe([0, 1], [0, 1])],
    });
    expect(svg.querySelector('.d3s-axis-y')?.getAttribute('transform')).toMatch(/^translate\(/);
    svg.remove();
  });

  it('rejects a size with no room for the plot area', () => {
    const svg = makeSvg();
    expect(() => plot(svg, { width: 0, height: 100, marks: [] })).toThrow(RangeError);
    expect(() => plot(svg, { width: 40, height: 100, marks: [] })).toThrow(RangeError);
    svg.remove();
  });
});

describe('out-of-domain values and clipping (review fixes)', () => {
  /** A mark that opens one layer, so the clip attribute can be checked. */
  const layerMark = (): Mark => ({
    name: 'layer',
    render(ctx) {
      ctx.layer('probe');
    },
  });

  it('rejects step on a band axis when the scale is read', () => {
    const s = createPlotScale('band', ['a', 'b'], [0, 100], { step: 1 });
    expect(() => s.ticks(5)).toThrow(RangeError);
  });

  it('counts values outside a fixed min and max, for numbers and dates', () => {
    expect(countOutside([0, 50, 120, -5], { min: 0, max: 100 })).toBe(2);
    expect(
      countOutside([new Date(0), new Date(1e12)], { min: new Date(0), max: new Date(10) }),
    ).toBe(1);
  });

  it('counts nothing without bounds, and ignores category names', () => {
    expect(countOutside([0, 1e9], {})).toBe(0);
    expect(countOutside(['a', 'b'], { min: 0, max: 1 })).toBe(0);
  });

  it('flags the SVG and the context when values fall outside the domain', () => {
    const svg = makeSvg();
    const m = probe(undefined, [10, 150]);
    const ctx = plot(svg, { width: 300, height: 200, y: { min: 0, max: 100 }, marks: [m] });
    expect(ctx.outOfDomain).toEqual({ x: 0, y: 1 });
    expect(svg.getAttribute('data-d3s-out-of-domain')).toBe('true');
    svg.remove();
  });

  it('does not flag the SVG when every value is inside the domain', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      y: { min: 0, max: 100 },
      marks: [probe(undefined, [10, 90])],
    });
    expect(ctx.outOfDomain).toEqual({ x: 0, y: 0 });
    expect(svg.hasAttribute('data-d3s-out-of-domain')).toBe(false);
    svg.remove();
  });

  it('clips every mark layer to a clip path that covers the plot area', () => {
    const svg = makeSvg();
    plot(svg, { width: 300, height: 200, marks: [layerMark()] });
    const layer = svg.querySelector<SVGGElement>('.d3s-layer');
    const clipRef = layer?.getAttribute('clip-path') ?? '';
    const id = clipRef.replace(/^url\(#(.+)\)$/, '$1');
    expect(id).not.toBe('');
    const rect = svg.querySelector(`clipPath#${id} rect`);
    expect(rect?.getAttribute('width')).toBe(String(300 - 40 - 16));
    expect(rect?.getAttribute('height')).toBe(String(200 - 16 - 28));
    svg.remove();
  });

  it('gives each plot its own clip id', () => {
    const a = makeSvg();
    const b = makeSvg();
    plot(a, { width: 300, height: 200, marks: [layerMark()] });
    plot(b, { width: 300, height: 200, marks: [layerMark()] });
    const idA = a.querySelector('.d3s-layer')?.getAttribute('clip-path');
    const idB = b.querySelector('.d3s-layer')?.getAttribute('clip-path');
    expect(idA).not.toBe(idB);
    a.remove();
    b.remove();
  });
});
