// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { plot } from '../src/plot/plot';
import { rectX, rectY } from '../src/plot/marks/rect';
import { cssVar, LIGHT_THEME } from '../src/theme/index';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

/** The i-th bar of the plot, or a failure when it is absent. */
function bar(svg: SVGSVGElement, i: number): SVGRectElement {
  const r = svg.querySelectorAll<SVGRectElement>('rect.d3s-bar')[i];
  if (r === undefined) throw new Error(`no bar with index ${String(i)}`);
  return r;
}

function bars(svg: SVGSVGElement): SVGRectElement[] {
  return [...svg.querySelectorAll<SVGRectElement>('rect.d3s-bar')];
}

function num(el: SVGElement, attr: string): number {
  return Number(el.getAttribute(attr));
}

/** The i-th element of `a`, or a failure when it is absent. */
function at<T>(a: readonly T[], i: number): T {
  const v = a[i];
  if (v === undefined) throw new Error(`missing element ${String(i)}`);
  return v;
}

const ACCENT = cssVar('accent', LIGHT_THEME.accent);

interface Row {
  c: string;
  s: string;
  v: number | undefined;
}

describe('rectY stacked bars', () => {
  it('stacks positive segments and the y domain covers the total', () => {
    const svg = makeSvg();
    const rows: Row[] = [
      { c: 'a', s: 'x', v: 2 },
      { c: 'a', s: 'y', v: 3 },
    ];
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [rectY(rows, { x: 'c', y: 'v', stack: { series: 's' } })],
    });
    expect(bars(svg)).toHaveLength(2);
    const zero = ctx.y.position(0);
    // First segment: from 0 up to 2.
    expect(num(bar(svg, 0), 'y')).toBeCloseTo(ctx.y.position(2), 6);
    expect(num(bar(svg, 0), 'height')).toBeCloseTo(zero - ctx.y.position(2), 6);
    // Second segment: from 2 up to 5.
    expect(num(bar(svg, 1), 'y')).toBeCloseTo(ctx.y.position(5), 6);
    expect(num(bar(svg, 1), 'height')).toBeCloseTo(ctx.y.position(2) - ctx.y.position(5), 6);
    expect(bar(svg, 0).getAttribute('data-series')).toBe('x');
    expect(bar(svg, 1).getAttribute('data-series')).toBe('y');
    expect(ctx.y.domain).toContain(5);
    svg.remove();
  });

  it('stacks negative segments downwards and the domain covers the negative total', () => {
    const svg = makeSvg();
    const rows: Row[] = [
      { c: 'a', s: 'x', v: -2 },
      { c: 'a', s: 'y', v: -3 },
    ];
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [rectY(rows, { x: 'c', y: 'v', stack: { series: 's' } })],
    });
    expect(bars(svg)).toHaveLength(2);
    expect(num(bar(svg, 0), 'y')).toBeCloseTo(ctx.y.position(0), 6);
    expect(num(bar(svg, 0), 'height')).toBeCloseTo(ctx.y.position(-2) - ctx.y.position(0), 6);
    expect(num(bar(svg, 1), 'y')).toBeCloseTo(ctx.y.position(-2), 6);
    expect(num(bar(svg, 1), 'height')).toBeCloseTo(ctx.y.position(-5) - ctx.y.position(-2), 6);
    expect(Number(at([...ctx.y.domain], 0))).toBeLessThanOrEqual(-5);
    expect(ctx.y.domain).toContain(0);
    svg.remove();
  });

  it('positive and negative segments never overlap and the domain covers both totals', () => {
    const svg = makeSvg();
    const rows: Row[] = [
      { c: 'a', s: 'x', v: 2 },
      { c: 'a', s: 'y', v: 3 },
      { c: 'a', s: 'z', v: -1 },
      { c: 'a', s: 'w', v: -4 },
    ];
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [rectY(rows, { x: 'c', y: 'v', stack: { series: 's' } })],
    });
    const rects = bars(svg);
    expect(rects).toHaveLength(4);
    const tops = rects.slice(0, 2);
    const bottoms = rects.slice(2);
    for (const b of tops) expect(num(b, 'y')).toBeLessThanOrEqual(ctx.y.position(0));
    for (const b of bottoms) {
      expect(num(b, 'y') + num(b, 'height')).toBeGreaterThanOrEqual(ctx.y.position(0));
    }
    const yValues = ctx.y.domain.map(Number);
    expect(Math.min(...yValues)).toBeLessThanOrEqual(-5);
    expect(Math.max(...yValues)).toBeGreaterThanOrEqual(5);
    svg.remove();
  });

  it('normalize makes each category end at 1 and the domain spans 0..1', () => {
    const svg = makeSvg();
    const rows: Row[] = [
      { c: 'a', s: 'x', v: 2 },
      { c: 'a', s: 'y', v: 6 },
      { c: 'b', s: 'x', v: 1 },
      { c: 'b', s: 'y', v: 1 },
    ];
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [rectY(rows, { x: 'c', y: 'v', stack: { series: 's' }, normalize: true })],
    });
    expect(bars(svg)).toHaveLength(4);
    // stackY orders by series first, then category: a-x, b-x, a-y, b-y.
    // The last segment of each category ends at 1.
    expect(num(bar(svg, 2), 'y')).toBeCloseTo(ctx.y.position(1), 6);
    expect(num(bar(svg, 3), 'y')).toBeCloseTo(ctx.y.position(1), 6);
    const yValues = ctx.y.domain.map(Number);
    expect(Math.max(...yValues)).toBeGreaterThanOrEqual(1);
    expect(Math.min(...yValues)).toBeLessThanOrEqual(0);
    svg.remove();
  });

  it('colors differ per series and a missing series falls back to the accent', () => {
    const svg = makeSvg();
    const rows = [
      { c: 'a', s: 'x', v: 2 },
      { c: 'a', s: 'y', v: 3 },
      { c: 'a', s: undefined as unknown as string, v: 1 },
    ];
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [rectY(rows, { x: 'c', y: 'v', stack: { series: 's' } })],
    });
    const fills = bars(svg).map((r) => r.getAttribute('fill'));
    expect(fills).toHaveLength(3);
    expect(at(fills, 0)).not.toBe(at(fills, 1));
    expect(at(fills, 2)).toBe(ACCENT);
    expect(ctx.color.domain).toEqual(['x', 'y']);
    svg.remove();
  });
});

