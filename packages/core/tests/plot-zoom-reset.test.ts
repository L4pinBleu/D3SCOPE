// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { getZoomView, plot } from '../src/plot/index';
import type { Mark, PlotContext, PlotSpec } from '../src/plot/types';

const SVG_NS = 'http://www.w3.org/2000/svg';

afterEach(() => {
  document.body.replaceChildren();
});

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

function points(): Mark {
  return {
    name: 'points',
    xValues: () => [0, 100],
    yValues: () => [0, 100],
    render() {
      // Nothing to draw: the tests read the view and the controls only.
    },
  };
}

function setup(zoom: NonNullable<PlotSpec['zoom']>): { svg: SVGSVGElement; ctx: PlotContext } {
  const svg = makeSvg();
  const ctx = plot(svg, { width: 500, height: 400, marks: [points()], zoom });
  return { svg, ctx };
}

/** A point in the middle of the plot area, in client pixels (the SVG has no offset in jsdom). */
function centre(ctx: PlotContext): { x: number; y: number } {
  return { x: ctx.margin.left + ctx.innerWidth / 2, y: ctx.margin.top + ctx.innerHeight / 2 };
}

function zoomIn(svg: SVGSVGElement, at: { x: number; y: number }): void {
  for (let i = 0; i < 5; i++) {
    svg.dispatchEvent(
      new WheelEvent('wheel', {
        clientX: at.x,
        clientY: at.y,
        deltaY: -100,
        cancelable: true,
        bubbles: true,
      }),
    );
  }
}

function dblclickAt(svg: SVGSVGElement, at: { x: number; y: number }): void {
  svg.dispatchEvent(
    new MouseEvent('dblclick', { clientX: at.x, clientY: at.y, bubbles: true, cancelable: true }),
  );
}

function zoomedIn(svg: SVGSVGElement): boolean {
  return (getZoomView(svg)?.x.k ?? 1) > 1;
}

/** A pointer event with a touch pointer type, as a browser sends it for a finger. */
function touch(svg: SVGSVGElement, type: string, id: number, x: number, y: number): void {
  const e = new MouseEvent(type, {
    clientX: x,
    clientY: y,
    button: 0,
    cancelable: true,
    bubbles: true,
  });
  Object.defineProperties(e, {
    pointerType: { value: 'touch' },
    pointerId: { value: id },
  });
  svg.dispatchEvent(e);
}

describe('reset button (resetOn)', () => {
  it('draws no button by default: the double-click resets', () => {
    const { svg, ctx } = setup({ isEnabled: true });
    expect(svg.querySelector('.d3s-zoom-reset')).toBeNull();
    zoomIn(svg, centre(ctx));
    expect(zoomedIn(svg)).toBe(true);
    dblclickAt(svg, centre(ctx));
    expect(zoomedIn(svg)).toBe(false);
  });

  it('button: draws the button with its label, and a click resets the view', () => {
    const { svg, ctx } = setup({ isEnabled: true, resetOn: 'button' });
    expect(svg.querySelector('.d3s-zoom-reset')).not.toBeNull();
    zoomIn(svg, centre(ctx));
    expect(zoomedIn(svg)).toBe(true);
    const button = svg.querySelector('.d3s-zoom-reset');
    expect(button?.getAttribute('role')).toBe('button');
    expect(button?.getAttribute('aria-label')).toBe('Réinitialiser');
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(zoomedIn(svg)).toBe(false);
  });

  it('button: the double-click does not reset', () => {
    const { svg, ctx } = setup({ isEnabled: true, resetOn: 'button' });
    zoomIn(svg, centre(ctx));
    dblclickAt(svg, centre(ctx));
    expect(zoomedIn(svg)).toBe(true);
  });

  it('both: the button and the double-click reset', () => {
    const { svg, ctx } = setup({ isEnabled: true, resetOn: 'both' });
    expect(svg.querySelector('.d3s-zoom-reset')).not.toBeNull();
    zoomIn(svg, centre(ctx));
    dblclickAt(svg, centre(ctx));
    expect(zoomedIn(svg)).toBe(false);
    zoomIn(svg, centre(ctx));
    svg.querySelector('.d3s-zoom-reset')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(zoomedIn(svg)).toBe(false);
  });

  it('the button is drawn again after each zoom, so it stays after a redraw', () => {
    const { svg, ctx } = setup({ isEnabled: true, resetOn: 'button' });
    zoomIn(svg, centre(ctx));
    expect(svg.querySelectorAll('.d3s-zoom-reset')).toHaveLength(1);
  });

  it('a label can be given', () => {
    const { svg } = setup({ isEnabled: true, resetOn: 'button', resetLabel: 'Reset' });
    const button = svg.querySelector('.d3s-zoom-reset');
    expect(button?.getAttribute('aria-label')).toBe('Reset');
    expect(button?.textContent).toBe('Reset');
  });

  it('Enter on the focused button resets the view', () => {
    const { svg, ctx } = setup({ isEnabled: true, resetOn: 'button' });
    zoomIn(svg, centre(ctx));
    svg
      .querySelector('.d3s-zoom-reset')
      ?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
    expect(zoomedIn(svg)).toBe(false);
  });

  it('no button when zoom is off, whatever resetOn says', () => {
    const svg = makeSvg();
    plot(svg, { width: 500, height: 400, marks: [points()], zoom: { resetOn: 'button' } });
    expect(svg.querySelector('.d3s-zoom-reset')).toBeNull();
  });
});

