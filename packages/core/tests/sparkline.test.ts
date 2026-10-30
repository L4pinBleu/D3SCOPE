// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { layoutSparkline, renderSparkline } from '../src/charts/sparkline.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const OPTS = { width: 100, height: 20, padding: 2 };

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('layoutSparkline', () => {
  it('spaces points evenly across the width, inside the padding', () => {
    const l = layoutSparkline([1, 2, 3], OPTS);
    expect(l.points.map((p) => p.x)).toEqual([2, 50, 98]);
  });

  it('maps the min to the bottom and the max to the top', () => {
    const l = layoutSparkline([10, 20, 30], OPTS);
    expect(l.points[0]?.y).toBeCloseTo(18);
    expect(l.points[2]?.y).toBeCloseTo(2);
  });

  it('centres a single value', () => {
    const l = layoutSparkline([5], OPTS);
    expect(l.points[0]?.x).toBe(50);
    expect(l.last?.value).toBe(5);
  });

  it('keeps a flat series in the middle instead of dividing by zero', () => {
    const l = layoutSparkline([4, 4, 4], OPTS);
    expect(l.points.every((p) => Number.isFinite(p.y))).toBe(true);
  });

  it('returns no path and no last point for empty data', () => {
    const l = layoutSparkline([], OPTS);
    expect(l.path).toBe('');
    expect(l.last).toBeUndefined();
  });

  it('closes the area at the bottom of the drawing', () => {
    const l = layoutSparkline([1, 2], OPTS);
    expect(l.areaPath.endsWith('Z')).toBe(true);
    expect(l.areaPath).toContain(',18 L2,18');
  });
});

describe('renderSparkline', () => {
  it('draws the line and a dot on the last value', () => {
    const svg = makeSvg();
    renderSparkline(svg, [1, 2, 3], OPTS);
    expect(svg.querySelector('path.line')?.getAttribute('d')).toMatch(/^M/);
    expect(svg.querySelectorAll('circle.last')).toHaveLength(1);
    expect(svg.querySelector('path.area')).toBeNull();
  });

  it('draws the area only when asked', () => {
    const svg = makeSvg();
    renderSparkline(svg, [1, 2, 3], { ...OPTS, area: true });
    expect(svg.querySelector('path.area')).not.toBeNull();
    renderSparkline(svg, [1, 2, 3], OPTS);
    expect(svg.querySelector('path.area')).toBeNull();
  });

  it('hides the last-value dot when disabled', () => {
    const svg = makeSvg();
    renderSparkline(svg, [1, 2], { ...OPTS, showLastPoint: false });
    expect(svg.querySelector('circle.last')).toBeNull();
  });

  it('sets the svg size and uses currentColor by default', () => {
    const svg = makeSvg();
    renderSparkline(svg, [1, 2], OPTS);
    expect(svg.getAttribute('width')).toBe('100');
    expect(svg.querySelector('path.line')?.getAttribute('stroke')).toBe('currentColor');
  });
});
