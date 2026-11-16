// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { getZoomView, plot, resetZoom } from '../src/plot/index';
import {
  IDENTITY_AXIS,
  IDENTITY_VIEW,
  MAX_ZOOM,
  clampAxis,
  panAxis,
  viewRange,
  wheelFactor,
  zoomAxis,
} from '../src/plot/zoom';
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

/** A mark that records every context it is drawn with, so tests can read the scales. */
function recorder(xValues: (number | string)[] = [0, 100]): {
  mark: Mark;
  contexts: PlotContext[];
} {
  const contexts: PlotContext[] = [];
  const mark: Mark = {
    name: 'recorder',
    xValues: () => xValues,
    yValues: () => [0, 100],
    render(ctx) {
      contexts.push(ctx);
    },
  };
  return { mark, contexts };
}

/** A plot of 500 × 400 with the default margins: plot area 444 × 356 px, origin at (40, 16). */
function setup(zoom: ZoomSpec | undefined, xValues?: (number | string)[]) {
  const svg = makeSvg();
  const { mark, contexts } = recorder(xValues);
  const spec: PlotSpec = {
    width: 500,
    height: 400,
    marks: [mark],
    ...(zoom ? { zoom } : {}),
  };
  const ctx = plot(svg, spec);
  return { svg, spec, ctx, contexts };
}

function wheel(svg: SVGSVGElement, clientX: number, clientY: number, deltaY = -100): WheelEvent {
  const e = new WheelEvent('wheel', { clientX, clientY, deltaY, cancelable: true, bubbles: true });
  svg.dispatchEvent(e);
  return e;
}

function centre(ctx: PlotContext): { x: number; y: number } {
  return { x: ctx.margin.left + ctx.innerWidth / 2, y: ctx.margin.top + ctx.innerHeight / 2 };
}

/** A point on the x axis strip, below the plot area. */
function xAxisStrip(ctx: PlotContext): { x: number; y: number } {
  return { x: ctx.margin.left + ctx.innerWidth / 2, y: ctx.margin.top + ctx.innerHeight + 6 };
}

/** A point on the y axis strip, left of the plot area. */
function yAxisStrip(ctx: PlotContext): { x: number; y: number } {
  return { x: ctx.margin.left - 6, y: ctx.margin.top + ctx.innerHeight / 2 };
}

function lastRange(contexts: PlotContext[]): [number, number] {
  const last = contexts[contexts.length - 1];
  if (!last) throw new Error('the plot was not drawn');
  return [last.x.range[0], last.x.range[1]];
}

describe('zoom maths', () => {
  it('the identity view maps the base range to itself', () => {
    expect(viewRange(IDENTITY_AXIS, [0, 100])).toEqual([0, 100]);
  });

  it('zooming keeps the pixel under the pivot in place', () => {
    const view = zoomAxis(IDENTITY_AXIS, 2, 50, 100);
    expect(view.k).toBe(2);
    expect(view.t).toBe(-50);
    const [a, b] = viewRange(view, [0, 100]);
    expect(a).toBe(-50);
    expect(b).toBe(150);
    expect(view.k * 50 + view.t).toBe(50);
  });

  it('the offset is clamped so the data covers the plot area', () => {
    expect(clampAxis({ k: 2, t: 50 }, 100).t).toBe(0);
    expect(clampAxis({ k: 2, t: -500 }, 100).t).toBe(-100);
    expect(clampAxis({ k: 0.5, t: -30 }, 100)).toEqual({ k: 1, t: 0 });
  });

  it('the zoom factor stops at MAX_ZOOM', () => {
    expect(zoomAxis(IDENTITY_AXIS, 1e9, 0, 100).k).toBe(MAX_ZOOM);
  });

  it('a zoom that changes nothing returns the same view', () => {
    const view = { k: MAX_ZOOM, t: 0 };
    expect(zoomAxis(view, 2, 0, 100)).toBe(view);
  });

  it('panning shifts the view and stays clamped', () => {
    expect(panAxis({ k: 2, t: -50 }, 10, 100).t).toBe(-40);
    expect(panAxis({ k: 2, t: -50 }, 1000, 100).t).toBe(0);
  });

  it('a wheel up zooms in, a wheel down zooms out, and lines count as 16 px', () => {
    expect(wheelFactor(-100, 0)).toBeGreaterThan(1);
    expect(wheelFactor(100, 0)).toBeLessThan(1);
    expect(wheelFactor(0, 0)).toBe(1);
    expect(wheelFactor(-3, 1)).toBeCloseTo(wheelFactor(-48, 0));
  });
});

