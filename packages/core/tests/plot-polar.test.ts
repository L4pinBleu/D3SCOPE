// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { LIGHT_THEME } from '../src/theme/index';
import { layoutPolarArea, niceMax, polarArea, polarPoint, radarChart } from '../src/plot/polar';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

describe('polarPoint', () => {
  it('puts the first axis straight above the centre', () => {
    const p = polarPoint(100, 100, 50, 0);
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(50);
  });
});

describe('niceMax', () => {
  it('rounds up to a nice number', () => {
    expect(niceMax(7)).toBe(10);
    expect(niceMax(23)).toBe(50);
    expect(niceMax(120)).toBe(200);
    expect(niceMax(0)).toBe(1);
  });
});

describe('radarChart', () => {
  const spec = {
    width: 300,
    height: 300,
    axes: ['speed', 'power', 'weight'],
    series: [
      { name: 'a', values: [3, 7, 5] },
      { name: 'b', values: [6, 2, 8] },
    ],
  };

  it('draws one polygon per series with as many points as axes', () => {
    const svg = makeSvg();
    radarChart(svg, spec);
    const polygons = svg.querySelectorAll<SVGPolygonElement>('polygon.d3s-radar-series');
    expect(polygons.length).toBe(2);
    for (const polygon of polygons) {
      expect(
        polygon
          .getAttribute('points')
          ?.trim()
          .split(/[\s,]+/).length,
      ).toBe(6);
    }
    svg.remove();
  });

  it('puts the first axis point straight above the centre', () => {
    const svg = makeSvg();
    radarChart(svg, spec);
    const polygon = svg.querySelector<SVGPolygonElement>('polygon.d3s-radar-series');
    const numbers = (polygon?.getAttribute('points') ?? '')
      .split(' ')
      .map((pair) => pair.split(',').map(Number));
    const first = numbers[0];
    expect(first?.[0]).toBeCloseTo(150);
    expect(first?.[1]).toBeLessThan(150);
    svg.remove();
  });

  it('clamps values above max to the outer grid', () => {
    const svg = makeSvg();
    radarChart(svg, { ...spec, max: 5, series: [{ name: 'a', values: [99, 0, 5] }] });
    const polygon = svg.querySelector<SVGPolygonElement>('polygon.d3s-radar-series');
    const numbers = (polygon?.getAttribute('points') ?? '')
      .split(' ')
      .map((pair) => pair.split(',').map(Number));
    // Grid radius: min(300, 300)/2 - 24 = 126, centred at (150, 150).
    expect(numbers[0]?.[1]).toBeCloseTo(150 - 126, 6);
    expect(numbers[1]?.[1]).toBeCloseTo(150);
    svg.remove();
  });

  it('draws exactly `levels` grid polygons', () => {
    const svg = makeSvg();
    radarChart(svg, { ...spec, levels: 6 });
    expect(svg.querySelectorAll('.d3s-radar-grid').length).toBe(6);
    expect(svg.querySelectorAll('.d3s-radar-axis').length).toBe(3);
    svg.remove();
  });

  it('draws axis labels with the axis name by default, and not with labels: false', () => {
    const svg = makeSvg();
    radarChart(svg, spec);
    const labels = [...svg.querySelectorAll<SVGTextElement>('text.d3s-radar-label')];
    expect(labels.length).toBe(3);
    expect(labels[0]?.textContent).toBe('speed');
    svg.remove();

    const svg2 = makeSvg();
    radarChart(svg2, { ...spec, labels: false });
    expect(svg2.querySelectorAll('.d3s-radar-label').length).toBe(0);
    svg2.remove();
  });

  it('throws a RangeError for a series of the wrong length', () => {
    const svg = makeSvg();
    expect(() => {
      radarChart(svg, { ...spec, series: [{ name: 'a', values: [1, 2] }] });
    }).toThrow(RangeError);
    svg.remove();
  });

  it('counts missing values in data-missing and draws them at the centre', () => {
    const svg = makeSvg();
    radarChart(svg, { ...spec, series: [{ name: 'a', values: [Number.NaN, Number.NaN, 3] }] });
    const polygon = svg.querySelector<SVGPolygonElement>('polygon.d3s-radar-series');
    expect(polygon?.getAttribute('data-missing')).toBe('2');
    svg.remove();
  });

  it('draws the legend only with color.legend', () => {
    const svg = makeSvg();
    radarChart(svg, spec);
    expect(svg.querySelector('.d3s-legend')).toBeNull();
    svg.remove();

    const svg2 = makeSvg();
    radarChart(svg2, { ...spec, color: { legend: true } });
    const legend = svg2.querySelector('.d3s-legend');
    expect(legend).not.toBeNull();
    expect(legend?.textContent).toContain('a');
    expect(legend?.textContent).toContain('b');
    svg2.remove();
  });

  it('gives each series its colour from the theme palette', () => {
    const svg = makeSvg();
    radarChart(svg, spec);
    const polygons = svg.querySelectorAll<SVGPolygonElement>('polygon.d3s-radar-series');
    expect(polygons[0]?.getAttribute('stroke')).toBe(LIGHT_THEME.palette[0]);
    expect(polygons[1]?.getAttribute('stroke')).toBe(LIGHT_THEME.palette[1]);
    svg.remove();
  });

  it('replaces the previous content and sets the size', () => {
    const svg = makeSvg();
    radarChart(svg, spec);
    radarChart(svg, spec);
    expect(svg.getAttribute('width')).toBe('300');
    expect(svg.getAttribute('height')).toBe('300');
    expect(svg.children.length).toBe(1);
    expect(svg.querySelectorAll('polygon.d3s-radar-series').length).toBe(2);
    svg.remove();
  });
});

