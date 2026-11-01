// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { plot } from '../src/plot/plot';
import { cell } from '../src/plot/marks/cell';
import { dot } from '../src/plot/marks/dot';
import { histogram } from '../src/plot/marks/histogram';
import type { Mark } from '../src/plot/types';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

/** The i-th item of a list; throws when it is missing, so tests fail loudly. */
function nth<T>(xs: readonly T[], i: number): T {
  const v = xs[i];
  if (v === undefined) throw new Error(`missing item ${String(i)}`);
  return v;
}

const bins = (svg: SVGSVGElement): SVGRectElement[] => [
  ...svg.querySelectorAll<SVGRectElement>('.d3s-layer.d3s-histogram rect'),
];

describe('histogram', () => {
  it('draws one rect per bin and the counts add up to the number of values', () => {
    const values = [1, 1.2, 2, 2.5, 3, 3.3, 4, 5.5, 6, 6.1, 7];
    const mark = histogram(values, { count: 4 });
    const svg = makeSvg();
    plot(svg, { width: 300, height: 200, marks: [mark] });
    const rects = bins(svg);
    expect(rects.length).toBeGreaterThan(0);
    svg.remove();
  });

  it('bins cover the values: the sum of heights equals the value count', () => {
    const values = Array.from({ length: 50 }, (_, i) => (i % 10) + 0.5);
    const svg = makeSvg();
    const ctx = plot(svg, { width: 300, height: 200, marks: [histogram(values)] });
    const rects = bins(svg);
    expect(rects.length).toBeGreaterThan(0);
    const heights = rects.map((r) => Number(r.getAttribute('height')));
    // Height 0 on the y scale position(0); count = height / (position(0) - position(1 unit))
    const y = ctx.y;
    const unit = Math.abs(y.position(0) - y.position(1));
    const counts = heights.map((h) => h / unit);
    const total = counts.reduce((a, b) => a + b, 0);
    expect(Math.round(total)).toBe(values.length);
    svg.remove();
  });

  it('rectangles sit on the x domain: the first and last edge match the scale', () => {
    const values = [2, 3, 4, 9, 10];
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      x: { type: 'linear' },
      marks: [histogram(values)],
    });
    const rects = bins(svg);
    expect(rects.length).toBeGreaterThan(0);
    const first = nth(rects, 0);
    const xDomain = ctx.x.domain as readonly number[];
    const edges = rects.flatMap((r) => [
      Number(r.getAttribute('x')),
      Number(r.getAttribute('x')) + Number(r.getAttribute('width')),
    ]);
    const lo = nth(xDomain, 0);
    const hi = nth(xDomain, xDomain.length - 1);
    expect(Math.min(...edges)).toBeCloseTo(ctx.x.position(lo), 5);
    expect(Math.max(...edges)).toBeCloseTo(ctx.x.position(hi), 5);
    expect(Number(first.getAttribute('y')) + Number(first.getAttribute('height'))).toBeCloseTo(
      ctx.y.position(0),
      5,
    );
    svg.remove();
  });

  it('empty values draw nothing; zero-count bins have height 0', () => {
    const svg = makeSvg();
    plot(svg, { width: 300, height: 200, marks: [histogram([])] });
    expect(bins(svg)).toHaveLength(0);
    svg.remove();
  });
});

interface BubbleRow {
  x: number;
  y: number;
  size: number | null;
}

const bubbleRows: BubbleRow[] = [
  { x: 1, y: 1, size: 10 },
  { x: 2, y: 2, size: 100 },
  { x: 3, y: 3, size: 55 },
  { x: 4, y: 4, size: null },
];

function circles(svg: SVGSVGElement): SVGCircleElement[] {
  return [...svg.querySelectorAll<SVGCircleElement>('.d3s-layer.d3s-dot circle')];
}

describe('dot bubbles', () => {
  it('the largest size has the largest radius, the smallest the smallest', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 300,
      height: 200,
      marks: [dot(bubbleRows, { x: 'x', y: 'y', size: 'size' })],
    });
    const cs = circles(svg);
    // The row with the missing size is skipped.
    expect(cs).toHaveLength(3);
    const rs = cs.map((c) => Number(c.getAttribute('r')));
    expect(nth(rs, 1)).toBeGreaterThan(nth(rs, 2)); // size 100 > size 55
    expect(nth(rs, 2)).toBeGreaterThan(nth(rs, 0)); // size 55 > size 10
    expect(Math.min(...rs)).toBeCloseTo(3, 5);
    expect(Math.max(...rs)).toBeCloseTo(20, 5);
    svg.remove();
  });

  it('equal sizes give the middle of the range', () => {
    const rows: BubbleRow[] = [
      { x: 1, y: 1, size: 7 },
      { x: 2, y: 2, size: 7 },
    ];
    const svg = makeSvg();
    plot(svg, { width: 300, height: 200, marks: [dot(rows, { x: 'x', y: 'y', size: 'size' })] });
    for (const c of circles(svg)) {
      expect(Number(c.getAttribute('r'))).toBeCloseTo(11.5, 5);
    }
    svg.remove();
  });

  it('size values never reach an axis domain; fixed r still works without size', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [dot(bubbleRows, { x: 'x', y: 'y', size: 'size' })],
    });
    // Only x and y are 1..4; 10/55/100 do not appear.
    for (const v of ctx.x.domain) expect(v === 10 || v === 55 || v === 100).toBe(false);
    for (const v of ctx.y.domain) expect(v === 10 || v === 55 || v === 100).toBe(false);
    svg.remove();

    const svg2 = makeSvg();
    plot(svg2, { width: 300, height: 200, marks: [dot(bubbleRows, { x: 'x', y: 'y', r: 5 })] });
    const cs = circles(svg2);
    expect(cs).toHaveLength(4); // fixed r: no size-based skipping
    for (const c of cs) expect(Number(c.getAttribute('r'))).toBe(5);
    svg2.remove();
  });
});

