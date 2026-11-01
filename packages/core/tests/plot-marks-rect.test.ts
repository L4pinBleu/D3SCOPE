// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { plot } from '../src/plot/plot';
import { rectX, rectY } from '../src/plot/marks/rect';
import { LIGHT_THEME } from '../src/theme/index';
import type { Mark } from '../src/plot/types';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

interface Row {
  name: string;
  value: number;
  kind: string;
}

const rows: Row[] = [
  { name: 'a', value: 10, kind: 'x' },
  { name: 'b', value: 20, kind: 'y' },
  { name: 'c', value: 30, kind: 'x' },
];

function bars(svg: SVGSVGElement): SVGRectElement[] {
  return [...svg.querySelectorAll<SVGRectElement>('.d3s-layer.d3s-rect rect')];
}

/** The i-th item of a list; throws when it is missing, so tests fail loudly. */
function nth<T>(xs: readonly T[], i: number): T {
  const v = xs[i];
  if (v === undefined) throw new Error(`missing item ${String(i)}`);
  return v;
}

describe('rectY', () => {
  it('draws one rect per row, spanning its band, on a band x axis', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [rectY(rows, { x: 'name', y: 'value' })],
    });
    const rects = bars(svg);
    expect(rects).toHaveLength(3);
    const band = ctx.x.bandwidth();
    expect(band).toBeGreaterThan(0);
    expect(ctx.x.position('a')).not.toBeNaN();
    rects.forEach((r, i) => {
      const row = nth(rows, i);
      const x = Number(r.getAttribute('x'));
      expect(x).toBeCloseTo(ctx.x.position(row.name), 5);
      expect(Number(r.getAttribute('width'))).toBeCloseTo(band, 5);
      expect(Number(r.getAttribute('height'))).toBeGreaterThan(0);
      expect(r.classList.contains('d3s-bar')).toBe(true);
    });
    svg.remove();
  });

  it('keeps the baseline in the domain of a linear y axis', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      x: { type: 'linear' },
      marks: [rectY(rows, { x: (r) => r.value, y: (r) => r.value })],
    });
    expect(ctx.y.domain).toContain(0);
    expect(bars(svg)).toHaveLength(3);
    svg.remove();
  });

  it('centres bars on their x position with barWidth on a linear x axis', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      x: { type: 'linear' },
      marks: [rectY(rows, { x: 'value', y: 'value', barWidth: 8 })],
    });
    const rects = bars(svg);
    const r = nth(rects, 1);
    expect(Number(r.getAttribute('width'))).toBe(8);
    const center = Number(r.getAttribute('x')) + 4;
    expect(center).toBeCloseTo(ctx.x.position(20), 5);
    svg.remove();
  });

  it('draws a bar going down from the baseline for a negative value', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [rectY([{ name: 'a', value: -5, kind: 'x' }], { x: 'name', y: 'value' })],
    });
    const r = nth(bars(svg), 0);
    const top = Number(r.getAttribute('y'));
    const height = Number(r.getAttribute('height'));
    expect(top).toBeCloseTo(ctx.y.position(0), 5);
    expect(top + height).toBeCloseTo(ctx.y.position(-5), 5);
    svg.remove();
  });

  it('colours bars by category, one distinct colour per category', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 300,
      height: 200,
      marks: [rectY(rows, { x: 'name', y: 'value', fill: 'kind' })],
    });
    const fills = bars(svg).map((r) => r.getAttribute('fill'));
    expect(fills[0]).toBe(fills[2]);
    expect(fills[0]).not.toBe(fills[1]);
    expect(fills[0]).toBe(LIGHT_THEME.palette[0]);
    svg.remove();
  });

  it('applies a literal fill to every bar', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 300,
      height: 200,
      marks: [rectY(rows, { x: 'name', y: 'value', fill: '#123456' })],
    });
    for (const r of bars(svg)) expect(r.getAttribute('fill')).toBe('#123456');
    svg.remove();
  });

  it('uses the fill function when given one', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 300,
      height: 200,
      marks: [
        rectY(rows, { x: 'name', y: 'value', fill: (r) => (r.value > 15 ? '#111' : '#222') }),
      ],
    });
    const fills = bars(svg).map((r) => r.getAttribute('fill'));
    expect(fills).toEqual(['#222', '#111', '#111']);
    svg.remove();
  });

  it('skips rows with a missing or NaN value', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 300,
      height: 200,
      marks: [
        rectY(
          [
            { name: 'a', value: 10, kind: 'x' },
            { name: 'b', value: Number.NaN, kind: 'x' },
            { name: 'c', value: 30, kind: 'x' },
          ],
          { x: 'name', y: 'value' },
        ),
      ],
    });
    const rects = bars(svg);
    expect(rects).toHaveLength(2);
    expect(rects.map((r) => Number(r.getAttribute('x'))).filter(Number.isFinite)).toHaveLength(2);
    svg.remove();
  });

  it('draws nothing for empty rows', () => {
    const svg = makeSvg();
    plot(svg, { width: 300, height: 200, marks: [rectY([], { x: 'name', y: 'value' })] });
    expect(bars(svg)).toHaveLength(0);
    svg.remove();
  });
});

describe('rectX', () => {
  it('draws horizontal bars, with the baseline in the x domain', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [rectX(rows, { x: 'value', y: 'name' })],
    });
    const rects = bars(svg);
    expect(rects).toHaveLength(3);
    expect(ctx.x.domain).toContain(0);
    const band = ctx.y.bandwidth();
    expect(band).toBeGreaterThan(0);
    rects.forEach((r, i) => {
      const row = nth(rows, i);
      expect(Number(r.getAttribute('height'))).toBeCloseTo(band, 5);
      expect(Number(r.getAttribute('width'))).toBeCloseTo(
        ctx.x.position(row.value) - ctx.x.position(0),
        5,
      );
      expect(Number(r.getAttribute('y'))).toBeCloseTo(ctx.y.position(row.name), 5);
    });
    svg.remove();
  });

  it('declares y as the category axis and x as the value axis', () => {
    const mark: Mark = rectX(rows, { x: 'value', y: 'name' });
    expect(mark.yValues?.()).toEqual(rows.map((r) => r.name));
    expect(mark.xValues?.()).toEqual([...rows.map((r) => r.value), 0]);
  });
});
