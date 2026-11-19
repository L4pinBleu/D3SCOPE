// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  getVisibleDomain,
  getZoomView,
  linkZoom,
  onZoom,
  panBy,
  plot,
  resetZoom,
  setVisibleDomain,
  setZoomView,
  zoomBy,
} from '../src/plot/index';
import type { Mark, PlotSpec, ZoomEvent } from '../src/plot/types';

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
      // Nothing to draw: the tests read the view only.
    },
  };
}

function setup(
  zoom: NonNullable<PlotSpec['zoom']> = { isEnabled: true },
  size = { width: 500, height: 400 },
): SVGSVGElement {
  const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
  document.body.appendChild(svg);
  plot(svg, { ...size, margin: { top: 0, right: 0, bottom: 0, left: 0 }, marks: [points()], zoom });
  return svg;
}

function domain(svg: SVGSVGElement): { x: number[]; y: number[] } {
  const visible = getVisibleDomain(svg);
  if (!visible) throw new Error('zoom is off');
  const round = (v: unknown): number => Math.round(Number(v) * 1000) / 1000;
  return { x: visible.x.map(round), y: visible.y.map(round) };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('setVisibleDomain and getVisibleDomain', () => {
  it('shows the requested range on each axis', () => {
    const svg = setup();
    expect(domain(svg)).toEqual({ x: [0, 100], y: [0, 100] });
    setVisibleDomain(svg, { x: [20, 40], y: [50, 75] });
    expect(domain(svg)).toEqual({ x: [20, 40], y: [50, 75] });
  });

  it('accepts the range in any order, and leaves a missing axis as it is', () => {
    const svg = setup();
    setVisibleDomain(svg, { x: [60, 10] });
    expect(domain(svg)).toEqual({ x: [10, 60], y: [0, 100] });
  });

  it('cuts a range past the data to the bounds of the axis', () => {
    const svg = setup();
    setVisibleDomain(svg, { x: [-50, 150] });
    expect(domain(svg).x).toEqual([0, 100]);
  });

  it('respects the zoom limits', () => {
    const svg = setup({ isEnabled: true, x: { minSpan: 10 } });
    setVisibleDomain(svg, { x: [40, 42] });
    const [low, high] = domain(svg).x;
    expect((high ?? 0) - (low ?? 0)).toBeCloseTo(10);
  });

  it('rejects an empty range', () => {
    const svg = setup();
    expect(() => {
      setVisibleDomain(svg, { x: [5, 5] });
    }).toThrow(RangeError);
  });

  it('does nothing when zoom is off', () => {
    const svg = setup({ isEnabled: false });
    setVisibleDomain(svg, { x: [20, 40] });
    expect(getVisibleDomain(svg)).toBeUndefined();
  });

  it('leaves an axis out of zoom.axes as it is', () => {
    const svg = setup({ isEnabled: true, axes: 'x' });
    setVisibleDomain(svg, { x: [20, 40], y: [20, 40] });
    expect(domain(svg)).toEqual({ x: [20, 40], y: [0, 100] });
  });
});

describe('zoomBy and panBy', () => {
  it('zooms around the centre by default', () => {
    const svg = setup();
    zoomBy(svg, 2);
    expect(domain(svg)).toEqual({ x: [25, 75], y: [25, 75] });
    zoomBy(svg, 0.5);
    expect(domain(svg)).toEqual({ x: [0, 100], y: [0, 100] });
  });

  it('zooms one axis only, around a given point', () => {
    const svg = setup();
    zoomBy(svg, 2, { axes: 'x', center: { x: 0 } });
    expect(domain(svg)).toEqual({ x: [0, 50], y: [0, 100] });
  });

  it('rejects a factor that is not a positive number', () => {
    const svg = setup();
    expect(() => {
      zoomBy(svg, 0);
    }).toThrow(RangeError);
  });

  it('moves by a share of the visible range, towards the end of each axis', () => {
    const svg = setup();
    setVisibleDomain(svg, { x: [20, 40], y: [20, 40] });
    panBy(svg, { x: 0.5, y: 0.5 });
    expect(domain(svg)).toEqual({ x: [30, 50], y: [30, 50] });
    panBy(svg, { x: -1 });
    expect(domain(svg).x).toEqual([10, 30]);
  });

  it('stops at the edge of the data', () => {
    const svg = setup();
    setVisibleDomain(svg, { x: [80, 90] });
    panBy(svg, { x: 5 });
    expect(domain(svg).x).toEqual([90, 100]);
  });
});

describe('setZoomView and resetZoom', () => {
  it('sets a view, kept within the bounds', () => {
    const svg = setup();
    setZoomView(svg, { x: { k: 2, t: 100 }, y: { k: 1, t: 0 } });
    expect(getZoomView(svg)?.x).toEqual({ k: 2, t: 0 });
    resetZoom(svg);
    expect(getZoomView(svg)?.x).toEqual({ k: 1, t: 0 });
  });
});

describe('onZoom', () => {
  it('tells the listener about each change, with its source, until it stops', () => {
    const svg = setup();
    const events: ZoomEvent[] = [];
    const stop = onZoom(svg, (event) => events.push(event));
    zoomBy(svg, 2);
    resetZoom(svg);
    expect(events.map((e) => e.source)).toEqual(['control', 'reset']);
    expect(events[0]?.svg).toBe(svg);
    stop();
    zoomBy(svg, 2);
    expect(events).toHaveLength(2);
  });

  it('keeps listening when the plot is drawn again', () => {
    const svg = setup();
    const sources: string[] = [];
    onZoom(svg, (event) => sources.push(event.source));
    plot(svg, { width: 500, height: 400, marks: [points()], zoom: { isEnabled: true } });
    zoomBy(svg, 2);
    expect(sources).toEqual(['control']);
  });

  it('is not called when the view does not change', () => {
    const svg = setup();
    const sources: string[] = [];
    onZoom(svg, (event) => sources.push(event.source));
    resetZoom(svg);
    expect(sources).toEqual([]);
  });
});

describe('linkZoom', () => {
  it('copies the view of the linked axes, as a share of each plot area', () => {
    const top = setup();
    const bottom = setup({ isEnabled: true }, { width: 1000, height: 200 });
    linkZoom([top, bottom], { axes: 'x' });
    setVisibleDomain(top, { x: [20, 40], y: [10, 20] });
    expect(domain(bottom)).toEqual({ x: [20, 40], y: [0, 100] });
    zoomBy(bottom, 2, { axes: 'x' });
    expect(domain(top).x).toEqual([25, 35]);
  });

  it('aligns the other plots on the first one at once', () => {
    const top = setup();
    const bottom = setup();
    setVisibleDomain(top, { x: [20, 40] });
    linkZoom([top, bottom]);
    expect(domain(bottom).x).toEqual([20, 40]);
  });

  it('stops copying once unlinked', () => {
    const top = setup();
    const bottom = setup();
    const unlink = linkZoom([top, bottom]);
    unlink();
    zoomBy(top, 2);
    expect(domain(bottom).x).toEqual([0, 100]);
  });

  it('tells the listeners of the linked plot, with the source link', () => {
    const top = setup();
    const bottom = setup();
    linkZoom([top, bottom]);
    const sources: string[] = [];
    onZoom(bottom, (event) => sources.push(event.source));
    zoomBy(top, 2);
    expect(sources).toEqual(['link']);
  });
});

describe('animation', () => {
  it('reaches the target view at the end of the duration, through intermediate views', async () => {
    const svg = setup({ isEnabled: true, animation: { duration: 60, easing: 'linear' } });
    const widths: number[] = [];
    onZoom(svg, () => {
      const [low, high] = domain(svg).x;
      widths.push((high ?? 0) - (low ?? 0));
    });
    setVisibleDomain(svg, { x: [40, 60] });
    // The view has not jumped yet.
    expect(domain(svg).x).toEqual([0, 100]);
    await wait(200);
    expect(domain(svg).x).toEqual([40, 60]);
    expect(widths.at(-1)).toBeCloseTo(20);
    expect(widths.some((w) => w > 20 && w < 100)).toBe(true);
  });

  it('is instant when the call asks for no animation', () => {
    const svg = setup({ isEnabled: true, animation: { duration: 60 } });
    zoomBy(svg, 2, { animate: false });
    expect(domain(svg).x).toEqual([25, 75]);
  });

  it('is instant when the animation is turned off', () => {
    const svg = setup({ isEnabled: true, animation: { isEnabled: false } });
    zoomBy(svg, 2);
    expect(domain(svg).x).toEqual([25, 75]);
  });

  it('chains the calls made during an animation from its target', async () => {
    const svg = setup({ isEnabled: true, animation: { duration: 40 } });
    zoomBy(svg, 2);
    zoomBy(svg, 2);
    await wait(150);
    expect(domain(svg).x).toEqual([37.5, 62.5]);
  });

  it('lets linked plots animate together, each towards its own target', async () => {
    const animation = { duration: 40 };
    const top = setup({ isEnabled: true, animation });
    const bottom = setup({ isEnabled: true, animation });
    linkZoom([top, bottom], { axes: 'x' });
    setVisibleDomain(top, { x: [20, 40], y: [20, 40] }, { animate: false });
    setVisibleDomain(bottom, { y: [60, 80] }, { animate: false });
    resetZoom(top);
    setZoomView(bottom, { x: getZoomView(bottom)?.x ?? { k: 1, t: 0 }, y: { k: 1, t: 0 } });
    await wait(200);
    expect(domain(top)).toEqual({ x: [0, 100], y: [0, 100] });
    expect(domain(bottom)).toEqual({ x: [0, 100], y: [0, 100] });
  });

  it('keeps the axis it does not animate free for a linked plot', async () => {
    const top = setup({ isEnabled: true });
    const bottom = setup({ isEnabled: true, animation: { duration: 60 } });
    linkZoom([top, bottom], { axes: 'x' });
    zoomBy(bottom, 2, { axes: 'y' });
    setVisibleDomain(top, { x: [10, 30] });
    await wait(200);
    expect(domain(bottom)).toEqual({ x: [10, 30], y: [25, 75] });
  });

  it('animates on demand, even without the animation option', async () => {
    const svg = setup();
    resetZoom(svg);
    zoomBy(svg, 2, { animate: true });
    expect(domain(svg).x).toEqual([0, 100]);
    await wait(600);
    expect(domain(svg).x).toEqual([25, 75]);
  });
});
