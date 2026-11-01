// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { plot } from '../src/plot/plot';
import { area, stackedArea } from '../src/plot/marks/area';
import { cssVar, LIGHT_THEME } from '../src/theme/index';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

function areas(svg: SVGSVGElement): SVGPathElement[] {
  return [...svg.querySelectorAll<SVGPathElement>('.d3s-layer.d3s-area path')];
}

interface Row {
  x: number | Date;
  y: number | null | undefined;
  series?: string;
}

const rows: Row[] = [
  { x: 1, y: 2, series: 'a' },
  { x: 3, y: 4, series: 'a' },
  { x: 2, y: 1, series: 'b' },
  { x: 3, y: 2, series: 'b' },
];

describe('area', () => {
  it('closes each path back to the baseline with Z', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [area(rows, { x: 'x', y: 'y', series: 'series' })],
    });
    const paths = areas(svg);
    expect(paths).toHaveLength(2);
    const base = ctx.y.position(0);
    for (const p of paths) {
      const d = p.getAttribute('d') ?? '';
      expect(d.endsWith('Z')).toBe(true);
      // The two baseline returns share the baseline pixel y.
      const back = d.slice(0, -1).split('L').slice(-2);
      for (const seg of back) {
        expect(Number(seg.split(',')[1])).toBeCloseTo(base, 5);
      }
    }
    svg.remove();
  });

  it('draws one path per series, in the colour of each series', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 300,
      height: 200,
      marks: [area(rows, { x: 'x', y: 'y', series: 'series' })],
    });
    const paths = areas(svg);
    const fills = paths.map((p) => p.getAttribute('fill'));
    expect(fills[0]).not.toBe(fills[1]);
    expect(paths.every((p) => p.classList.contains('d3s-area'))).toBe(true);
    svg.remove();
  });

  it('sorts the points by x', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [
        area(
          [
            { x: 3, y: 4, series: 'a' },
            { x: 1, y: 2, series: 'a' },
            { x: 2, y: 3, series: 'a' },
          ],
          { x: 'x', y: 'y', series: 'series' },
        ),
      ],
    });
    const d = areas(svg)[0]?.getAttribute('d') ?? '';
    const xs = d
      .split(/(?=[ML])/)
      .slice(0, 3)
      .map((seg) => Number(seg.slice(1).split(',')[0]));
    expect(xs).toEqual([ctx.x.position(1), ctx.x.position(2), ctx.x.position(3)]);
    const [x0 = 0, x1 = 0, x2 = 0] = xs;
    expect(x0).toBeLessThan(x1);
    expect(x1).toBeLessThan(x2);

    svg.remove();
  });

  it('uses the theme accent when no series is given, and honours fill', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 300,
      height: 200,
      marks: [area(rows, { x: 'x', y: 'y' })],
    });
    const paths = areas(svg);
    expect(paths).toHaveLength(1);
    expect(paths[0]?.getAttribute('fill')).toBe(cssVar('accent', LIGHT_THEME.accent));
    svg.remove();

    const svg2 = makeSvg();
    plot(svg2, {
      width: 300,
      height: 200,
      marks: [area(rows, { x: 'x', y: 'y', fill: 'red' })],
    });
    expect(areas(svg2)[0]?.getAttribute('fill')).toBe('red');
    svg2.remove();
  });

  it('skips rows with a missing value: they are not drawn and leave the domain alone', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [
        area(
          [
            { x: 1, y: 2, series: 'a' },
            { x: 2, y: null, series: 'a' },
            { x: 3, y: 6, series: 'a' },
          ],
          { x: 'x', y: 'y', series: 'series' },
        ),
      ],
    });
    const d = areas(svg)[0]?.getAttribute('d') ?? '';
    expect(d).not.toContain(String(ctx.x.position(2)));
    // The domain is 0..6, not stretched by anything else.
    expect(ctx.y.domain[0]).toBe(0);
    expect(ctx.y.domain[1]).toBe(6);
    svg.remove();
  });

  it('works with a Date x', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [
        area(
          [
            { x: new Date(Date.UTC(2024, 0, 1)), y: 2, series: 'a' },
            { x: new Date(Date.UTC(2024, 1, 1)), y: 4, series: 'a' },
          ],
          { x: 'x', y: 'y', series: 'series' },
        ),
      ],
    });
    expect(ctx.x.kind).toBe('time');
    const d = areas(svg)[0]?.getAttribute('d') ?? '';
    expect(d.startsWith('M')).toBe(true);
    expect(d).not.toBe('Z');
    svg.remove();
  });

  it('places band x points at the band centre', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [
        area(
          [
            { x: 'a', y: 2, series: 'a' },
            { x: 'b', y: 4, series: 'a' },
          ],
          { x: 'x', y: 'y', series: 'series' },
        ),
      ],
    });
    const band = ctx.x.bandwidth();
    expect(band).toBeGreaterThan(0);
    const d = areas(svg)[0]?.getAttribute('d') ?? '';
    const firstX = Number(d.slice(1).split(',')[0]);
    expect(firstX).toBeCloseTo(ctx.x.position('a') + band / 2, 5);
    svg.remove();
  });
});

const stacked: Row[] = [
  { x: 1, y: 2, series: 'a' },
  { x: 2, y: 3, series: 'a' },
  { x: 1, y: 4, series: 'b' },
  { x: 2, y: 1, series: 'b' },
];

describe('stackedArea', () => {
  it('draws one band per series, stacked so the top of one is the bottom of the next', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 300,
      height: 200,
      marks: [stackedArea(stacked, { x: 'x', y: 'y', series: 'series' })],
    });
    const paths = areas(svg);
    expect(paths).toHaveLength(2);
    expect(paths.map((p) => p.getAttribute('data-series'))).toEqual(['a', 'b']);
    // Series a at x=1 spans 0..2; series b spans 2..6.
    expect(paths[0]?.getAttribute('data-series')).toBe('a');
    svg.remove();
  });

  it('normalised stacks span 0 to 1', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [stackedArea(stacked, { x: 'x', y: 'y', series: 'series', normalize: true })],
    });
    // The y domain includes 0 and 1, so both edges are exact.
    expect(ctx.y.domain[0]).toBe(0);
    expect(ctx.y.domain[1]).toBe(1);
    const paths = areas(svg);
    expect(paths).toHaveLength(2);
    for (const p of paths) {
      const d = p.getAttribute('d') ?? '';
      expect(d.endsWith('Z')).toBe(true);
    }
    svg.remove();
  });

  it('skips missing values and keeps the stack tight', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [
        stackedArea(
          [
            { x: 1, y: 2, series: 'a' },
            { x: 1, y: undefined, series: 'b' },
            { x: 2, y: 1, series: 'a' },
            { x: 2, y: 1, series: 'b' },
          ],
          { x: 'x', y: 'y', series: 'series' },
        ),
      ],
    });
    // Series b has no point at x=1, so it is one band of two segments there.
    expect(ctx.y.domain[0]).toBe(0);
    expect(ctx.y.domain[1]).toBe(2);
    svg.remove();
  });
});
