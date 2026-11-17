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

function labelCount(svg: SVGSVGElement, axis: 'x' | 'y'): number {
  return Array.from(svg.querySelectorAll(`.d3s-axis-${axis} .tick text`)).filter(
    (t) => t.textContent !== '',
  ).length;
}

describe('zoomed axes with a fixed step', () => {
  it('a window narrower than the step still gets at least two labels', () => {
    const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
    document.body.appendChild(svg);
    const spec: PlotSpec = {
      width: 500,
      height: 400,
      marks: [points()],
      x: { step: 10 },
      y: { step: 10 },
      zoom: { isEnabled: true },
    };
    const ctx: PlotContext = plot(svg, spec);
    const x = ctx.margin.left + ctx.innerWidth / 2;
    const y = ctx.margin.top + ctx.innerHeight / 2;
    // Zoom in until the visible window is a few units wide: narrower than the step of 10.
    for (let i = 0; i < 30; i++) wheel(svg, x, y, -300);
    expect(labelCount(svg, 'x')).toBeGreaterThanOrEqual(2);
    expect(labelCount(svg, 'y')).toBeGreaterThanOrEqual(2);
  });

  it('without zoom, a fixed step keeps its own ticks', () => {
    const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
    document.body.appendChild(svg);
    plot(svg, { width: 500, height: 400, marks: [points()], x: { step: 10 } });
    // Ticks 0, 10, ..., 100: eleven of them, as the step asks.
    expect(labelCount(svg, 'x')).toBe(11);
  });
});
