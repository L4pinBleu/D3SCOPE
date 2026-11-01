// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createColorScale, uniqueCategories } from '../src/plot/color';
import { plot } from '../src/plot/plot';
import type { Mark } from '../src/plot/types';
import { LIGHT_THEME } from '../src/theme/index';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

/** A mark that declares colour categories and draws nothing. */
function colored(categories: string[]): Mark {
  return { name: 'colored', colorValues: () => categories, render: () => undefined };
}

describe('uniqueCategories', () => {
  it('keeps the order of first appearance', () => {
    expect(uniqueCategories(['b', 'a', 'b', 'c', 'a'])).toEqual(['b', 'a', 'c']);
  });
});

describe('createColorScale', () => {
  it('maps categories to the theme palette in order, and repeats it', () => {
    const palette = LIGHT_THEME.palette;
    const scale = createColorScale(['x', 'y']);
    expect(scale.domain).toEqual(['x', 'y']);
    expect(scale('x')).toBe(palette[0]);
    expect(scale('y')).toBe(palette[1]);
  });

  it('uses an explicit domain and range, repeating the range when it is short', () => {
    const scale = createColorScale(['x', 'y', 'z'], {
      domain: ['z', 'y', 'x'],
      range: ['#111', '#222'],
    });
    expect(scale.domain).toEqual(['z', 'y', 'x']);
    expect(scale('z')).toBe('#111');
    expect(scale('y')).toBe('#222');
    expect(scale('x')).toBe('#111');
  });

  it('rejects a category that is not in the domain', () => {
    const scale = createColorScale(['x'], { domain: ['x'] });
    expect(() => scale('nope')).toThrow(RangeError);
  });

  it('has an empty domain when nothing declares a category', () => {
    expect(createColorScale([]).domain).toEqual([]);
  });
});

describe('plot() colour channel', () => {
  it('builds the colour scale from the categories the marks declare', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [colored(['a', 'b']), colored(['b', 'c'])],
    });
    expect(ctx.color.domain).toEqual(['a', 'b', 'c']);
    svg.remove();
  });

  it('draws a legend and makes room for it when color.legend is on', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 300,
      height: 200,
      color: { legend: true },
      marks: [colored(['a', 'b'])],
    });
    const legend = svg.querySelector('.d3s-legend');
    expect(legend).not.toBeNull();
    expect(legend?.textContent).toContain('a');
    expect(legend?.textContent).toContain('b');
    // The plot starts below the legend: default top margin 16 + 22 for the legend.
    expect(svg.querySelector('.d3s-plot')?.getAttribute('transform')).toBe('translate(40,38)');
    svg.remove();
  });

  it('draws no legend by default, and none when there are no categories', () => {
    const svg = makeSvg();
    plot(svg, { width: 300, height: 200, marks: [colored(['a'])] });
    expect(svg.querySelector('.d3s-legend')).toBeNull();
    svg.remove();

    const svg2 = makeSvg();
    plot(svg2, { width: 300, height: 200, color: { legend: true }, marks: [] });
    expect(svg2.querySelector('.d3s-legend')).toBeNull();
    expect(svg2.querySelector('.d3s-plot')?.getAttribute('transform')).toBe('translate(40,16)');
    svg2.remove();
  });
});
