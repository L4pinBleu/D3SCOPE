// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { listCharts, registerPlugin, renderChart, unregisterPlugin } from '@d3scope/core/plugin';
import plugin, { BRUSH_CHART, createTimeRangeLink } from '../src/index';
import { brushRange, renderBrush } from '../src/brush';
import {
  layoutBrush,
  pixelsToRange,
  rangeToPixels,
  sameRange,
  timeToX,
  xToTime,
} from '../src/layout';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 0, 1);
const DATA = [0, 1, 2, 3, 4].map((i) => ({ date: new Date(T0 + i * DAY), value: i * 10 }));
const OPTS = { width: 400, height: 60 };

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

function mouse(type: string, clientX: number, target: EventTarget = window): void {
  target.dispatchEvent(new MouseEvent(type, { clientX, bubbles: true }));
}

function overlay(svg: SVGSVGElement): SVGRectElement {
  const el = svg.querySelector<SVGRectElement>('rect.overlay');
  if (!el) throw new Error('no overlay');
  return el;
}

describe('layoutBrush and time maths', () => {
  it('maps the first and last dates to the edges of the overview', () => {
    const l = layoutBrush(DATA, 400, 60);
    expect(timeToX(T0, l)).toBeCloseTo(0);
    expect(timeToX(T0 + 4 * DAY, l)).toBeCloseTo(400);
    expect(xToTime(200, l)).toBeCloseTo(T0 + 2 * DAY);
  });

  it('builds line and area paths, and an empty layout for no data', () => {
    const l = layoutBrush(DATA, 400, 60);
    expect(l.linePath.startsWith('M')).toBe(true);
    expect(l.areaPath.endsWith('Z')).toBe(true);
    const empty = layoutBrush([], 400, 60);
    expect(empty.linePath).toBe('');
    expect(empty.areaPath).toBe('');
  });

  it('round-trips a range through pixels, sorted and clamped', () => {
    const l = layoutBrush(DATA, 400, 60);
    const px = rangeToPixels([new Date(T0 + 3 * DAY), new Date(T0 + DAY)], l);
    expect(px[0]).toBeCloseTo(100);
    expect(px[1]).toBeCloseTo(300);
    const range = pixelsToRange(-50, 1000, l);
    expect(range[0].getTime()).toBe(T0);
    expect(range[1].getTime()).toBe(T0 + 4 * DAY);
  });

  it('compares ranges by their instants', () => {
    const a = [new Date(T0), new Date(T0 + DAY)] as const;
    const b = [new Date(T0), new Date(T0 + DAY)] as const;
    expect(sameRange(a, b)).toBe(true);
    expect(sameRange(a, undefined)).toBe(false);
    expect(sameRange(undefined, undefined)).toBe(true);
  });
});

describe('createTimeRangeLink', () => {
  it('stores the range, notifies listeners, and stops after unsubscribe', () => {
    const link = createTimeRangeLink();
    const seen: unknown[] = [];
    const off = link.subscribe((r) => seen.push(r));
    const range = [new Date(T0), new Date(T0 + DAY)] as const;
    link.set(range);
    expect(link.get()).toBe(range);
    off();
    link.set(undefined);
    expect(seen).toEqual([range]);
  });
});

describe('renderBrush', () => {
  it('draws the overview and an overlay, with no selection by default', () => {
    const svg = makeSvg();
    renderBrush(svg, DATA, OPTS);
    expect(svg.querySelector('path.area')).not.toBeNull();
    expect(svg.querySelector('rect.selection')).toBeNull();
    expect(brushRange(svg)).toBeUndefined();
  });

  it('selects a range by dragging on the overview, and publishes it', () => {
    const svg = makeSvg();
    const onChange = vi.fn();
    const link = createTimeRangeLink();
    renderBrush(svg, DATA, { ...OPTS, onChange, link });
    mouse('mousedown', 100, overlay(svg));
    mouse('mousemove', 300);
    mouse('mouseup', 300);
    const range = brushRange(svg);
    expect(range?.[0].getTime()).toBeCloseTo(T0 + DAY);
    expect(range?.[1].getTime()).toBeCloseTo(T0 + 3 * DAY);
    expect(svg.querySelector('rect.selection')).not.toBeNull();
    expect(onChange).toHaveBeenCalledOnce();
    expect(link.get()).toEqual(range);
  });

  it('moves an existing selection when dragged inside it', () => {
    const svg = makeSvg();
    renderBrush(svg, DATA, { ...OPTS, range: [new Date(T0), new Date(T0 + DAY)] });
    // Selection is [0, 100] px; drag from 50 to 150 moves it by 100 px.
    mouse('mousedown', 50, overlay(svg));
    mouse('mousemove', 150);
    mouse('mouseup', 150);
    const range = brushRange(svg);
    expect(range?.[0].getTime()).toBeCloseTo(T0 + DAY);
    expect(range?.[1].getTime()).toBeCloseTo(T0 + 2 * DAY);
  });

  it('treats a click without drag as no selection, and publishes that', () => {
    const svg = makeSvg();
    const onChange = vi.fn();
    renderBrush(svg, DATA, { ...OPTS, onChange });
    mouse('mousedown', 120, overlay(svg));
    mouse('mouseup', 120);
    expect(brushRange(svg)).toBeUndefined();
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('clears the selection on double click', () => {
    const svg = makeSvg();
    const onChange = vi.fn();
    renderBrush(svg, DATA, { ...OPTS, range: [new Date(T0), new Date(T0 + DAY)], onChange });
    overlay(svg).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(brushRange(svg)).toBeUndefined();
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('follows the shared link when another chart changes it, without echoing back', () => {
    const svg = makeSvg();
    const link = createTimeRangeLink();
    const onChange = vi.fn();
    renderBrush(svg, DATA, { ...OPTS, link, onChange });
    const other = [new Date(T0 + DAY), new Date(T0 + 2 * DAY)] as const;
    link.set(other);
    expect(brushRange(svg)?.[0].getTime()).toBeCloseTo(T0 + DAY);
    expect(onChange).not.toHaveBeenCalled();
    link.set(undefined);
    expect(brushRange(svg)).toBeUndefined();
  });

  it('starts from the shared link when it already holds a range', () => {
    const svg = makeSvg();
    const link = createTimeRangeLink([new Date(T0 + 2 * DAY), new Date(T0 + 4 * DAY)]);
    renderBrush(svg, DATA, { ...OPTS, link, range: [new Date(T0), new Date(T0 + DAY)] });
    expect(brushRange(svg)?.[0].getTime()).toBeCloseTo(T0 + 2 * DAY);
  });

  it('removes the previous render listeners when redrawn', () => {
    const svg = makeSvg();
    const onChange = vi.fn();
    renderBrush(svg, DATA, { ...OPTS, onChange });
    renderBrush(svg, DATA, { ...OPTS, onChange });
    mouse('mousedown', 100, overlay(svg));
    mouse('mouseup', 300);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('brush plugin', () => {
  it('registers the brush chart with the core and draws through renderChart', () => {
    registerPlugin(plugin);
    try {
      expect(listCharts()).toContain(BRUSH_CHART);
      const svg = makeSvg();
      renderChart(BRUSH_CHART, svg, DATA, OPTS);
      expect(svg.querySelector('path.area')).not.toBeNull();
    } finally {
      unregisterPlugin('d3scope-plugin-brush');
    }
  });
});
