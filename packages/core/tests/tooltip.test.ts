// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createTooltip, placeTooltip, tooltipBoxSize } from '../src/interaction/tooltip.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg(width = 300, height = 200): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  document.body.appendChild(svg);
  return svg;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('tooltipBoxSize', () => {
  it('counts the title as one line and sizes by the longest line', () => {
    const size = tooltipBoxSize({ title: 'Jan', lines: ['1234567890'] });
    expect(size.width).toBe(10 * 7 + 16);
    expect(size.height).toBe(2 * 16 + 16);
  });

  it('works without a title', () => {
    expect(tooltipBoxSize({ lines: ['a'] }).height).toBe(16 + 16);
  });
});

describe('placeTooltip', () => {
  const box = { width: 100, height: 40 };
  const bounds = { width: 300, height: 200 };

  it('places the box right of and below the pointer', () => {
    expect(placeTooltip({ x: 50, y: 50 }, box, bounds)).toEqual({ x: 62, y: 62 });
  });

  it('flips to the left of the pointer near the right edge', () => {
    expect(placeTooltip({ x: 280, y: 50 }, box, bounds).x).toBe(280 - 12 - 100);
  });

  it('flips above the pointer near the bottom edge', () => {
    expect(placeTooltip({ x: 50, y: 190 }, box, bounds).y).toBe(190 - 12 - 40);
  });

  it('never returns negative coordinates', () => {
    // Too wide for either side: clamped to the origin.
    expect(placeTooltip({ x: 0, y: 0 }, { width: 500, height: 500 }, bounds)).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe('createTooltip (svg mode)', () => {
  it('adds a hidden group to the SVG and shows it with the content', () => {
    const svg = makeSvg();
    const tip = createTooltip(svg);
    const group = svg.querySelector<SVGGElement>('g.d3scope-tooltip');
    expect(group?.style.display).toBe('none');

    tip.show({ title: 'Jan', lines: ['10'] }, { x: 20, y: 30 });
    expect(group?.style.display).toBe('');
    expect(group?.getAttribute('transform')).toBe('translate(32,42)');
    const texts = Array.from(group?.querySelectorAll('tspan') ?? []).map((t) => t.textContent);
    expect(texts).toEqual(['Jan', '10']);
    expect(group?.querySelector('tspan')?.getAttribute('font-weight')).toBe('bold');
  });

  it('hides and destroys', () => {
    const svg = makeSvg();
    const tip = createTooltip(svg);
    tip.show({ lines: ['x'] }, { x: 0, y: 0 });
    tip.hide();
    expect(svg.querySelector<SVGGElement>('g.d3scope-tooltip')?.style.display).toBe('none');
    tip.destroy();
    expect(svg.querySelector('g.d3scope-tooltip')).toBeNull();
  });
});

describe('createTooltip (html mode)', () => {
  it('appends a div to the container and shows text safely', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const svg = makeSvg();
    container.appendChild(svg);

    const tip = createTooltip(svg, { mode: 'html', container });
    const el = container.querySelector<HTMLDivElement>('div.d3scope-tooltip');
    expect(el?.style.display).toBe('none');

    tip.show({ title: '<b>x</b>', lines: ['10 %'] }, { x: 5, y: 5 });
    expect(el?.style.display).toBe('block');
    expect(el?.querySelector('strong')?.textContent).toBe('<b>x</b>');
    expect(el?.querySelector('strong')?.children.length).toBe(0);
    expect(el?.textContent).toContain('10 %');

    tip.destroy();
    expect(container.querySelector('div.d3scope-tooltip')).toBeNull();
  });

  it('throws when there is no container and no parent', () => {
    const svg = makeSvg();
    svg.remove();
    expect(() => createTooltip(svg, { mode: 'html' })).toThrow('html mode');
  });

  it('defaults the container to the SVG parent', () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const svg = makeSvg();
    parent.appendChild(svg);
    createTooltip(svg, { mode: 'html' });
    expect(parent.querySelector('div.d3scope-tooltip')).not.toBeNull();
  });
});
