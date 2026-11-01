import { describe, expect, it } from 'vitest';
import { bin, dodge, niceBinWidth, normalizeStack, stackY } from '../src/plot/transforms';

interface R {
  c: string;
  s: string;
  v: number;
}
const acc = {
  x: (r: R) => r.c,
  y: (r: R) => r.v,
  series: (r: R) => r.s,
};

describe('stackY', () => {
  it('stacks series upwards per category, in order of first appearance', () => {
    const rows: R[] = [
      { c: 'a', s: 'p', v: 2 },
      { c: 'a', s: 'q', v: 3 },
      { c: 'b', s: 'p', v: 1 },
    ];
    const out = stackY(rows, acc);
    expect(out.map((s) => [s.x, s.series, s.y0, s.y1])).toEqual([
      ['a', 'p', 0, 2],
      ['b', 'p', 0, 1],
      ['a', 'q', 2, 5],
    ]);
  });

  it('stacks negative values downwards, so they never overlap positive ones', () => {
    const rows: R[] = [
      { c: 'a', s: 'p', v: 2 },
      { c: 'a', s: 'q', v: -3 },
    ];
    const out = stackY(rows, acc);
    expect(out[0]).toMatchObject({ y0: 0, y1: 2 });
    expect(out[1]).toMatchObject({ y0: -3, y1: 0 });
  });

  it('ignores non-finite values', () => {
    const rows: R[] = [
      { c: 'a', s: 'p', v: Number.NaN },
      { c: 'a', s: 'q', v: 4 },
    ];
    expect(stackY(rows, acc)).toHaveLength(1);
  });

  it('keeps Date and number categories apart from text that looks like them', () => {
    const rows = [
      { x: 1, s: 'p', v: 1 },
      { x: '1', s: 'p', v: 2 },
    ];
    const out = stackY(rows, { x: (r) => r.x, y: (r) => r.v, series: (r) => r.s });
    expect(out.map((s) => s.y1)).toEqual([1, 2]);
  });
});

describe('normalizeStack', () => {
  it('divides each category by its total, so segments add up to 1', () => {
    const out = normalizeStack(
      stackY(
        [
          { c: 'a', s: 'p', v: 1 },
          { c: 'a', s: 'q', v: 3 },
        ],
        acc,
      ),
    );
    expect(out[1]?.y1).toBeCloseTo(1);
    expect(out[0]?.y1).toBeCloseTo(0.25);
  });

  it('gives an empty category zero segments', () => {
    const out = normalizeStack(stackY([{ c: 'a', s: 'p', v: 0 }], acc));
    expect(out[0]).toMatchObject({ y0: 0, y1: 0 });
  });
});

describe('dodge', () => {
  it('gives each bar of a category its own slot, and the category its count', () => {
    const rows: R[] = [
      { c: 'a', s: 'p', v: 1 },
      { c: 'a', s: 'q', v: 1 },
      { c: 'b', s: 'q', v: 1 },
    ];
    expect(dodge(rows, acc)).toEqual([
      { index: 0, slot: 0, slots: 2 },
      { index: 1, slot: 1, slots: 2 },
      { index: 2, slot: 0, slots: 1 },
    ]);
  });

  it('skips rows without a finite value', () => {
    const rows: R[] = [
      { c: 'a', s: 'p', v: Number.NaN },
      { c: 'a', s: 'q', v: 1 },
    ];
    expect(dodge(rows, acc)).toEqual([{ index: 1, slot: 0, slots: 1 }]);
  });
});

describe('bin', () => {
  it('uses nice bin widths of 1, 2 or 5 times a power of ten', () => {
    expect(niceBinWidth(10, 5)).toBe(2);
    expect(niceBinWidth(1, 4)).toBe(0.5);
    expect(niceBinWidth(100, 10)).toBe(10);
    expect(niceBinWidth(0, 5)).toBe(1);
  });

  it('puts every value in a bin, with edges on the nice width', () => {
    const values = [1, 2, 2, 3, 7, 8, 9, 10];
    const bins = bin(values, { count: 5 });
    expect(bins.reduce((n, b) => n + b.values.length, 0)).toBe(values.length);
    expect(bins[0]?.x0).toBe(0);
    for (const b of bins) expect(b.x1 - b.x0).toBeCloseTo(bins[0]?.x1 ?? 0);
  });

  it('puts the maximum in the last bin', () => {
    const bins = bin([0, 5, 10], { count: 2 });
    expect(bins.at(-1)?.values).toContain(10);
  });

  it('ignores non-finite values and returns nothing for empty input', () => {
    expect(bin([Number.NaN, 1, 2], { count: 2 }).reduce((n, b) => n + b.values.length, 0)).toBe(2);
    expect(bin([])).toEqual([]);
  });

  it('uses Sturges count by default', () => {
    const bins = bin(Array.from({ length: 16 }, (_, i) => i));
    expect(bins.length).toBeGreaterThanOrEqual(2);
    expect(bins.length).toBeLessThanOrEqual(8);
  });
});
