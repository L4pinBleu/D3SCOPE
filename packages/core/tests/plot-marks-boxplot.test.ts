// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { plot } from '../src/plot/plot';
import { boxPlot } from '../src/plot/marks/boxplot';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

/** Rows 1..9 for a category, plus optionally an extra value. */
function spread(
  category: string,
  values: (number | undefined)[],
): { c: string; v: number | undefined }[] {
  return values.map((v) => ({ c: category, v }));
}

describe('boxPlot statistics', () => {
  it('computes type-7 quartiles of a known set', () => {
    const rows = spread('a', [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const m = boxPlot(rows, { x: 'c', y: 'v' });
    expect(m.xValues?.()).toEqual(['a']);
    expect(m.yValues?.()).toEqual([1, 9]);
  });

  it('places one clear outlier beyond the upper whisker', () => {
    const rows = spread('a', [1, 2, 3, 4, 5, 6, 7, 8, 9, 100]);
    const m = boxPlot(rows, { x: 'c', y: 'v' });
    // Upper whisker at 9, outlier at 100, lower whisker at 1.
    expect(m.yValues?.()).toContain(9);
    expect(m.yValues?.()).toContain(100);
    expect(m.yValues?.()).toContain(1);
    expect(m.yValues?.()).toHaveLength(3);
  });

  it('a single-value category draws a degenerate box at that value', () => {
    const svg = makeSvg();
    const rows = [
      { c: 'a', v: 5 },
      { c: 'a', v: 5 },
    ];
    plot(svg, { width: 300, height: 200, marks: [boxPlot(rows, { x: 'c', y: 'v' })] });
    const rect = svg.querySelector('rect.d3s-box');
    expect(rect).not.toBeNull();
    expect(Number(rect?.getAttribute('height'))).toBe(0);
    // No whiskers and no outliers: the value is inside its own fences.
    expect(svg.querySelectorAll('line.d3s-whisker')).toHaveLength(0);
    expect(svg.querySelectorAll('circle.d3s-outlier')).toHaveLength(0);
    svg.remove();
  });
});

describe('boxPlot domains and filtering', () => {
  it('a category with no finite values draws nothing and stays out of the x domain', () => {
    const svg = makeSvg();
    const rows: { c: string; v: number | undefined }[] = [
      { c: 'empty', v: undefined },
      { c: 'full', v: 4 },
    ];
    const ctx = plot(svg, { width: 300, height: 200, marks: [boxPlot(rows, { x: 'c', y: 'v' })] });
    expect(ctx.x.domain).toEqual(['full']);
    expect(svg.querySelectorAll('rect.d3s-box')).toHaveLength(1);
    svg.remove();
  });

  it('the y domain covers the outlier', () => {
    const svg = makeSvg();
    const rows = spread('a', [1, 2, 3, 4, 5, 6, 7, 8, 9, 100]);
    const ctx = plot(svg, { width: 300, height: 200, marks: [boxPlot(rows, { x: 'c', y: 'v' })] });
    const numbers = ctx.y.domain.filter((d): d is number => typeof d === 'number');
    expect(Math.max(...numbers)).toBeGreaterThanOrEqual(100);
    svg.remove();
  });

  it('a row with a missing x is skipped everywhere', () => {
    const svg = makeSvg();
    const rows: { c: string; v: number | undefined }[] = [
      { c: 'a', v: 3 },
      { c: '', v: 10 },
      { c: 'b', v: 6 },
    ];
    const ctx = plot(svg, { width: 300, height: 200, marks: [boxPlot(rows, { x: 'c', y: 'v' })] });
    expect(ctx.x.domain).toEqual(['a', 'b']);
    expect(svg.querySelectorAll('rect.d3s-box')).toHaveLength(2);
    svg.remove();
  });
});

describe('boxPlot rendering', () => {
  it('draws a box, median, whiskers and an outlier centred in its band', () => {
    const svg = makeSvg();
    const rows = spread('only', [1, 2, 3, 4, 5, 6, 7, 8, 9, 100]);
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      margin: { left: 30, right: 30, top: 10, bottom: 20 },
      marks: [boxPlot(rows, { x: 'c', y: 'v' })],
    });
    const rect = svg.querySelector('rect.d3s-box');
    expect(rect).not.toBeNull();
    const cx = Number(rect?.getAttribute('x')) + Number(rect?.getAttribute('width')) / 2;
    const bandCentre = ctx.x.position('only') + ctx.x.bandwidth() / 2;
    expect(cx).toBeCloseTo(bandCentre, 6);
    expect(svg.querySelector('line.d3s-median')).not.toBeNull();
    expect(svg.querySelectorAll('line.d3s-whisker')).toHaveLength(2);
    const outliers = svg.querySelectorAll('circle.d3s-outlier');
    expect(outliers).toHaveLength(1);
    // The outlier circle sits at the outlier's y position, at the band centre.
    const circle = outliers[0] as SVGCircleElement;
    expect(Number(circle.getAttribute('cx'))).toBeCloseTo(bandCentre, 6);
    expect(Number(circle.getAttribute('cy'))).toBeCloseTo(ctx.y.position(100), 6);
    svg.remove();
  });

  it('clamps the width fraction and uses the given fill', () => {
    const svg = makeSvg();
    const rows = spread('a', [1, 2, 3, 4, 5]);
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [boxPlot(rows, { x: 'c', y: 'v', fill: '#123456', width: 5 })],
    });
    const rect = svg.querySelector('rect.d3s-box');
    expect(rect?.getAttribute('fill')).toBe('#123456');
    expect(Number(rect?.getAttribute('width'))).toBeLessThanOrEqual(ctx.x.bandwidth());
    expect(Number(rect?.getAttribute('width'))).toBeGreaterThan(0);
    svg.remove();
  });
});