describe('touch', () => {
  it('two fingers spread apart zoom in, around their midpoint', () => {
    const { svg, ctx } = setup({ isEnabled: true });
    const c = centre(ctx);
    touch(svg, 'pointerdown', 1, c.x - 50, c.y);
    touch(svg, 'pointerdown', 2, c.x + 50, c.y);
    // The distance doubles, from 100 px to 200 px (the first finger stays at c.x - 50).
    touch(svg, 'pointermove', 2, c.x + 150, c.y);
    expect(getZoomView(svg)?.x.k).toBeCloseTo(2, 6);
    // Both axes zoom by the same factor, as the default `axes: 'both'` asks.
    expect(getZoomView(svg)?.y.k).toBeCloseTo(2, 6);
    touch(svg, 'pointerup', 2, c.x + 150, c.y);
    touch(svg, 'pointerup', 1, c.x - 50, c.y);
  });

  it('fingers that come together zoom out again', () => {
    const { svg, ctx } = setup({ isEnabled: true });
    const c = centre(ctx);
    touch(svg, 'pointerdown', 1, c.x - 50, c.y);
    touch(svg, 'pointerdown', 2, c.x + 50, c.y);
    touch(svg, 'pointermove', 2, c.x + 100, c.y);
    touch(svg, 'pointermove', 2, c.x + 50, c.y);
    expect(getZoomView(svg)?.x.k).toBeCloseTo(1, 6);
    touch(svg, 'pointerup', 2, c.x + 50, c.y);
    touch(svg, 'pointerup', 1, c.x - 50, c.y);
  });

  it('the pinch ends when a finger lifts: the remaining finger does not zoom', () => {
    const { svg, ctx } = setup({ isEnabled: true });
    const c = centre(ctx);
    touch(svg, 'pointerdown', 1, c.x - 50, c.y);
    touch(svg, 'pointerdown', 2, c.x + 50, c.y);
    touch(svg, 'pointermove', 2, c.x + 100, c.y);
    const zoomed = getZoomView(svg)?.x.k;
    touch(svg, 'pointerup', 2, c.x + 100, c.y);
    touch(svg, 'pointermove', 1, c.x - 40, c.y);
    expect(getZoomView(svg)?.x.k).toBe(zoomed);
    touch(svg, 'pointerup', 1, c.x - 40, c.y);
  });

  it('a mouse pointer is not a touch: the pinch ignores it', () => {
    const { svg, ctx } = setup({ isEnabled: true });
    const c = centre(ctx);
    svg.dispatchEvent(new MouseEvent('pointerdown', { clientX: c.x, clientY: c.y, bubbles: true }));
    svg.dispatchEvent(
      new MouseEvent('pointermove', { clientX: c.x + 200, clientY: c.y, bubbles: true }),
    );
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: c.x + 200, clientY: c.y }));
    expect(getZoomView(svg)?.x.k).toBe(1);
  });

  it('isWheelEnabled off also turns the pinch off', () => {
    const { svg, ctx } = setup({ isEnabled: true, isWheelEnabled: false });
    const c = centre(ctx);
    touch(svg, 'pointerdown', 1, c.x - 50, c.y);
    touch(svg, 'pointerdown', 2, c.x + 50, c.y);
    touch(svg, 'pointermove', 2, c.x + 100, c.y);
    expect(getZoomView(svg)?.x.k).toBe(1);
    touch(svg, 'pointerup', 2, c.x + 100, c.y);
    touch(svg, 'pointerup', 1, c.x - 50, c.y);
  });
});