describe('polarArea', () => {
  const spec = {
    width: 300,
    height: 300,
    data: [
      { label: 'a', value: 4 },
      { label: 'b', value: 1 },
      { label: 'c', value: 0 },
    ],
  };

  it('draws one sector per positive value, nothing for zero', () => {
    const svg = makeSvg();
    polarArea(svg, spec);
    const sectors = svg.querySelectorAll('.d3s-polar-sector');
    expect(sectors.length).toBe(2);
    expect(svg.querySelector('.d3s-polar-sector[fill="none"]')).toBeNull();
    svg.remove();
  });

  it('gives a value 4 twice the radius of a value 1 (sqrt scaling)', () => {
    const svg = makeSvg();
    polarArea(svg, spec);
    const paths = svg.querySelectorAll<SVGPathElement>('path.d3s-polar-sector');
    // radius = min(300, 300)/2 - 12 = 138, centred at (150, 150).
    const distances = [...paths].map((path) => {
      const d = path.getAttribute('d') ?? '';
      const m = /L([^ ]+)/.exec(d);
      const pair = m?.[1]?.split(',').map(Number) ?? [0, 0];
      const lx = pair[0] ?? 0;
      const ly = pair[1] ?? 0;
      return Math.hypot(lx - 150, ly - 150);
    });
    expect(
      distances[0] !== undefined && distances[1] !== undefined ? distances[0] / distances[1] : 0,
    ).toBeCloseTo(2, 3);
    svg.remove();
  });

  it('throws for a negative or non-finite value', () => {
    const svg = makeSvg();
    expect(() => {
      polarArea(svg, { ...spec, data: [{ label: 'x', value: -1 }] });
    }).toThrow(RangeError);
    expect(() => {
      polarArea(svg, { ...spec, data: [{ label: 'x', value: NaN }] });
    }).toThrow(RangeError);
    svg.remove();
  });

  it('colours differ per label', () => {
    const svg = makeSvg();
    polarArea(svg, spec);
    const paths = svg.querySelectorAll<SVGPathElement>('path.d3s-polar-sector');
    expect(paths[0]?.getAttribute('fill')).not.toBe(paths[1]?.getAttribute('fill'));
    svg.remove();
  });

  it('labels: false removes the label elements', () => {
    const svg = makeSvg();
    polarArea(svg, spec);
    const labels = svg.querySelectorAll<SVGTextElement>('text.d3s-polar-label');
    expect(labels.length).toBe(2);
    expect(labels[0]?.textContent).toBe('a');
    svg.remove();

    const svg2 = makeSvg();
    polarArea(svg2, { ...spec, labels: false });
    expect(svg2.querySelectorAll('.d3s-polar-label').length).toBe(0);
    svg2.remove();
  });

  it('replaces the previous content and sets the size', () => {
    const svg = makeSvg();
    polarArea(svg, spec);
    polarArea(svg, spec);
    expect(svg.getAttribute('width')).toBe('300');
    expect(svg.querySelectorAll('path.d3s-polar-sector').length).toBe(2);
    expect(svg.children.length).toBe(1);
    svg.remove();
  });
});

describe('layoutPolarArea', () => {
  it('computes the centre, radius and a nice default max', () => {
    const layout = layoutPolarArea({
      width: 300,
      height: 200,
      data: [
        { label: 'a', value: 23 },
        { label: 'b', value: 10 },
      ],
    });
    expect(layout.cx).toBe(150);
    expect(layout.cy).toBe(100);
    expect(layout.radius).toBe(88);
    expect(layout.max).toBe(50);
  });
});
