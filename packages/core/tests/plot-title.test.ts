// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { plot } from '../src/plot/plot';
import type { Mark } from '../src/plot/types';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

/** A mark that draws nothing but occupies the plot area. */
function blank(): Mark {
  return { name: 'blank', render: () => undefined };
}

/** Assert the value exists and return it, so tests can use the element. */
function must<T>(value: T | null | undefined): T {
  expect(value).not.toBeNull();
  return value as T;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function plotRect(svg: SVGSVGElement): Rect | undefined {
  const root = svg.querySelector<SVGGElement>('g.d3s-plot');
  const rect = root?.querySelector<SVGRectElement>('clipPath rect');
  if (!root || !rect) return undefined;
  const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(root.getAttribute('transform') ?? '');
  if (!m) return undefined;
  return {
    x: Number(m[1]),
    y: Number(m[2]),
    w: Number(rect.getAttribute('width')),
    h: Number(rect.getAttribute('height')),
  };
}

describe('plot title', () => {
  it('draws the title text with the d3s-title class', () => {
    const svg = makeSvg();
    plot(svg, { width: 400, height: 300, title: 'My chart', marks: [blank()] });
    const t = must(svg.querySelector<SVGTextElement>('g.d3s-title-group text.d3s-title'));
    expect(t.textContent).toBe('My chart');
    expect(t.getAttribute('font-size')).toBe('16');
  });

  it('draws the subtitle text with the d3s-subtitle class', () => {
    const svg = makeSvg();
    plot(svg, { width: 400, height: 300, title: 'T', subtitle: 'S', marks: [blank()] });
    const t = must(svg.querySelector<SVGTextElement>('text.d3s-subtitle'));
    expect(t.textContent).toBe('S');
    expect(t.getAttribute('font-size')).toBe('12');
  });

  it('draws no title group when no title or subtitle is given', () => {
    const svg = makeSvg();
    plot(svg, { width: 400, height: 300, marks: [blank()] });
    expect(svg.querySelector('g.d3s-title-group')).toBeNull();
  });

  it('keeps a title with markup as plain text, not HTML', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 400,
      height: 300,
      title: 'Revenue <b>2024</b> <script>alert(1)</script>',
      marks: [blank()],
    });
    const t = must(svg.querySelector<SVGTextElement>('text.d3s-title'));
    expect(t.textContent).toBe('Revenue <b>2024</b> <script>alert(1)</script>');
    expect(svg.querySelector('b')).toBeNull();
    expect(svg.querySelector('script')).toBeNull();
  });

  it('moves the plot area down with a title and back without one', () => {
    const plain = makeSvg();
    plot(plain, { width: 400, height: 300, marks: [blank()] });
    const without = must<Rect>(plotRect(plain));

    const titled = makeSvg();
    plot(titled, { width: 400, height: 300, title: 'T', subtitle: 'S', marks: [blank()] });
    const withTitle = must<Rect>(plotRect(titled));

    const again = makeSvg();
    plot(again, { width: 400, height: 300, marks: [blank()] });
    const restored = must<Rect>(plotRect(again));

    expect(withTitle.y).toBeGreaterThan(without.y);
    expect(withTitle.h).toBeLessThan(without.h);
    expect(restored).toEqual(without);
  });

  it('centres the title on the SVG width', () => {
    const svg = makeSvg();
    plot(svg, { width: 400, height: 300, title: 'Centred', marks: [blank()] });
    const t = must(svg.querySelector<SVGTextElement>('text.d3s-title'));
    expect(Number(t.getAttribute('x'))).toBe(200);
    expect(t.getAttribute('text-anchor')).toBe('middle');
  });
});
