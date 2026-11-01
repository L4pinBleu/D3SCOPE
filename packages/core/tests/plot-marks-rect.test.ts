// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { plot } from '../src/plot/plot.js';
import { rectX, rectY } from '../src/plot/marks/rect.js';
import { LIGHT_THEME } from '../src/theme/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

interface Sales {
  cat: string;
  value: number;
}

const DATA: Sales[] = [
  { cat: 'a', value: 20 },
  { cat: 'b', value: 50 },
  { cat: 'c', value: 80 },
];

function bars(svg: SVGSVGElement, layer: 'rect-y' | 'rect-x'): SVGGElement[] {
  return [...svg.querySelectorAll(`.d3s-${layer} rect`)] as SVGGElement[];
}

function num(rect: SVGGElement, attr: string): number {
  return Number.parseFloat(rect.getAttribute(attr) ?? '');
}

/** Typed access to an expected element, without non-null assertions. */
function rectAt(rects: SVGGElement[], i: number): SVGGElement {
  const r = rects[i];
  if (r === undefined) throw new Error('no rect at index ' + String(i));
  return r;
}

function fillPlot(
  svg: SVGSVGElement,
  data: readonly Sales[],
  extra?: { yDomain?: { min: number; max: number }; xDomain?: readonly string[] },
) {
  return plot(svg, {
    width: 400,
    height: 300,
    x: { type: 'band', ...(extra?.xDomain ? { domain: extra.xDomain } : {}) },
    y: { type: 'linear', min: extra?.yDomain?.min ?? 0, max: extra?.yDomain?.max ?? 100 },
    marks: [rectY(data, { x: 'cat', y: 'value' })],
  });
}

describe('rectY', () => {
  it('draws one rect per datum, in band order on x', () => {
    const svg = makeSvg();
    fillPlot(svg, DATA);
    const rects = bars(svg, 'rect-y');
    expect(rects).toHaveLength(3);
    const xs = rects.map((r) => num(r, 'x'));
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(new Set(xs).size).toBe(3);
    expect(rects.every((r) => r.classList.contains('d3s-bar'))).toBe(true);
    svg.remove();
  });

  it('matches the y scale: height = bandwidth of the value', () => {
    const svg = makeSvg();
    fillPlot(svg, DATA, { yDomain: { min: 0, max: 100 } });
    const rects = bars(svg, 'rect-y');
    const innerHeight = 300 - 16 - 28;
    for (const [i, d] of DATA.entries()) {
      const expected = (d.value / 100) * innerHeight;
      expect(num(rectAt(rects, i), 'height')).toBeCloseTo(expected, 5);
      expect(num(rectAt(rects, i), 'y')).toBeCloseTo(innerHeight - expected, 5);
    }
    svg.remove();
  });

  it('width is 90% of the band width', () => {
    const svg = makeSvg();
    const ctx = fillPlot(svg, DATA);
    const rects = bars(svg, 'rect-y');
    expect(num(rectAt(rects, 0), 'width')).toBeCloseTo(ctx.x.bandwidth() * 0.9, 5);
    svg.remove();
  });

  it('explicit width is used, centred on the x position', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 400,
      height: 300,
      x: { min: 0, max: 100 },
      y: { min: 0, max: 100 },
      marks: [rectY([{ cat: 'a', value: 40 }], { x: () => 50, y: 'value', width: 10 })],
    });
    const rect = rectAt(bars(svg, 'rect-y'), 0);
    const centre = ctx.x.position(50);
    expect(num(rect, 'x')).toBeCloseTo(centre - 5, 5);
    expect(num(rect, 'width')).toBeCloseTo(10, 5);
    svg.remove();
  });

  it('zero is in the y domain even with all-positive values', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 400,
      height: 300,
      y: { nice: false },
      marks: [rectY([{ cat: 'a', value: 5 }], { x: 'cat', y: 'value' })],
    });
    expect(ctx.y.domain[0]).toBe(0);
    svg.remove();
  });

  it('negative values draw downwards from the baseline', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 400,
      height: 300,
      x: { type: 'band' },
      y: { min: -100, max: 100, nice: false },
      marks: [rectY([{ cat: 'a', value: -40 }], { x: 'cat', y: 'value' })],
    });
    const rect = rectAt(bars(svg, 'rect-y'), 0);
    const innerHeight = 300 - 16 - 28;
    // Bar spans from the baseline (mid-screen) down to the value.
    expect(num(rect, 'y')).toBeCloseTo(innerHeight / 2, 5);
    expect(num(rect, 'height')).toBeCloseTo((40 / 200) * innerHeight, 5);
    svg.remove();
  });

  it('an explicit baseline is included in the domain', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 400,
      height: 300,
      y: { nice: false },
      marks: [rectY([{ cat: 'a', value: 50 }], { x: 'cat', y: 'value', baseline: 10 })],
    });
    expect(ctx.y.domain).toEqual([10, 50]);
    svg.remove();
  });

  it('an accessor fill gives a distinct colour per label, stable across renders', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 400,
      height: 300,
      x: { type: 'band' },
      y: { min: 0, max: 100 },
      marks: [rectY(DATA, { x: 'cat', y: 'value', fill: 'cat' })],
    });
    const colors = bars(svg, 'rect-y').map((r) => r.getAttribute('fill'));
    expect(new Set(colors).size).toBe(3);
    const svg2 = makeSvg();
    plot(svg2, {
      width: 400,
      height: 300,
      x: { type: 'band' },
      y: { min: 0, max: 100 },
      marks: [rectY(DATA, { x: 'cat', y: 'value', fill: 'cat' })],
    });
    expect(bars(svg2, 'rect-y').map((r) => r.getAttribute('fill'))).toEqual(colors);
    svg.remove();
    svg2.remove();
  });

  it('an accessor fill exposes colorScale on the mark', () => {
    const mark = rectY(DATA, { x: 'cat', y: 'value', fill: 'cat' });
    expect(mark.colorScale).toBeDefined();
    const scale = mark.colorScale;
    expect(scale).toBeDefined();
    if (!scale) throw new Error('colorScale is missing');
    expect(scale.labels).toEqual(['a', 'b', 'c']);
    expect(scale('a')).toBe(scale('a'));
    const plain = rectY(DATA, { x: 'cat', y: 'value' });
    expect(plain.colorScale).toBeUndefined();
  });

  it('a string fill colours every bar', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 400,
      height: 300,
      x: { type: 'band' },
      y: { min: 0, max: 100 },
      marks: [rectY(DATA, { x: 'cat', y: 'value', fill: '#ff0000' })],
    });
    for (const r of bars(svg, 'rect-y')) {
      expect(r.getAttribute('fill')).toBe('#ff0000');
    }
    svg.remove();
  });

  it('the default fill is the theme accent', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 400,
      height: 300,
      x: { type: 'band' },
      y: { min: 0, max: 100 },
      marks: [rectY(DATA, { x: 'cat', y: 'value' })],
    });
    expect(rectAt(bars(svg, 'rect-y'), 0).getAttribute('fill')).toBe(LIGHT_THEME.accent);
    svg.remove();
  });

  it('skips NaN and non-finite values instead of drawing them', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 400,
      height: 300,
      x: { type: 'band' },
      y: { min: 0, max: 100 },
      marks: [
        rectY(
          [
            { cat: 'a', value: Number.NaN },
            { cat: 'b', value: Number.POSITIVE_INFINITY },
            { cat: 'c', value: 30 },
          ],
          { x: 'cat', y: 'value' },
        ),
      ],
    });
    const rects = bars(svg, 'rect-y');
    expect(rects).toHaveLength(1);
    expect(rectAt(rects, 0).getAttribute('height')).not.toBe('NaN');
    expect(num(rectAt(rects, 0), 'height')).toBeGreaterThan(0);
    svg.remove();
  });

  it('every rect has a non-negative height and finite position', () => {
    const svg = makeSvg();
    fillPlot(svg, DATA);
    for (const r of bars(svg, 'rect-y')) {
      expect(num(r, 'height')).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(num(r, 'x'))).toBe(true);
      expect(Number.isFinite(num(r, 'y'))).toBe(true);
    }
    svg.remove();
  });

  it('empty data draws no rects and does not throw', () => {
    const svg = makeSvg();
    expect(() =>
      plot(svg, {
        width: 400,
        height: 300,
        x: { type: 'band' },
        y: { min: 0, max: 100 },
        marks: [rectY<Sales>([], { x: 'cat', y: 'value' })],
      }),
    ).not.toThrow();
    expect(bars(svg, 'rect-y')).toHaveLength(0);
    svg.remove();
  });
});

