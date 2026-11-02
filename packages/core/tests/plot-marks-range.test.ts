// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { plot } from '../src/plot/plot';
import { rangeX, rangeY } from '../src/plot/marks/range';
import { cssVar, LIGHT_THEME } from '../src/theme/index';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

const ACCENT = cssVar('accent', LIGHT_THEME.accent);

describe('rangeY', () => {
  it('spans exactly the position of its two values and the full inner width', () => {
    const svg = makeSvg();
    const rows = [
      { lo: 10, hi: 40 },
      { lo: 60, hi: 80 },
    ];
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [rangeY(rows, { from: 'lo', to: 'hi' })],
    });
    const rects = svg.querySelectorAll('rect.d3s-range');
    expect(rects).toHaveLength(2);
    for (let i = 0; i < 2; i++) {
      const rect = rects[i];
      const row = rows[i];
      if (!rect || !row) throw new Error('missing rect or row');
      const top = ctx.y.position(Math.max(row.lo, row.hi));
      const bottom = ctx.y.position(Math.min(row.lo, row.hi));
      expect(Number(rect.getAttribute('y'))).toBeCloseTo(top, 6);
      expect(Number(rect.getAttribute('height'))).toBeCloseTo(bottom - top, 6);
      expect(rect.getAttribute('x')).toBe('0');
      expect(Number(rect.getAttribute('width'))).toBe(ctx.innerWidth);
    }
    svg.remove();
  });

  it('from > to gives the same rectangle as to > from', () => {
    const svg = makeSvg();
    const marks = [rangeY([{ lo: 10, hi: 40 }], { from: 'lo', to: 'hi' })];
    plot(svg, { width: 300, height: 200, marks });
    const y1 = svg.querySelector('rect.d3s-range')?.getAttribute('y');
    const h1 = svg.querySelector('rect.d3s-range')?.getAttribute('height');
    svg.remove();
    const svg2 = makeSvg();
    plot(svg2, {
      width: 300,
      height: 200,
      marks: [rangeY([{ lo: 40, hi: 10 }], { from: 'lo', to: 'hi' })],
    });
    const rect2 = svg2.querySelector('rect.d3s-range');
    expect(rect2?.getAttribute('y')).toBe(y1);
    expect(rect2?.getAttribute('height')).toBe(h1);
    svg2.remove();
  });

  it('draws a zero-height rectangle when from equals to, without an error', () => {
    const svg = makeSvg();
    expect(() =>
      plot(svg, {
        width: 300,
        height: 200,
        marks: [rangeY([{ lo: 5, hi: 5 }], { from: 'lo', to: 'hi' })],
      }),
    ).not.toThrow();
    const rect = svg.querySelector('rect.d3s-range');
    expect(Number(rect?.getAttribute('height'))).toBe(0);
    svg.remove();
  });

  it('a missing to is skipped and does not change the y domain', () => {
    const svg = makeSvg();
    const rows = [
      { lo: 10, hi: 40 },
      { lo: 5, hi: undefined as unknown as number },
      { lo: null as unknown as number, hi: 3 },
    ];
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [rangeY(rows, { from: 'lo', to: 'hi' })],
    });
    expect(svg.querySelectorAll('rect.d3s-range')).toHaveLength(1);
    // Only the plottable band's bounds reach the domain: no NaN, no 5 from the skipped row.
    expect(ctx.y.domain.every((d) => Number.isFinite(Number(d)))).toBe(true);
    expect(ctx.y.domain.map(Number)).not.toContain(5);
    svg.remove();
  });

  it('draws the label inside the band as text, never parsed as HTML', () => {
    const svg = makeSvg();
    const rows = [{ lo: 10, hi: 40, name: '<b>spec</b>' }];
    plot(svg, {
      width: 300,
      height: 200,
      marks: [rangeY(rows, { from: 'lo', to: 'hi', label: 'name' })],
    });
    const text = svg.querySelector('text.d3s-range-label');
    expect(text).not.toBeNull();
    expect(text?.textContent).toBe('<b>spec</b>');
    expect(svg.querySelector('text.d3s-range-label b')).toBeNull();
    svg.remove();
  });

  it('defaults to the accent fill and 0.15 opacity, and honours a custom fill and opacity', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 300,
      height: 200,
      marks: [rangeY([{ lo: 1, hi: 2 }], { from: 'lo', to: 'hi' })],
    });
    let rect = svg.querySelector('rect.d3s-range');
    expect(rect?.getAttribute('fill')).toBe(ACCENT);
    expect(rect?.getAttribute('opacity')).toBe('0.15');
    svg.remove();
    const svg2 = makeSvg();
    plot(svg2, {
      width: 300,
      height: 200,
      marks: [rangeY([{ lo: 1, hi: 2 }], { from: 'lo', to: 'hi', fill: '#00ff00', opacity: 0.4 })],
    });
    rect = svg2.querySelector('rect.d3s-range');
    expect(rect?.getAttribute('fill')).toBe('#00ff00');
    expect(rect?.getAttribute('opacity')).toBe('0.4');
    svg2.remove();
  });

  it('accepts function accessors for from, to and label', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 300,
      height: 200,
      marks: [
        rangeY([{ a: 20, b: 30, n: 'ok' }], {
          from: (r) => r.a,
          to: (r) => r.b,
          label: (r) => r.n,
        }),
      ],
    });
    expect(svg.querySelectorAll('rect.d3s-range')).toHaveLength(1);
    expect(svg.querySelector('text.d3s-range-label')?.textContent).toBe('ok');
    svg.remove();
  });
});

