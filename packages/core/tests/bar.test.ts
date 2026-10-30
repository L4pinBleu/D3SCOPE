// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { layoutBarChart, renderBarChart, type BarDatum } from '../src/charts/bar.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DATA: BarDatum[] = [
  { label: 'Jan', value: 10 },
  { label: 'Feb', value: 20 },
  { label: 'Mar', value: 5 },
];
const OPTS = { width: 400, height: 300, margin: { top: 10, right: 10, bottom: 30, left: 40 } };

function makeSvg(): SVGSVGElement {
  const svg: SVGSVGElement = document.createElementNS(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

describe('layoutBarChart', () => {
  it('computes the plot size from the margins', () => {
    const l = layoutBarChart(DATA, OPTS);
    expect(l.innerWidth).toBe(350);
    expect(l.innerHeight).toBe(260);
  });

  it('scales bar heights to the largest value', () => {
    const l = layoutBarChart(DATA, { ...OPTS, padding: 0 });
    // domain [0, 20] maps to [260, 0]: 20 is full height, 10 is half
    expect(l.bars[1]?.height).toBeCloseTo(260);
    expect(l.bars[0]?.height).toBeCloseTo(130);
    expect(l.bars[2]?.height).toBeCloseTo(65);
  });

  it('places bars left to right, one band per category', () => {
    const l = layoutBarChart(DATA, { ...OPTS, padding: 0 });
    expect(l.bars.map((b) => b.x)).toEqual([0, 350 / 3, (2 * 350) / 3]);
    expect(l.bars[0]?.width).toBeCloseTo(350 / 3);
  });

  it('grows negative values below the zero line', () => {
    const l = layoutBarChart(
      [
        { label: 'gain', value: 10 },
        { label: 'loss', value: -10 },
      ],
      { ...OPTS, padding: 0 },
    );
    const gain = l.bars[0];
    const loss = l.bars[1];
    expect(gain?.y).toBeLessThan(l.zeroY);
    expect(loss?.y).toBeCloseTo(l.zeroY);
    expect(loss?.height).toBeGreaterThan(0);
    expect(loss ? loss.y + loss.height : 0).toBeGreaterThan(l.zeroY);
  });

  it('uses per-datum colours and falls back to the chart colour', () => {
    const l = layoutBarChart(
      [
        { label: 'a', value: 1, color: '#ff0000' },
        { label: 'b', value: 2 },
      ],
      { ...OPTS, color: '#00ff00' },
    );
    expect(l.bars.map((b) => b.color)).toEqual(['#ff0000', '#00ff00']);
  });

  it('rejects duplicate category labels', () => {
    expect(() =>
      layoutBarChart(
        [
          { label: 'a', value: 1 },
          { label: 'a', value: 2 },
        ],
        OPTS,
      ),
    ).toThrow(RangeError);
  });

  it('handles empty data and collapsed sizes', () => {
    const empty = layoutBarChart([], OPTS);
    expect(empty.bars).toEqual([]);
    const tiny = layoutBarChart(DATA, { width: 10, height: 10 });
    expect(tiny.innerWidth).toBe(0);
    expect(tiny.innerHeight).toBe(0);
  });
});

describe('renderBarChart', () => {
  it('draws one rect per datum, with the bar geometry', () => {
    const svg = makeSvg();
    renderBarChart(svg, DATA, OPTS);
    const rects = svg.querySelectorAll('rect.bar');
    expect(rects.length).toBe(3);
    expect(rects[1]?.getAttribute('fill')).toBe('#4a9eed');
  });

  it('draws both axes', () => {
    const svg = makeSvg();
    renderBarChart(svg, DATA, OPTS);
    expect(svg.querySelector('g.x-axis .tick text')?.textContent).toBe('Jan');
    expect(svg.querySelectorAll('g.y-axis .tick').length).toBeGreaterThan(1);
  });

  it('updates bars in place on redraw (keyed by label)', () => {
    const svg = makeSvg();
    renderBarChart(svg, DATA, OPTS);
    const before = svg.querySelector('rect.bar');
    renderBarChart(
      svg,
      [
        { label: 'Jan', value: 40 },
        { label: 'Feb', value: 20 },
      ],
      OPTS,
    );
    expect(svg.querySelectorAll('rect.bar').length).toBe(2);
    expect(svg.querySelector('rect.bar')).toBe(before);
  });

  it('sizes the svg element from the options', () => {
    const svg = makeSvg();
    renderBarChart(svg, DATA, OPTS);
    expect(svg.getAttribute('width')).toBe('400');
    expect(svg.getAttribute('height')).toBe('300');
  });
});