describe('rectX', () => {
  it('draws horizontal bars from the baseline to the value', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 400,
      height: 300,
      x: { min: 0, max: 100, nice: false },
      y: { type: 'band' },
      marks: [rectX(DATA, { x: 'value', y: 'cat' })],
    });
    const rects = bars(svg, 'rect-x');
    expect(rects).toHaveLength(3);
    for (const [i, d] of DATA.entries()) {
      const expected = (d.value / 100) * (400 - 40 - 16);
      expect(num(rectAt(rects, i), 'width')).toBeCloseTo(expected, 5);
      expect(num(rectAt(rects, i), 'x')).toBeCloseTo(0, 5);
      const yTop = ctx.y.position(d.cat);
      expect(num(rectAt(rects, i), 'y')).toBeCloseTo(yTop, 5);
      expect(num(rectAt(rects, i), 'height')).toBeCloseTo(ctx.y.bandwidth() * 0.9, 5);
    }
    svg.remove();
  });

  it('negative values extend left from the baseline', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 400,
      height: 300,
      x: { min: -100, max: 100, nice: false },
      y: { type: 'band' },
      marks: [rectX([{ cat: 'a', value: -40 }], { x: 'value', y: 'cat' })],
    });
    const rect = rectAt(bars(svg, 'rect-x'), 0);
    const innerWidth = 400 - 40 - 16;
    const zero = innerWidth / 2;
    expect(num(rect, 'x')).toBeLessThan(zero);
    expect(num(rect, 'width')).toBeCloseTo((40 / 200) * innerWidth, 5);
    svg.remove();
  });

  it('baseline 0 is in the x domain even with positive values', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 400,
      height: 300,
      x: { nice: false },
      y: { type: 'band' },
      marks: [rectX([{ cat: 'a', value: 25 }], { x: 'value', y: 'cat' })],
    });
    expect(ctx.x.domain[0]).toBe(0);
    svg.remove();
  });

  it('explicit height is used and accessor fill colours bars', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 400,
      height: 300,
      x: { min: 0, max: 100 },
      y: { type: 'band' },
      marks: [rectX(DATA, { x: 'value', y: 'cat', fill: 'cat', height: 8 })],
    });
    for (const r of bars(svg, 'rect-x')) {
      expect(num(r, 'height')).toBeCloseTo(8, 5);
      expect(r.getAttribute('fill')).toMatch(/^#/);
    }
    svg.remove();
  });

  it('empty data draws no rects', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 400,
      height: 300,
      x: { min: 0, max: 100 },
      y: { type: 'band' },
      marks: [rectX<Sales>([], { x: 'value', y: 'cat' })],
    });
    expect(bars(svg, 'rect-x')).toHaveLength(0);
    svg.remove();
  });
});
