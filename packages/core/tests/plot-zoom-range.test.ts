// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { getZoomView, plot } from '../src/plot/index';
import { DEFAULT_ZOOM_RANGE, IDENTITY_VIEW, zoomRangeOf } from '../src/plot/zoom';
import type { Mark, PlotContext, PlotSpec, ZoomSpec } from '../src/plot/types';

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
      // Nothing to draw: these tests read the view.
    },
  };
}

function setup(zoom: ZoomSpec): { svg: SVGSVGElement; ctx: PlotContext } {
  const svg = makeSvg();
  const spec: PlotSpec = { width: 500, height: 400, marks: [points()], zoom };
  return { svg, ctx: plot(svg, spec) };
}

function wheel(svg: SVGSVGElement, x: number, y: number, deltaY: number): void {
  svg.dispatchEvent(
    new WheelEvent('wheel', { clientX: x, clientY: y, deltaY, cancelable: true, bubbles: true }),
  );
}

function centre(ctx: PlotContext): { x: number; y: number } {
  return { x: ctx.margin.left + ctx.innerWidth / 2, y: ctx.margin.top + ctx.innerHeight / 2 };
}

describe('zoom range', () => {
  it('by default the view never zooms out past the full view', () => {
    const { svg, ctx } = setup({ isEnabled: true });
    const p = centre(ctx);
    for (let i = 0; i < 20; i++) wheel(svg, p.x, p.y, 300);
    expect(getZoomView(svg)?.x.k).toBeCloseTo(1);
    expect(getZoomView(svg)?.x).toEqual(IDENTITY_VIEW.x);
  });

  it('minZoom below 1 lets the view zoom out past the data, down to that factor', () => {
    const { svg, ctx } = setup({ isEnabled: true, minZoom: 0.25 });
    const p = centre(ctx);
    for (let i = 0; i < 40; i++) wheel(svg, p.x, p.y, 300);
    expect(getZoomView(svg)?.x.k).toBeCloseTo(0.25);
    expect(getZoomView(svg)?.y.k).toBeCloseTo(0.25);
  });

  it('maxZoom caps the zoom in', () => {
    const { svg, ctx } = setup({ isEnabled: true, maxZoom: 4 });
    const p = centre(ctx);
    for (let i = 0; i < 40; i++) wheel(svg, p.x, p.y, -300);
    expect(getZoomView(svg)?.x.k).toBeCloseTo(4);
  });

  it('panning a zoomed-out view moves it past the data, within the overlap', () => {
    const { svg, ctx } = setup({ isEnabled: true, minZoom: 0.25 });
    const p = centre(ctx);
    wheel(svg, p.x, p.y, 300);
    const before = getZoomView(svg)?.x.t ?? 0;
    svg.dispatchEvent(
      new MouseEvent('pointerdown', { clientX: p.x, clientY: p.y, button: 0, bubbles: true }),
    );
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: p.x + 40, clientY: p.y }));
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: p.x + 40, clientY: p.y }));
    expect((getZoomView(svg)?.x.t ?? 0) - before).toBeCloseTo(40);
  });

  it('the default range is 1 to 1000', () => {
    expect(DEFAULT_ZOOM_RANGE).toEqual({ min: 1, max: 1000 });
    expect(zoomRangeOf({ isEnabled: true })).toEqual({ min: 1, max: 1000 });
  });

  it('rejects a non-positive minZoom or a minZoom above maxZoom', () => {
    expect(() => zoomRangeOf({ minZoom: 0 })).toThrow(RangeError);
    expect(() => zoomRangeOf({ minZoom: 5, maxZoom: 2 })).toThrow(RangeError);
  });
});