describe('rectY grouped bars', () => {
  it('puts the bars of one category side by side with equal widths and no overlap', () => {
    const svg = makeSvg();
    const rows: Row[] = [
      { c: 'a', s: 'x', v: 2 },
      { c: 'a', s: 'y', v: 3 },
      { c: 'a', s: 'z', v: 4 },
    ];
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [rectY(rows, { x: 'c', y: 'v', group: { series: 's' } })],
    });
    const rects = bars(svg).map((r) => ({ x: num(r, 'x'), w: num(r, 'width') }));
    expect(rects).toHaveLength(3);
    const widths = rects.map((b) => b.w);
    const firstWidth = at(widths, 0);
    expect(firstWidth).toBeGreaterThan(1);
    for (const w of widths) expect(w).toBeCloseTo(firstWidth, 6);
    const sorted = [...rects].sort((a, b) => a.x - b.x);
    for (let i = 1; i < sorted.length; i++) {
      const prev = at(sorted, i - 1);
      expect(at(sorted, i).x).toBeGreaterThanOrEqual(prev.x + prev.w);
    }
    // All bars sit inside their category's band.
    const last = sorted[sorted.length - 1];
    if (last === undefined) throw new Error('no bars');
    expect(last.x + last.w).toBeLessThanOrEqual(ctx.x.position('a') + ctx.x.bandwidth());
    svg.remove();
  });

  it('colors grouped bars by series', () => {
    const svg = makeSvg();
    const rows: Row[] = [
      { c: 'a', s: 'x', v: 2 },
      { c: 'a', s: 'y', v: 3 },
    ];
    plot(svg, {
      width: 300,
      height: 200,
      marks: [rectY(rows, { x: 'c', y: 'v', group: { series: 's' } })],
    });
    const fills = bars(svg).map((r) => r.getAttribute('fill'));
    expect(fills).toHaveLength(2);
    expect(at(fills, 0)).not.toBe(at(fills, 1));
    svg.remove();
  });
});

describe('rectX grouped bars', () => {
  it('draws horizontal grouped bars side by side with equal heights', () => {
    const svg = makeSvg();
    const rows: Row[] = [
      { c: 'a', s: 'x', v: 2 },
      { c: 'a', s: 'y', v: 3 },
    ];
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [rectX(rows, { x: 'v', y: 'c', group: { series: 's' } })],
    });
    const rects = bars(svg).map((r) => ({ y: num(r, 'y'), h: num(r, 'height') }));
    expect(rects).toHaveLength(2);
    expect(at(rects, 0).h).toBeCloseTo(at(rects, 1).h, 6);
    const sorted = [...rects].sort((a, b) => a.y - b.y);
    expect(at(sorted, 1).y).toBeGreaterThanOrEqual(at(sorted, 0).y + at(sorted, 0).h);
    expect(ctx.x.domain).toContain(3);
    svg.remove();
  });
});

describe('missing values', () => {
  it('a stacked bar with a missing value is skipped and does not change the domain', () => {
    const svg = makeSvg();
    const rows: Row[] = [
      { c: 'a', s: 'x', v: 2 },
      { c: 'a', s: 'y', v: 3 },
      { c: 'a', s: 'z', v: undefined },
    ];
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [rectY(rows, { x: 'c', y: 'v', stack: { series: 's' } })],
    });
    expect(bars(svg)).toHaveLength(2);
    expect(ctx.y.domain).toContain(5);
    expect(Number(at([...ctx.y.domain], 1))).toBeLessThanOrEqual(5.0001);
    svg.remove();
  });

  it('a grouped bar with a missing value is skipped and the widths stay equal', () => {
    const svg = makeSvg();
    const rows: Row[] = [
      { c: 'a', s: 'x', v: 2 },
      { c: 'a', s: 'y', v: 3 },
      { c: 'a', s: 'z', v: Number.NaN },
    ];
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [rectY(rows, { x: 'c', y: 'v', group: { series: 's' } })],
    });
    const rects = bars(svg);
    expect(rects).toHaveLength(2);
    expect(num(at(rects, 0), 'width')).toBeCloseTo(num(at(rects, 1), 'width'), 6);
    // Two series are present, so the band is split in two, not in three.
    expect(num(at(rects, 0), 'width')).toBeCloseTo(ctx.x.bandwidth() / 2 - 2, 6);
    svg.remove();
  });
});
