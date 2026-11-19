// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { serializeSvg } from '../src/export/png';
import { plot } from '../src/plot/index';
import type { Mark, PlotSpec } from '../src/plot/types';

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
      // Nothing to draw: the tests read the clip rectangle only.
    },
  };
}

function spec(extra: Partial<PlotSpec> = {}): PlotSpec {
  return {
    width: 500,
    height: 400,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    marks: [points()],
    ...extra,
  };
}

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

function clipWidth(svg: SVGSVGElement): number {
  return Number(svg.querySelector('.d3s-plot > defs > clipPath > rect')?.getAttribute('width'));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('first display animation', () => {
  it('is off by default: the plot area is shown at once', () => {
    const svg = makeSvg();
    plot(svg, spec());
    expect(clipWidth(svg)).toBe(500);
  });

  it('reveals the marks from left to right, to the full width', async () => {
    const svg = makeSvg();
    plot(svg, spec({ animation: { duration: 60, easing: 'linear' } }));
    expect(clipWidth(svg)).toBe(0);
    await wait(30);
    const halfway = clipWidth(svg);
    await wait(150);
    expect(clipWidth(svg)).toBe(500);
    expect(halfway).toBeLessThanOrEqual(500);
  });

  it('plays on the first draw only, not on a data update', () => {
    const svg = makeSvg();
    plot(svg, spec());
    plot(svg, spec({ animation: { duration: 60 } }));
    expect(clipWidth(svg)).toBe(500);
  });

  it('is skipped when turned off', () => {
    const svg = makeSvg();
    plot(svg, spec({ animation: { isEnabled: false } }));
    expect(clipWidth(svg)).toBe(500);
  });

  it('gives way to a zoom redraw, which shows the full plot area', async () => {
    const svg = makeSvg();
    plot(svg, spec({ animation: { duration: 200 }, zoom: { isEnabled: true } }));
    expect(clipWidth(svg)).toBe(0);
    svg.dispatchEvent(
      new WheelEvent('wheel', { clientX: 250, clientY: 200, deltaY: -100, cancelable: true }),
    );
    expect(clipWidth(svg)).toBe(500);
    await wait(50);
    expect(clipWidth(svg)).toBe(500);
  });

  it('is exported whole while it runs', () => {
    const svg = makeSvg();
    plot(svg, spec({ animation: { duration: 200 } }));
    expect(clipWidth(svg)).toBe(0);
    const exported = serializeSvg(svg);
    const parsed = new DOMParser().parseFromString(exported, 'image/svg+xml');
    const rect = parsed.querySelector('clipPath > rect');
    expect(rect?.getAttribute('width')).toBe('500');
    expect(exported).not.toContain('data-d3s-full-width');
    expect(clipWidth(svg)).toBe(0);
  });
});
