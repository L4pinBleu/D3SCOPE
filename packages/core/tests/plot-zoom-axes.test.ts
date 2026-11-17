// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { getZoomView, plot } from '../src/plot/index';
import type { Mark, PlotContext, PlotSpec } from '../src/plot/types';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

afterEach(() => {
  document.body.replaceChildren();
});

function points(): Mark {
  return {
    name: 'points',
    xValues: () => [0, 100],
    yValues: () => [0, 100],
    render() {
      // Nothing to draw: these tests read the axes and the view.
    },
  };
}

function setup(): { svg: SVGSVGElement; ctx: PlotContext } {
  const svg = makeSvg();
  const spec: PlotSpec = { width: 500, height: 400, marks: [points()], zoom: { isEnabled: true } };
  return { svg, ctx: plot(svg, spec) };
}

/** Tick positions (x of a bottom axis, y of a left axis) of one axis group, from its transforms. */
function tickPositions(svg: SVGSVGElement, axis: 'x' | 'y'): number[] {
  return Array.from(svg.querySelectorAll(`.d3s-axis-${axis} .tick`)).map((tick) => {
    const match = /translate\(([-\d.e]+),\s*([-\d.e]+)\)/.exec(
      tick.getAttribute('transform') ?? '',
    );
    if (!match) throw new Error('tick without a translate');
    return Number(axis === 'x' ? match[1] : match[2]);
  });
}

function wheel(svg: SVGSVGElement, x: number, y: number, deltaY: number, ctrlKey = false): void {
  svg.dispatchEvent(
    new WheelEvent('wheel', {
      clientX: x,
      clientY: y,
      deltaY,
      ctrlKey,
      cancelable: true,
      bubbles: true,
    }),
  );
}

describe('axes while zoomed', () => {
  it('draws only the ticks inside the visible plot', () => {
    const { svg, ctx } = setup();
    wheel(svg, ctx.margin.left + ctx.innerWidth / 2, ctx.margin.top + ctx.innerHeight / 2, -600);
    const view = getZoomView(svg);
    expect(view?.x.k).toBeGreaterThan(2);
    const positions = tickPositions(svg, 'x');
    expect(positions.length).toBeGreaterThan(0);
    for (const p of positions) {
      expect(p).toBeGreaterThanOrEqual(-1e-6);
      expect(p).toBeLessThanOrEqual(ctx.innerWidth + 1e-6);
    }
  });

  it('stops the x axis line at the plot edges', () => {
    const { svg, ctx } = setup();
    wheel(svg, ctx.margin.left + ctx.innerWidth / 2, ctx.margin.top + ctx.innerHeight / 2, -600);
    const d = svg.querySelector('.d3s-axis-x path.domain')?.getAttribute('d') ?? '';
    const numbers = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    // The path is M c0,6 V0.5 H c1 V6: both ends inside [0, innerWidth].
    const [c0, c1] = [numbers[0] ?? NaN, numbers[3] ?? NaN];
    expect(c0).toBeGreaterThanOrEqual(0);
    expect(c1).toBeLessThanOrEqual(ctx.innerWidth + 1e-6);
  });

  it('draws every tick without zoom', () => {
    const svg = makeSvg();
    const ctx = plot(svg, { width: 500, height: 400, marks: [points()] });
    const positions = tickPositions(svg, 'x');
    expect(positions.length).toBeGreaterThan(0);
    // d3 offsets tick marks by half a pixel, so the edges may sit 1 px outside.
    expect(positions.every((p) => p >= -1 && p <= ctx.innerWidth + 1)).toBe(true);
  });
});

describe('trackpad gestures', () => {
  it('a pinch (wheel with ctrlKey) zooms faster than a scroll', () => {
    const scroll = setup();
    const pinch = setup();
    const p = (c: PlotContext): [number, number] => [c.margin.left + 100, c.margin.top + 100];
    wheel(scroll.svg, ...p(scroll.ctx), -100);
    wheel(pinch.svg, ...p(pinch.ctx), -100, true);
    const scrollK = getZoomView(scroll.svg)?.x.k ?? 1;
    const pinchK = getZoomView(pinch.svg)?.x.k ?? 1;
    expect(scrollK).toBeCloseTo(Math.exp(0.15));
    expect(pinchK).toBeCloseTo(Math.exp(1));
  });

  it('Shift with the left button draws a selection and zooms to it', () => {
    const { svg, ctx } = setup();
    const x0 = ctx.margin.left + 100;
    const y0 = ctx.margin.top + 50;
    svg.dispatchEvent(
      new MouseEvent('pointerdown', {
        clientX: x0,
        clientY: y0,
        button: 0,
        shiftKey: true,
        bubbles: true,
      }),
    );
    expect(svg.querySelector('.d3s-zoom-selection')).not.toBeNull();
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: x0 + 200, clientY: y0 + 200 }));
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: x0 + 200, clientY: y0 + 200 }));
    expect(getZoomView(svg)?.x.k).toBeCloseTo(ctx.innerWidth / 200);
  });

  it('Ctrl with the left button also draws a selection (Mac secondary click)', () => {
    const { svg, ctx } = setup();
    const x0 = ctx.margin.left + 100;
    const y0 = ctx.margin.top + 50;
    svg.dispatchEvent(
      new MouseEvent('pointerdown', {
        clientX: x0,
        clientY: y0,
        button: 0,
        ctrlKey: true,
        bubbles: true,
      }),
    );
    expect(svg.querySelector('.d3s-zoom-selection')).not.toBeNull();
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: x0 + 200, clientY: y0 + 200 }));
  });
});