describe('rangeX', () => {
  it('on a linear axis spans the two x positions and the full inner height', () => {
    const svg = makeSvg();
    const rows = [
      { lo: 1, hi: 3 },
      { lo: 5, hi: 6 },
    ];
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [rangeX(rows, { from: 'lo', to: 'hi' })],
    });
    const rects = svg.querySelectorAll('rect.d3s-range');
    expect(rects).toHaveLength(2);
    for (let i = 0; i < 2; i++) {
      const rect = rects[i];
      const row = rows[i];
      if (!rect || !row) throw new Error('missing rect or row');
      const left = ctx.x.position(Math.min(row.lo, row.hi));
      const right = ctx.x.position(Math.max(row.lo, row.hi));
      expect(Number(rect.getAttribute('x'))).toBeCloseTo(left, 6);
      expect(Number(rect.getAttribute('width'))).toBeCloseTo(right - left, 6);
      expect(rect.getAttribute('y')).toBe('0');
      expect(Number(rect.getAttribute('height'))).toBe(ctx.innerHeight);
    }
    svg.remove();
  });

  it('on a band axis spans from the first to the last category of the range', () => {
    const svg = makeSvg();
    const rows = [{ lo: 'b', hi: 'd' }];
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [rangeX(rows, { from: 'lo', to: 'hi' })],
    });
    const rect = svg.querySelector('rect.d3s-range');
    const start = ctx.x.position('b');
    const end = ctx.x.position('d') + ctx.x.bandwidth();
    expect(Number(rect?.getAttribute('x'))).toBeCloseTo(start, 6);
    expect(Number(rect?.getAttribute('width'))).toBeCloseTo(end - start, 6);
    expect(Number(rect?.getAttribute('height'))).toBe(ctx.innerHeight);
    svg.remove();
  });

  it('accepts Date bounds on a time axis', () => {
    const svg = makeSvg();
    const t0 = new Date(Date.UTC(2020, 0, 1));
    const t1 = new Date(Date.UTC(2020, 6, 1));
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [rangeX([{ lo: t0, hi: t1 }], { from: 'lo', to: 'hi' })],
    });
    const rect = svg.querySelector('rect.d3s-range');
    expect(Number(rect?.getAttribute('x'))).toBeCloseTo(ctx.x.position(t0), 6);
    expect(Number(rect?.getAttribute('width'))).toBeCloseTo(
      ctx.x.position(t1) - ctx.x.position(t0),
      6,
    );
    svg.remove();
  });

  it('a non-finite bound is skipped and does not reach the x domain', () => {
    const svg = makeSvg();
    const rows = [
      { lo: 1, hi: 3 },
      { lo: Number.NaN, hi: 9 },
      { lo: 4, hi: 'bad' as unknown as number },
    ];
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [rangeX(rows, { from: 'lo', to: 'hi' })],
    });
    expect(svg.querySelectorAll('rect.d3s-range')).toHaveLength(1);
    expect(ctx.x.domain.every((d) => Number.isFinite(Number(d)))).toBe(true);
    svg.remove();
  });
});