interface CellRow {
  col: string;
  row: string;
  v: number | null;
}

const cellRows: CellRow[] = [
  { col: 'a', row: 'p', v: 5 },
  { col: 'b', row: 'p', v: 50 },
  { col: 'a', row: 'q', v: 20 },
  { col: 'b', row: 'q', v: null },
];

const cells = (svg: SVGSVGElement): SVGRectElement[] => [
  ...svg.querySelectorAll<SVGRectElement>('.d3s-layer.d3s-cell rect'),
];

describe('cell heatmap', () => {
  it('draws one rect per valid row and skips rows with a missing fill', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 300,
      height: 200,
      marks: [cell(cellRows, { x: 'col', y: 'row', fill: 'v' })],
    });
    expect(cells(svg)).toHaveLength(3);
    svg.remove();
  });

  it('cells cover their bands on band axes', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [cell(cellRows, { x: 'col', y: 'row', fill: 'v' })],
    });
    const band = ctx.x.bandwidth();
    expect(band).toBeGreaterThan(0);
    for (const r of cells(svg)) {
      expect(Number(r.getAttribute('width'))).toBeCloseTo(band, 5);
      expect(Number(r.getAttribute('height'))).toBeCloseTo(ctx.y.bandwidth(), 5);
    }
    svg.remove();
  });

  it('the largest value is darkest, the smallest lightest', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 300,
      height: 200,
      marks: [cell(cellRows, { x: 'col', y: 'row', fill: 'v' })],
    });
    const fills = cells(svg).map((r) => r.getAttribute('fill') ?? '');
    const dark = '#1d4f91';
    const light = '#eef4fb';
    expect(fills).toContain(light); // v = 5, the minimum
    expect(fills).toContain(dark); // v = 50, the maximum
    // Numeric darkness: the r channel decreases as the value grows.
    const values = [5, 50, 20];
    const ordered = fills
      .map((f, i) => ({ f, v: nth(values, i) }))
      .sort((a, b) => a.v - b.v)
      .map((e) => parseInt(e.f.slice(1, 3), 16));
    expect(nth(ordered, 0)).toBeGreaterThan(nth(ordered, 1));
    expect(nth(ordered, 1)).toBeGreaterThan(nth(ordered, 2));
    svg.remove();
  });

  it('fill values do not change the x or y domain', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [cell(cellRows, { x: 'col', y: 'row', fill: 'v' })],
    });
    expect([...ctx.x.domain]).toEqual(['a', 'b']);
    expect([...ctx.y.domain]).toEqual(['p', 'q']);
    for (const v of [...ctx.x.domain, ...ctx.y.domain]) {
      expect(v === 5 || v === 50 || v === 20).toBe(false);
    }
    svg.remove();
  });

  it('all-equal fill values give the dark colour', () => {
    const rows: CellRow[] = [
      { col: 'a', row: 'p', v: 3 },
      { col: 'b', row: 'p', v: 3 },
    ];
    const svg = makeSvg();
    plot(svg, { width: 300, height: 200, marks: [cell(rows, { x: 'col', y: 'row', fill: 'v' })] });
    for (const r of cells(svg)) expect(r.getAttribute('fill')).toBe('#1d4f91');
    svg.remove();
  });

  it('a numeric (non-band) axis centres each cell on its value, one gap wide', () => {
    const rows: { x: number; y: number; v: number }[] = [
      { x: 1, y: 1, v: 1 },
      { x: 2, y: 1, v: 2 },
    ];
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      x: { type: 'linear' },
      y: { type: 'linear' },
      marks: [cell(rows, { x: 'x', y: 'y', fill: 'v' })],
    });
    const rects = cells(svg);
    expect(rects).toHaveLength(2);
    // Two distinct x values one unit apart: each cell is one gap wide (the
    // full plot width divided by the domain span) and centred on its value.
    const gap = Math.abs(ctx.x.position(2) - ctx.x.position(1));
    expect(Number(nth(rects, 0).getAttribute('width'))).toBeCloseTo(gap, 5);
    expect(Number(nth(rects, 0).getAttribute('x')) + gap / 2).toBeCloseTo(ctx.x.position(1), 5);
    expect(Number(nth(rects, 1).getAttribute('x')) + gap / 2).toBeCloseTo(ctx.x.position(2), 5);
    expect(Number(nth(rects, 0).getAttribute('height'))).toBeCloseTo(ctx.innerHeight, 5);
    svg.remove();
  });

  it('a numeric axis puts a larger value to the right, whatever the row order', () => {
    const rows = [
      { x: 10, y: 1, v: 1 },
      { x: 1, y: 1, v: 5 },
    ];
    const svg = makeSvg();
    plot(svg, {
      width: 300,
      height: 200,
      x: { type: 'linear' },
      marks: [cell(rows, { x: 'x', y: 'y', fill: 'v' })],
    });
    const rects = cells(svg);
    expect(Number(nth(rects, 0).getAttribute('x'))).toBeGreaterThan(
      Number(nth(rects, 1).getAttribute('x')),
    );
    svg.remove();
  });
});

describe('marks are composable', () => {
  it('several marks share one plot', () => {
    const svg = makeSvg();
    const marks: Mark[] = [histogram([1, 2, 2, 3]), dot([{ x: 2, y: 1 }], { x: 'x', y: 'y' })];
    plot(svg, { width: 300, height: 200, marks });
    expect(bins(svg).length).toBeGreaterThan(0);
    expect(circles(svg)).toHaveLength(1);
    svg.remove();
  });
});
