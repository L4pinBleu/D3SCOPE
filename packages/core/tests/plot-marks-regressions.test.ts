// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { plot } from '../src/plot/plot';
import { dot } from '../src/plot/marks/dot';
import { line } from '../src/plot/marks/line';
import { rectX, rectY } from '../src/plot/marks/rect';
import { ruleY } from '../src/plot/marks/rule';
import { cssVar, LIGHT_THEME } from '../src/theme/index';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

const ACCENT = cssVar('accent', LIGHT_THEME.accent);

describe('regressions: one bad row must not break the plot', () => {
  it('rectY with a missing value keeps the y domain finite and draws the other bars', () => {
    const svg = makeSvg();
    const rows = [
      { c: 'a', v: 3 },
      { c: 'b', v: undefined as unknown as number },
      { c: 'c', v: 5 },
    ];
    const ctx = plot(svg, { width: 300, height: 200, marks: [rectY(rows, { x: 'c', y: 'v' })] });
    expect(ctx.y.domain.every((d) => Number.isFinite(Number(d)))).toBe(true);
    expect(svg.querySelectorAll('rect.d3s-bar')).toHaveLength(2);
    svg.remove();
  });

  it('rectX with a NaN value keeps the x domain finite', () => {
    const svg = makeSvg();
    const rows = [
      { c: 'a', v: 3 },
      { c: 'b', v: Number.NaN },
    ];
    const ctx = plot(svg, { width: 300, height: 200, marks: [rectX(rows, { x: 'v', y: 'c' })] });
    expect(ctx.x.domain.every((d) => Number.isFinite(Number(d)))).toBe(true);
    svg.remove();
  });

  it('line with a missing x does not break the x domain', () => {
    const svg = makeSvg();
    const rows = [
      { x: 1, y: 1 },
      { x: Number.NaN, y: 2 },
      { x: 3, y: 3 },
    ];
    const ctx = plot(svg, { width: 300, height: 200, marks: [line(rows, { x: 'x', y: 'y' })] });
    expect(ctx.x.domain.every((d) => Number.isFinite(Number(d)))).toBe(true);
    svg.remove();
  });

  it('line with a missing series value draws it in the accent colour instead of crashing', () => {
    const svg = makeSvg();
    const rows = [
      { x: 1, y: 1, s: 'a' },
      { x: 2, y: 2, s: undefined as unknown as string },
    ];
    expect(() =>
      plot(svg, { width: 300, height: 200, marks: [line(rows, { x: 'x', y: 'y', series: 's' })] }),
    ).not.toThrow();
    const strokes = [...svg.querySelectorAll('path.d3s-line')].map((p) => p.getAttribute('stroke'));
    expect(strokes).toHaveLength(2);
    expect(strokes).toContain(ACCENT);
    svg.remove();
  });

  it('dot with a missing category draws it in the accent colour instead of crashing', () => {
    const svg = makeSvg();
    const rows = [
      { x: 1, y: 1, s: 'a' },
      { x: 2, y: 2, s: undefined as unknown as string },
    ];
    expect(() =>
      plot(svg, { width: 300, height: 200, marks: [dot(rows, { x: 'x', y: 'y', fill: 's' })] }),
    ).not.toThrow();
    const fills = [...svg.querySelectorAll('circle.d3s-dot')].map((c) => c.getAttribute('fill'));
    expect(fills).toHaveLength(2);
    expect(fills[1]).toBe(ACCENT);
    svg.remove();
  });

  it('dot and bar use the same fill rule: a literal colour is used as is', () => {
    const svg = makeSvg();
    const rows = [{ x: 1, y: 1 }];
    plot(svg, { width: 300, height: 200, marks: [dot(rows, { x: 'x', y: 'y', fill: '#e5484d' })] });
    expect(svg.querySelector('circle')?.getAttribute('fill')).toBe('#e5484d');
    svg.remove();
  });

  it('ruleY ignores non-finite values in the domain', () => {
    const svg = makeSvg();
    const ctx = plot(svg, { width: 300, height: 200, marks: [ruleY([10, Number.NaN, 20])] });
    expect(ctx.y.domain.every((d) => Number.isFinite(Number(d)))).toBe(true);
    expect(svg.querySelectorAll('line.d3s-rule')).toHaveLength(2);
    svg.remove();
  });
});