describe('plot zoom', () => {
  it('has no view when zoom is off', () => {
    const { svg } = setup(undefined);
    expect(getZoomView(svg)).toBeUndefined();
  });

  it('starts with the full view', () => {
    const { svg } = setup({ isEnabled: true });
    expect(getZoomView(svg)).toEqual(IDENTITY_VIEW);
  });

  it('a wheel over the plot zooms both axes and redraws the scales', () => {
    const { svg, ctx, contexts } = setup({ isEnabled: true });
    const p = centre(ctx);
    const e = wheel(svg, p.x, p.y);
    expect(e.defaultPrevented).toBe(true);
    const view = getZoomView(svg);
    expect(view?.x.k).toBeGreaterThan(1);
    expect(view?.y.k).toBeGreaterThan(1);
    const [a, b] = lastRange(contexts);
    expect(b - a).toBeCloseTo(ctx.innerWidth * (view?.x.k ?? 1));
  });

  it('a wheel with isWheelEnabled false does nothing', () => {
    const { svg, ctx } = setup({ isEnabled: true, isWheelEnabled: false });
    const p = centre(ctx);
    expect(wheel(svg, p.x, p.y).defaultPrevented).toBe(false);
    expect(getZoomView(svg)).toEqual(IDENTITY_VIEW);
  });

  it('independent link: a wheel over the x axis zooms x only', () => {
    const { svg, ctx } = setup({ isEnabled: true, link: 'independent' });
    const p = xAxisStrip(ctx);
    wheel(svg, p.x, p.y);
    const view = getZoomView(svg);
    expect(view?.x.k).toBeGreaterThan(1);
    expect(view?.y).toEqual(IDENTITY_AXIS);
  });

  it('independent link: a wheel over the y axis zooms y only', () => {
    const { svg, ctx } = setup({ isEnabled: true });
    const p = yAxisStrip(ctx);
    wheel(svg, p.x, p.y);
    const view = getZoomView(svg);
    expect(view?.y.k).toBeGreaterThan(1);
    expect(view?.x).toEqual(IDENTITY_AXIS);
  });

  it('joint link: a wheel over an axis zooms both axes by the same factor', () => {
    const { svg, ctx } = setup({ isEnabled: true, link: 'joint' });
    const p = xAxisStrip(ctx);
    wheel(svg, p.x, p.y);
    const view = getZoomView(svg);
    expect(view?.x.k).toBeGreaterThan(1);
    expect(view?.y.k).toBe(view?.x.k);
  });

  it('axes x: a wheel over the plot leaves the y axis alone', () => {
    const { svg, ctx } = setup({ isEnabled: true, axes: 'x' });
    const p = centre(ctx);
    wheel(svg, p.x, p.y);
    const view = getZoomView(svg);
    expect(view?.x.k).toBeGreaterThan(1);
    expect(view?.y).toEqual(IDENTITY_AXIS);
  });

  it('band axes never zoom', () => {
    const { svg, ctx } = setup({ isEnabled: true }, ['a', 'b']);
    const p = centre(ctx);
    wheel(svg, p.x, p.y);
    const view = getZoomView(svg);
    expect(view?.x).toEqual(IDENTITY_AXIS);
    expect(view?.y.k).toBeGreaterThan(1);
  });

  it('a wheel outside the plot and its axes does nothing', () => {
    const { svg } = setup({ isEnabled: true });
    const e = wheel(svg, 200, 2);
    expect(e.defaultPrevented).toBe(false);
    expect(getZoomView(svg)).toEqual(IDENTITY_VIEW);
  });

  it('dragging pans the zoomed view, and releasing the button stops it', () => {
    const { svg, ctx } = setup({ isEnabled: true });
    const p = centre(ctx);
    wheel(svg, p.x, p.y);
    const before = getZoomView(svg);
    svg.dispatchEvent(
      new MouseEvent('pointerdown', { clientX: p.x, clientY: p.y, button: 0, bubbles: true }),
    );
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: p.x + 10, clientY: p.y + 5 }));
    const moved = getZoomView(svg);
    expect((moved?.x.t ?? 0) - (before?.x.t ?? 0)).toBeCloseTo(10);
    expect((moved?.y.t ?? 0) - (before?.y.t ?? 0)).toBeCloseTo(5);
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: p.x + 10, clientY: p.y + 5 }));
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: p.x + 50, clientY: p.y + 50 }));
    expect(getZoomView(svg)).toEqual(moved);
  });

  it('a drag that starts outside the plot does nothing', () => {
    const { svg, ctx } = setup({ isEnabled: true });
    const p = centre(ctx);
    wheel(svg, p.x, p.y);
    const before = getZoomView(svg);
    const start = yAxisStrip(ctx);
    svg.dispatchEvent(
      new MouseEvent('pointerdown', {
        clientX: start.x,
        clientY: start.y,
        button: 0,
        bubbles: true,
      }),
    );
    window.dispatchEvent(
      new MouseEvent('pointermove', { clientX: start.x + 20, clientY: start.y }),
    );
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: start.x + 20, clientY: start.y }));
    expect(getZoomView(svg)).toEqual(before);
  });

  it('a double-click on the plot returns to the full view', () => {
    const { svg, ctx, contexts } = setup({ isEnabled: true });
    const p = centre(ctx);
    wheel(svg, p.x, p.y);
    svg.dispatchEvent(new MouseEvent('dblclick', { clientX: p.x, clientY: p.y, bubbles: true }));
    expect(getZoomView(svg)).toEqual(IDENTITY_VIEW);
    expect(lastRange(contexts)).toEqual([0, ctx.innerWidth]);
  });

  it('resetZoom restores the full view and the scales', () => {
    const { svg, ctx, contexts } = setup({ isEnabled: true });
    const p = centre(ctx);
    wheel(svg, p.x, p.y);
    resetZoom(svg);
    expect(getZoomView(svg)).toEqual(IDENTITY_VIEW);
    expect(lastRange(contexts)).toEqual([0, ctx.innerWidth]);
  });

  it('the view survives a data update', () => {
    const { svg, spec, ctx } = setup({ isEnabled: true });
    const p = centre(ctx);
    wheel(svg, p.x, p.y);
    const zoomed = getZoomView(svg);
    plot(svg, spec);
    expect(getZoomView(svg)).toEqual(zoomed);
  });

  it('turning zoom off drops the view', () => {
    const { svg, spec, ctx } = setup({ isEnabled: true });
    const p = centre(ctx);
    wheel(svg, p.x, p.y);
    plot(svg, { ...spec, zoom: { isEnabled: false } });
    expect(getZoomView(svg)).toBeUndefined();
  });
});
