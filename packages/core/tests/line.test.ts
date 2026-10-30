// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  areaPath,
  layoutLineChart,
  linePath,
  nearestPointIndex,
  renderLineChart,
  type TimePoint,
} from '../src/charts/line.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DATA: TimePoint[] = [
  { date: new Date('2026-01-01T00:00:00Z'), value: 10 },
  { date: new Date('2026-01-03T00:00:00Z'), value: 30 },
  { date: new Date('2026-01-02T00:00:00Z'), value: 20 },
];
const OPTS = { width: 340, height: 228, margin: { top: 10, right: 10, bottom: 30, left: 40 } };

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('linePath / areaPath', () => {
  it('builds M then L commands with 2-decimal rounding', () => {
    expect(
      linePath([
        { x: 0, y: 1.234 },
        { x: 10.004, y: 2 },
      ]),
    ).toBe('M0,1.23 L10,2');
  });

  it('returns an empty string for no points', () => {
    expect(linePath([])).toBe('');
    expect(areaPath([], 100)).toBe('');
  });

  it('closes the area down to the baseline', () => {
    expect(
      areaPath(
        [
          { x: 0, y: 5 },
          { x: 10, y: 6 },
        ],
        100,
      ),
    ).toBe('M0,5 L10,6 L10,100 L0,100 Z');
  });
});

describe('nearestPointIndex', () => {
  const xs = [{ x: 0 }, { x: 10 }, { x: 20 }];

  it('returns -1 when empty', () => {
    expect(nearestPointIndex([], 5)).toBe(-1);
  });

  it('finds the nearest point on both sides and at the ends', () => {
    expect(nearestPointIndex(xs, 4)).toBe(0);
    expect(nearestPointIndex(xs, 6)).toBe(1);
    expect(nearestPointIndex(xs, -100)).toBe(0);
    expect(nearestPointIndex(xs, 100)).toBe(2);
  });

  it('prefers the left point on an exact tie', () => {
    expect(nearestPointIndex(xs, 5)).toBe(0);
  });
});

describe('layoutLineChart', () => {
  it('sorts points by date and maps them to pixels', () => {
    const l = layoutLineChart(DATA, OPTS);
    expect(l.points.map((p) => p.value)).toEqual([10, 20, 30]);
    expect(l.innerWidth).toBe(290);
    expect(l.innerHeight).toBe(188);
    // first date at x = 0, last date at the right edge of the plot
    expect(l.points[0]?.x).toBeCloseTo(0);
    expect(l.points[2]?.x).toBeCloseTo(290);
  });

  it('puts the largest value at the top of the plot', () => {
    const l = layoutLineChart(DATA, OPTS);
    expect(l.points[2]?.y).toBeLessThan(l.points[0]?.y ?? 0);
    expect(l.points[2]?.y).toBeCloseTo(0);
  });

  it('builds the line path, and an area path that ends at the plot bottom', () => {
    const l = layoutLineChart(DATA, OPTS);
    expect(l.path.startsWith('M')).toBe(true);
    expect(l.areaPath.endsWith(`L0,${String(l.innerHeight)} Z`)).toBe(true);
  });

  it('handles empty data without throwing', () => {
    const l = layoutLineChart([], OPTS);
    expect(l.points).toHaveLength(0);
    expect(l.path).toBe('');
  });

  it('does not mutate the input array', () => {
    const copy = [...DATA];
    layoutLineChart(DATA, OPTS);
    expect(DATA).toEqual(copy);
  });
});

describe('renderLineChart', () => {
  it('draws the line path and both axes', () => {
    const svg = makeSvg();
    renderLineChart(svg, DATA, OPTS);
    const line = svg.querySelector('path.line');
    expect(line?.getAttribute('d')).toMatch(/^M/);
    expect(svg.querySelector('g.x-axis')).not.toBeNull();
    expect(svg.querySelector('g.y-axis')).not.toBeNull();
    expect(svg.querySelector('path.area')).toBeNull();
  });

  it('draws an area when asked, and removes it when turned off', () => {
    const svg = makeSvg();
    renderLineChart(svg, DATA, { ...OPTS, area: true });
    expect(svg.querySelector('path.area')).not.toBeNull();
    renderLineChart(svg, DATA, OPTS);
    expect(svg.querySelector('path.area')).toBeNull();
  });

  it('updates the line in place on redraw', () => {
    const svg = makeSvg();
    renderLineChart(svg, DATA, OPTS);
    renderLineChart(svg, DATA.slice(0, 2), OPTS);
    expect(svg.querySelectorAll('path.line')).toHaveLength(1);
    expect(svg.querySelector('path.line')?.getAttribute('d')?.split('L')).toHaveLength(2);
  });

  it('has no crosshair or tooltip by default', () => {
    const svg = makeSvg();
    renderLineChart(svg, DATA, OPTS);
    expect(svg.querySelector('g.d3scope-tooltip')).toBeNull();
    const cross = svg.querySelector<SVGGElement>('g.crosshair');
    expect(cross?.style.display).toBe('none');
  });

  it('on hover, shows the crosshair and tooltip at the nearest point', () => {
    const svg = makeSvg();
    renderLineChart(svg, DATA, { ...OPTS, tooltip: true });
    const overlay = svg.querySelector<SVGRectElement>('rect.overlay');
    // Plot x = 290 (right edge) → last point (value 30), pointer in client coords.
    overlay?.dispatchEvent(new MouseEvent('mousemove', { clientX: 290, clientY: 0 }));

    const cross = svg.querySelector<SVGGElement>('g.crosshair');
    expect(cross?.style.display).toBe('');
    expect(cross?.getAttribute('transform')).toBe('translate(290,0)');
    const text = svg.querySelector('g.d3scope-tooltip text')?.textContent;
    expect(text).toContain('2026-01-03');
    expect(text).toContain('30');
  });

  it('hides the crosshair and tooltip on mouseleave', () => {
    const svg = makeSvg();
    renderLineChart(svg, DATA, { ...OPTS, tooltip: true });
    const overlay = svg.querySelector<SVGRectElement>('rect.overlay');
    overlay?.dispatchEvent(new MouseEvent('mousemove', { clientX: 0, clientY: 0 }));
    overlay?.dispatchEvent(new MouseEvent('mouseleave'));
    expect(svg.querySelector<SVGGElement>('g.crosshair')?.style.display).toBe('none');
    expect(svg.querySelector<SVGGElement>('g.d3scope-tooltip')?.style.display).toBe('none');
  });

  it('uses a custom format callback', () => {
    const svg = makeSvg();
    renderLineChart(svg, DATA, {
      ...OPTS,
      tooltip: { format: (p) => ({ lines: [`${p.value.toFixed(1)} €`] }) },
    });
    svg
      .querySelector('rect.overlay')
      ?.dispatchEvent(new MouseEvent('mousemove', { clientX: 0, clientY: 0 }));
    expect(svg.querySelector('g.d3scope-tooltip text')?.textContent).toContain('10.0 €');
  });

  it('calls onPointClick with the nearest point on click', () => {
    const svg = makeSvg();
    const onPointClick = vi.fn();
    renderLineChart(svg, DATA, { ...OPTS, onPointClick });
    svg
      .querySelector('rect.overlay')
      ?.dispatchEvent(new MouseEvent('click', { clientX: 0, clientY: 0 }));
    expect(onPointClick).toHaveBeenCalledOnce();
    const [point] = onPointClick.mock.calls[0] as [TimePoint];
    expect(point.value).toBe(10);
  });
});
