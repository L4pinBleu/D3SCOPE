// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { plot } from '../src/plot/plot';
import { rectY } from '../src/plot/marks/rect';
import { dot } from '../src/plot/marks/dot';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

describe('review fixes: rows without a position never reach a domain', () => {
  it('a stacked bar with a missing category is not drawn and not counted in the domain', () => {
    const svg = makeSvg();
    const rows = [
      { c: 'a', s: 'p', v: 2 },
      { c: undefined as unknown as string, s: 'q', v: 5 },
      { c: 'b', s: 'p', v: 1 },
    ];
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [rectY(rows, { x: 'c', y: 'v', stack: { series: 's' } })],
    });
    expect(ctx.y.domain).toEqual([0, 2]);
    const bars = svg.querySelectorAll('rect.d3s-bar');
    expect(bars).toHaveLength(2);
    expect([...bars].some((r) => /NaN|undefined/.test(r.outerHTML))).toBe(false);
    svg.remove();
  });

  it('a grouped bar with a missing category keeps the other bars correct', () => {
    const svg = makeSvg();
    const rows = [
      { c: 'a', s: 'p', v: 2 },
      { c: undefined as unknown as string, s: 'q', v: 9 },
      { c: 'a', s: 'q', v: 3 },
    ];
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [rectY(rows, { x: 'c', y: 'v', group: { series: 's' } })],
    });
    expect(ctx.y.domain).toEqual([0, 3]);
    expect(svg.querySelectorAll('rect.d3s-bar')).toHaveLength(2);
    svg.remove();
  });

  it('a bubble with a missing size does not stretch the x domain', () => {
    const svg = makeSvg();
    const rows = [
      { x: 1, y: 1, s: 4 },
      { x: 2, y: 2, s: 9 },
      { x: 500, y: 900, s: undefined as unknown as number },
    ];
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [dot(rows, { x: 'x', y: 'y', size: 's' })],
    });
    expect(ctx.x.domain).toEqual([1, 2]);
    expect(ctx.y.domain).toEqual([1, 2]);
    expect(svg.querySelectorAll('circle.d3s-dot')).toHaveLength(2);
    svg.remove();
  });
});
