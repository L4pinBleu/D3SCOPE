// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { getZoomView, plot } from '../src/plot/index';
import { IDENTITY_AXIS, IDENTITY_VIEW, zoomToSpan } from '../src/plot/zoom';
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
      // Nothing to draw: the tests read the view and the decorations only.
    },
  };
}

/** Plot area 444 × 356 px, origin at (40, 16), as in the other zoom tests. */
function setup(extra: Partial<PlotSpec> = {}) {
  const svg = makeSvg();
  const spec: PlotSpec = {
    width: 500,
    height: 400,
    marks: [points()],
    zoom: { isEnabled: true },
    ...extra,
  };
  const ctx = plot(svg, spec);
  return { svg, spec, ctx };
}

function mouse(
  target: EventTarget,
  type: string,
  clientX: number,
  clientY: number,
  button = 0,
): MouseEvent {
  const e = new MouseEvent(type, { clientX, clientY, button, cancelable: true, bubbles: true });
  target.dispatchEvent(e);
  return e;
}

describe('zoomToSpan', () => {
  it('spreads the pixels a to b over the whole axis', () => {
    // Pixels 100 to 300 of a 444 px axis: 2.22 times wider, and 100 moved to 0.
    const view = zoomToSpan(IDENTITY_AXIS, 100, 300, 444);
    expect(view.k).toBeCloseTo(444 / 200);
    expect(view.k * 100 + view.t).toBeCloseTo(0);
    expect(view.k * 300 + view.t).toBeCloseTo(444);
  });

  it('keeps the current zoom when it zooms again', () => {
    const current = { k: 2, t: -100 };
    // Displayed pixels 50 to 150 of the current view.
    const view = zoomToSpan(current, 50, 150, 444);
    expect(view.k * ((50 - current.t) / current.k) + view.t).toBeCloseTo(0);
    expect(view.k).toBeCloseTo((444 * 2) / 100);
  });
});

describe('right-button selection', () => {
  it('zooms to the rectangle drawn with the right button', () => {
    const { svg, ctx } = setup();
    const start = { x: ctx.margin.left + 100, y: ctx.margin.top + 50 };
    const end = { x: ctx.margin.left + 300, y: ctx.margin.top + 250 };
    mouse(svg, 'pointerdown', start.x, start.y, 2);
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: end.x, clientY: end.y }));
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: end.x, clientY: end.y }));
    const view = getZoomView(svg);
    expect(view?.x.k).toBeCloseTo(ctx.innerWidth / 200);
    expect(view?.y.k).toBeCloseTo(ctx.innerHeight / 200);
    expect(view?.x.t).toBeCloseTo(-(ctx.innerWidth / 200) * 100);
    expect(view?.y.t).toBeCloseTo(-(ctx.innerHeight / 200) * 50);
  });

  it('an axis whose selection is thinner than 4 px is left alone', () => {
    const { svg, ctx } = setup();
    const x = ctx.margin.left + 100;
    const y = ctx.margin.top + 50;
    mouse(svg, 'pointerdown', x, y, 2);
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: x + 2, clientY: y + 200 }));
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: x + 2, clientY: y + 200 }));
    const view = getZoomView(svg);
    expect(view?.x).toEqual(IDENTITY_AXIS);
    expect(view?.y.k).toBeGreaterThan(1);
  });

  it('a click without a drag changes nothing', () => {
    const { svg, ctx } = setup();
    const p = { x: ctx.margin.left + 100, y: ctx.margin.top + 50 };
    mouse(svg, 'pointerdown', p.x, p.y, 2);
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: p.x, clientY: p.y }));
    expect(getZoomView(svg)).toEqual(IDENTITY_VIEW);
  });

  it('isSelectionEnabled false turns the right button off', () => {
    const { svg, ctx } = setup({ zoom: { isEnabled: true, isSelectionEnabled: false } });
    const p = { x: ctx.margin.left + 100, y: ctx.margin.top + 50 };
    mouse(svg, 'pointerdown', p.x, p.y, 2);
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: p.x + 200, clientY: p.y + 200 }));
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: p.x + 200, clientY: p.y + 200 }));
    expect(getZoomView(svg)).toEqual(IDENTITY_VIEW);
  });

  it('removes the selection rectangle on release', () => {
    const { svg, ctx } = setup();
    const p = { x: ctx.margin.left + 100, y: ctx.margin.top + 50 };
    mouse(svg, 'pointerdown', p.x, p.y, 2);
    expect(svg.querySelector('.d3s-zoom-selection')).not.toBeNull();
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: p.x + 50, clientY: p.y + 50 }));
    expect(svg.querySelector('.d3s-zoom-selection')).toBeNull();
  });

  it('the browser menu is prevented over the plot', () => {
    const { svg, ctx } = setup();
    const p = { x: ctx.margin.left + 100, y: ctx.margin.top + 50 };
    expect(mouse(svg, 'contextmenu', p.x, p.y, 2).defaultPrevented).toBe(true);
  });
});

describe('cursor', () => {
  it('shows a grab cursor over the plot area and the default elsewhere', () => {
    const { svg, ctx } = setup();
    mouse(svg, 'pointermove', ctx.margin.left + 100, ctx.margin.top + 50);
    expect(svg.style.cursor).toBe('grab');
    mouse(svg, 'pointermove', 2, 2);
    expect(svg.style.cursor).toBe('');
  });

  it('shows a grabbing cursor while panning and returns to grab on release', () => {
    const { svg, ctx } = setup();
    const p = { x: ctx.margin.left + 100, y: ctx.margin.top + 50 };
    mouse(svg, 'pointerdown', p.x, p.y, 0);
    expect(svg.style.cursor).toBe('grabbing');
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: p.x, clientY: p.y }));
    expect(svg.style.cursor).toBe('grab');
  });

  it('turning zoom off clears the cursor', () => {
    const { svg, spec, ctx } = setup();
    mouse(svg, 'pointermove', ctx.margin.left + 100, ctx.margin.top + 50);
    plot(svg, { ...spec, zoom: { isEnabled: false } });
    expect(svg.style.cursor).toBe('');
  });
});

describe('onRender', () => {
  it('runs after every draw, including zoom redraws, and its decorations survive', () => {
    const svg = makeSvg();
    let calls = 0;
    const spec: PlotSpec = {
      width: 500,
      height: 400,
      marks: [points()],
      zoom: { isEnabled: true },
      onRender: (ctx: PlotContext) => {
        calls++;
        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('class', 'decoration');
        g.setAttribute('data-x', String(ctx.innerWidth));
        svg.appendChild(g);
      },
    };
    const ctx = plot(svg, spec);
    expect(calls).toBe(1);
    svg.dispatchEvent(
      new WheelEvent('wheel', {
        clientX: ctx.margin.left + 100,
        clientY: ctx.margin.top + 50,
        deltaY: -100,
        cancelable: true,
        bubbles: true,
      }),
    );
    expect(calls).toBe(2);
    expect(svg.querySelectorAll('.decoration')).toHaveLength(1);
  });
});
