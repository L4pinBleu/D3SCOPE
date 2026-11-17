// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { getZoomView, plot } from '../src/plot/index';
import type { Mark, PlotContext, PlotSpec, ZoomSpec } from '../src/plot/types';

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
      // Nothing to draw: these tests read the view.
    },
  };
}

function setup(zoom: ZoomSpec): { svg: SVGSVGElement; ctx: PlotContext } {
  const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
  document.body.appendChild(svg);
  const spec: PlotSpec = { width: 500, height: 400, marks: [points()], zoom };
  return { svg, ctx: plot(svg, spec) };
}

function wheel(svg: SVGSVGElement, x: number, y: number, deltaY: number): void {
  svg.dispatchEvent(
    new WheelEvent('wheel', { clientX: x, clientY: y, deltaY, cancelable: true, bubbles: true }),
  );
}

function drag(svg: SVGSVGElement, x: number, y: number, dx: number): void {
  svg.dispatchEvent(
    new MouseEvent('pointerdown', { clientX: x, clientY: y, button: 0, bubbles: true }),
  );
  window.dispatchEvent(new MouseEvent('pointermove', { clientX: x + dx, clientY: y }));
  window.dispatchEvent(new MouseEvent('pointerup', { clientX: x + dx, clientY: y }));
}

function centre(ctx: PlotContext): { x: number; y: number } {
  return { x: ctx.margin.left + ctx.innerWidth / 2, y: ctx.margin.top + ctx.innerHeight / 2 };
}

describe('zoom limits', () => {
  it('by default the view never zooms out past the full view', () => {
    const { svg, ctx } = setup({ isEnabled: true });
    const p = centre(ctx);
    for (let i = 0; i < 20; i++) wheel(svg, p.x, p.y, 300);
    expect(getZoomView(svg)?.x.k).toBeCloseTo(1);
  });

  it('isUnlimitedZoomOut lets the view zoom out past the data', () => {
    const { svg, ctx } = setup({ isEnabled: true, isUnlimitedZoomOut: true });
    const p = centre(ctx);
    for (let i = 0; i < 40; i++) wheel(svg, p.x, p.y, 300);
    expect(getZoomView(svg)?.x.k).toBeLessThan(0.5);
  });

  it('x limits in data values keep the visible window inside them', () => {
    const { svg, ctx } = setup({ isEnabled: true, x: { min: 20, max: 60 } });
    // Base pixels of the limits, read on the full view.
    const low = ctx.x.position(20);
    const high = ctx.x.position(60);
    const p = centre(ctx);
    for (let i = 0; i < 10; i++) wheel(svg, p.x, p.y, -300);
    drag(svg, p.x, p.y, 1000);
    const view = getZoomView(svg);
    const k = view?.x.k ?? 1;
    const t = view?.x.t ?? 0;
    const windowLow = -t / k;
    const windowHigh = (ctx.innerWidth - t) / k;
    expect(windowLow).toBeGreaterThanOrEqual(Math.min(low, high) - 1e-6);
    expect(windowHigh).toBeLessThanOrEqual(Math.max(low, high) + 1e-6);
  });

  it('minSpan keeps the visible width above that many data units', () => {
    const { svg, ctx } = setup({ isEnabled: true, x: { minSpan: 50 } });
    const p = centre(ctx);
    for (let i = 0; i < 30; i++) wheel(svg, p.x, p.y, -300);
    // The domain is 0 to 100, so the visible width in data units is 100 / k.
    expect(getZoomView(svg)?.x.k).toBeLessThanOrEqual(2 + 1e-6);
  });

  it('maxSpan keeps the visible width below that many data units', () => {
    const { svg, ctx } = setup({ isEnabled: true, isUnlimitedZoomOut: true, x: { maxSpan: 60 } });
    const p = centre(ctx);
    for (let i = 0; i < 40; i++) wheel(svg, p.x, p.y, 300);
    expect(getZoomView(svg)?.x.k).toBeGreaterThanOrEqual(100 / 60 - 1e-6);
  });

  it('rejects a span limit that is not positive, or a maxSpan below minSpan', () => {
    expect(() => setup({ isEnabled: true, x: { minSpan: 0 } })).toThrow(RangeError);
    expect(() => setup({ isEnabled: true, y: { minSpan: 5, maxSpan: 2 } })).toThrow(RangeError);
  });
});
