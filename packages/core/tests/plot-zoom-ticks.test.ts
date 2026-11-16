// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { plot } from '../src/plot/index';
import type { Mark, PlotContext, PlotSpec } from '../src/plot/types';

const SVG_NS = 'http://www.w3.org/2000/svg';

afterEach(() => {
  document.body.replaceChildren();
});

function points(): Mark {
  return {
    name: 'points',
    xValues: () => [0, 100],
    yValues: () => [0, 100],
    render() {
      // Nothing to draw: the test reads the axes.
    },
  };
}

function wheel(svg: SVGSVGElement, x: number, y: number, deltaY: number): void {
  svg.dispatchEvent(
    new WheelEvent('wheel', { clientX: x, clientY: y, deltaY, cancelable: true, bubbles: true }),
  );
}

function labelsOf(svg: SVGSVGElement, axis: 'x' | 'y'): string[] {
  return Array.from(svg.querySelectorAll(`.d3s-axis-${axis} .tick text`)).map(
    (t) => t.textContent ?? '',
  );
}

describe('ticks of a zoomed axis', () => {
  it('keeps labels after a deep zoom in, drawn from the visible part', () => {
    const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
    document.body.appendChild(svg);
    const spec: PlotSpec = {
      width: 500,
      height: 400,
      marks: [points()],
      zoom: { isEnabled: true },
    };
    const ctx: PlotContext = plot(svg, spec);
    const x = ctx.margin.left + ctx.innerWidth / 2;
    const y = ctx.margin.top + ctx.innerHeight / 2;
    for (let i = 0; i < 25; i++) wheel(svg, x, y, -300);

    const labels = labelsOf(svg, 'x');
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((label) => label.trim() !== '')).toBe(true);
    // Zoomed in, the labels have more decimals than the full view's whole numbers.
    expect(labels.some((label) => label.includes(','))).toBe(true);
  });

  it('a fixed step still shows its ticks inside a zoomed window', () => {
    const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
    document.body.appendChild(svg);
    const spec: PlotSpec = {
      width: 500,
      height: 400,
      marks: [points()],
      x: { step: 10 },
      zoom: { isEnabled: true },
    };
    const ctx = plot(svg, spec);
    const x = ctx.margin.left + ctx.innerWidth / 2;
    const y = ctx.margin.top + ctx.innerHeight / 2;
    for (let i = 0; i < 10; i++) wheel(svg, x, y, -300);
    expect(labelsOf(svg, 'x').length).toBeGreaterThan(0);
  });
});
