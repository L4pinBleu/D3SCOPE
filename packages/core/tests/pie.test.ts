// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  arcPath,
  layoutPie,
  layoutPieChart,
  PIE_PALETTE,
  renderPieChart,
  type PieDatum,
} from '../src/charts/pie.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DATA: PieDatum[] = [
  { label: 'A', value: 1 },
  { label: 'B', value: 1 },
  { label: 'C', value: 2 },
];
const OPTS = { width: 200, height: 200 };

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('layoutPie', () => {
  it('splits the full circle by value share, clockwise from 12 o’clock', () => {
    const slices = layoutPie(DATA);
    expect(slices.map((s) => s.share)).toEqual([0.25, 0.25, 0.5]);
    expect(slices[0]?.startAngle).toBeCloseTo(0);
    expect(slices[0]?.endAngle).toBeCloseTo(Math.PI / 2);
    expect(slices[2]?.endAngle).toBeCloseTo(Math.PI * 2);
  });

  it('uses the palette by index unless a colour is given', () => {
    const slices = layoutPie([
      { label: 'x', value: 1 },
      { label: 'y', value: 1, color: '#000' },
    ]);
    expect(slices[0]?.color).toBe(PIE_PALETTE[0]);
    expect(slices[1]?.color).toBe('#000');
  });

  it('gives zero shares when everything is zero', () => {
    const slices = layoutPie([{ label: 'a', value: 0 }]);
    expect(slices[0]?.share).toBe(0);
    expect(slices[0]?.endAngle).toBe(0);
  });

  it('rejects negative or non-finite values', () => {
    expect(() => layoutPie([{ label: 'a', value: -1 }])).toThrow(RangeError);
    expect(() => layoutPie([{ label: 'a', value: Number.NaN }])).toThrow(RangeError);
  });
});

describe('arcPath', () => {
  it('draws a wedge from the centre for a pie', () => {
    const d = arcPath(0, Math.PI / 2, 0, 10);
    expect(d.startsWith('M0,0 L')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
  });

  it('draws an annular sector for a donut', () => {
    const d = arcPath(0, Math.PI / 2, 5, 10);
    expect(d.match(/A/g)).toHaveLength(2);
    expect(d.startsWith('M')).toBe(true);
  });

  it('marks arcs over half a turn as large', () => {
    expect(arcPath(0, Math.PI * 1.5, 0, 10)).toMatch(/ 0 1 1 /);
    expect(arcPath(0, Math.PI / 2, 0, 10)).toMatch(/ 0 0 1 /);
  });

  it('splits a full circle into two arcs so it still renders', () => {
    const d = arcPath(0, Math.PI * 2, 0, 10);
    expect(d.match(/A/g)).toHaveLength(2);
  });

  it('returns an empty path for zero-width slices', () => {
    expect(arcPath(1, 1, 0, 10)).toBe('');
  });
});

describe('layoutPieChart', () => {
  it('centres the pie and uses half the smaller side as the radius', () => {
    const l = layoutPieChart(DATA, { width: 300, height: 200 });
    expect(l.cx).toBe(150);
    expect(l.cy).toBe(100);
    expect(l.outerRadius).toBe(96);
    expect(l.innerRadius).toBe(0);
  });

  it('clamps the inner radius to the outer radius', () => {
    const l = layoutPieChart(DATA, { ...OPTS, innerRadius: 500 });
    expect(l.innerRadius).toBe(l.outerRadius);
  });
});

describe('renderPieChart', () => {
  it('draws one path per slice, centred in the svg', () => {
    const svg = makeSvg();
    renderPieChart(svg, DATA, OPTS);
    const paths = svg.querySelectorAll('path.slice');
    expect(paths).toHaveLength(3);
    expect(svg.querySelector('g.pie-chart')?.getAttribute('transform')).toBe('translate(100,100)');
  });

  it('updates slices in place when redrawn with the same labels', () => {
    const svg = makeSvg();
    renderPieChart(svg, DATA, OPTS);
    renderPieChart(svg, DATA.slice(0, 2), OPTS);
    expect(svg.querySelectorAll('path.slice')).toHaveLength(2);
  });

  it('has no tooltip by default', () => {
    const svg = makeSvg();
    renderPieChart(svg, DATA, OPTS);
    svg.querySelector('path.slice')?.dispatchEvent(new MouseEvent('mouseenter'));
    expect(svg.querySelector('g.d3scope-tooltip')).toBeNull();
  });

  it('shows value and share in the tooltip on hover', () => {
    const svg = makeSvg();
    renderPieChart(svg, DATA, { ...OPTS, tooltip: true });
    svg.querySelectorAll('path.slice').item(2).dispatchEvent(new MouseEvent('mouseenter'));
    const texts = Array.from(svg.querySelectorAll('g.d3scope-tooltip tspan')).map(
      (t) => t.textContent,
    );
    expect(texts).toEqual(['C', '2 (50.0 %)']);
  });

  it('uses a custom format callback', () => {
    const svg = makeSvg();
    renderPieChart(svg, DATA, {
      ...OPTS,
      tooltip: { format: (s) => ({ lines: [`${s.label}!`] }) },
    });
    svg.querySelector('path.slice')?.dispatchEvent(new MouseEvent('mouseenter'));
    expect(svg.querySelector('g.d3scope-tooltip text')?.textContent).toContain('A!');
  });

  it('calls onSliceClick with the slice', () => {
    const svg = makeSvg();
    const onSliceClick = vi.fn();
    renderPieChart(svg, DATA, { ...OPTS, onSliceClick });
    svg.querySelectorAll('path.slice').item(0).dispatchEvent(new MouseEvent('click'));
    const [slice] = onSliceClick.mock.calls[0] as [{ label: string }];
    expect(slice.label).toBe('A');
  });
});
