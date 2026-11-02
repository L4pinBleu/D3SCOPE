// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { countOutside, createPlotScale, plot } from '../src/plot/index';
import type { Mark, PlotContext, Primitive } from '../src/plot/types';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

/** A mark that only declares its values and records the context it was given. */
function probe(xs?: readonly Primitive[], ys?: readonly Primitive[]): Mark & { ctx?: PlotContext } {
  const m: Mark & { ctx?: PlotContext } = {
    name: 'probe',
    render(ctx) {
      m.ctx = ctx;
    },
  };
  if (xs) m.xValues = () => xs;
  if (ys) m.yValues = () => ys;
  return m;
}

describe('log axis options', () => {
  it('generates decade ticks by default', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      y: { type: 'log', min: 1, max: 1000 },
      marks: [probe(undefined, [10, 100])],
    });
    expect(ctx.y.ticks(10)).toEqual([1, 10, 100, 1000]);
    svg.remove();
  });

  it('honours a base option (default 10)', () => {
    const s = createPlotScale('log', [1, 64], [0, 100], { nice: false, base: 2 });
    expect(s.ticks(10)).toEqual([1, 2, 4, 8, 16, 32, 64]);
    const s10 = createPlotScale('log', [1, 64], [0, 100], { nice: false });
    expect(s10.ticks(10)).toEqual([1, 10]);
  });

  it('adds minor ticks inside the decades when minorTicks is set', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      y: { type: 'log', min: 10, max: 1000, minorTicks: true, ticks: 10 },
      marks: [probe(undefined, [50, 500])],
    });
    const ticks = ctx.y.ticks(10) as number[];
    for (const v of [20, 30, 90, 200, 900]) expect(ticks).toContain(v);
    expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
    expect(ticks).not.toContain(15); // 1.5 × 10¹ is not a whole multiple of the base
    // The drawn axis shows the same ticks.
    const labels = [...svg.querySelectorAll('.d3s-axis-y .tick text')].map((n) => n.textContent);
    expect(labels).toHaveLength(ticks.length);
    svg.remove();
  });

  it('keeps decade-only ticks without minorTicks', () => {
    const s = createPlotScale('log', [10, 1000], [0, 100], { nice: false });
    expect(s.ticks(10)).toEqual([10, 100, 1000]);
  });

  it('rejects a domain with values <= 0 with a clear RangeError', () => {
    const svg = makeSvg();
    expect(() =>
      plot(svg, {
        width: 300,
        height: 200,
        y: { type: 'log' },
        marks: [probe(undefined, [0, 10])],
      }),
    ).toThrow(/logScale: domain must be strictly positive/);
    svg.remove();
  });

  it('rounds the domain to whole decades with nice', () => {
    const s = createPlotScale('log', [3, 700], [0, 100], {});
    expect(s.domain).toEqual([1, 1000]);
  });

  it('supports reverse', () => {
    const s = createPlotScale('log', [1, 1000], [0, 100], { nice: false, reverse: true });
    expect(s.position(1)).toBeCloseTo(100);
    expect(s.position(1000)).toBeCloseTo(0);
  });

  it('supports position on the y axis', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      y: { type: 'log', min: 1, max: 1000, position: 'right' },
      marks: [probe(undefined, [10, 100])],
    });
    expect(svg.querySelector('.d3s-axis-y')?.getAttribute('transform')).toBe(
      `translate(${String(ctx.innerWidth)},0)`,
    );
    svg.remove();
  });

  it('draws gridlines at the ticks', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      y: { type: 'log', min: 1, max: 1000, grid: true, ticks: 10 },
      marks: [probe(undefined, [10, 100])],
    });
    const lines = svg.querySelectorAll('.d3s-grid-y line');
    expect(lines).toHaveLength(ctx.y.ticks(10).length);
    expect(lines.length).toBeGreaterThan(0);
    svg.remove();
  });
});

describe('time axis options', () => {
  it('accepts min and max as Dates', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      x: {
        type: 'time',
        min: new Date(Date.UTC(2026, 0, 1)),
        max: new Date(Date.UTC(2026, 3, 1)),
        nice: false,
      },
      marks: [probe([new Date(Date.UTC(2026, 1, 1))])],
    });
    expect(ctx.x.domain).toEqual([new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 3, 1))]);
    svg.remove();
  });

  it('accepts min and max as ISO strings', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      x: { type: 'time', min: '2026-01-01T00:00:00Z', max: '2026-04-01T00:00:00Z', nice: false },
      marks: [probe([new Date(Date.UTC(2026, 1, 1))])],
    });
    expect(ctx.x.domain).toEqual([new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 3, 1))]);
    svg.remove();
  });

  it('gives tickFormat the tick values as Dates', () => {
    const svg = makeSvg();
    const seen: Primitive[] = [];
    plot(svg, {
      width: 400,
      height: 200,
      x: {
        type: 'time',
        min: '2026-01-01T00:00:00Z',
        max: '2026-04-01T00:00:00Z',
        nice: false,
        tickFormat: (v) => {
          seen.push(v);
          return '·';
        },
      },
      marks: [probe([new Date(Date.UTC(2026, 1, 1))])],
    });
    expect(seen.length).toBeGreaterThan(0);
    for (const v of seen) expect(v instanceof Date).toBe(true);
    svg.remove();
  });

  it('rounds the time domain outward to whole local days or larger units with nice', () => {
    const from = new Date(Date.UTC(2026, 0, 15));
    const to = new Date(Date.UTC(2026, 2, 20));
    const s = createPlotScale('time', [from, to], [0, 100], { nice: true });
    const domain = s.domain as Date[];
    const lo = domain[0];
    const hi = domain[1];
    if (lo === undefined || hi === undefined) throw new Error('expected two domain bounds');
    // The domain covers the data...
    expect(lo.getTime()).toBeLessThanOrEqual(from.getTime());
    expect(hi.getTime()).toBeGreaterThanOrEqual(to.getTime());
    // ...and ends on local midnight, whatever the timezone of the machine.
    expect(lo.getHours()).toBe(0);
    expect(hi.getHours()).toBe(0);
  });

  it('supports reverse', () => {
    const t0 = new Date(Date.UTC(2026, 0, 1));
    const t1 = new Date(Date.UTC(2026, 3, 1));
    const s = createPlotScale('time', [t0, t1], [0, 100], { nice: false, reverse: true });
    expect(s.position(t0)).toBeCloseTo(100);
    expect(s.position(t1)).toBeCloseTo(0);
  });

  it('supports position on the y axis', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      y: { type: 'time', position: 'right', nice: false },
      marks: [probe(undefined, [new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 2, 1))])],
    });
    expect(svg.querySelector('.d3s-axis-y')?.getAttribute('transform')).toBe(
      `translate(${String(ctx.innerWidth)},0)`,
    );
    svg.remove();
  });

  it('draws gridlines at the ticks', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 500,
      height: 200,
      x: { type: 'time', grid: true, nice: false },
      marks: [probe([new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 3, 1))])],
    });
    const lines = svg.querySelectorAll('.d3s-grid-x line');
    expect(lines).toHaveLength(ctx.x.ticks(5).length);
    expect(lines.length).toBeGreaterThan(0);
    svg.remove();
  });

  it('counts values outside ISO-string bounds', () => {
    expect(
      countOutside([new Date(Date.UTC(2026, 0, 15))], {
        min: '2026-02-01T00:00:00Z',
        max: '2026-03-01T00:00:00Z',
      }),
    ).toBe(1);
  });
});
