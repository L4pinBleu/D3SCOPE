// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  interpolateColor,
  layoutContinuousLegend,
  parseHexColor,
  renderContinuousLegend,
} from '../src/legends/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeGroup(): SVGGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const group = document.createElementNS(SVG_NS, 'g');
  svg.appendChild(group);
  document.body.appendChild(svg);
  return group;
}

describe('parseHexColor / interpolateColor', () => {
  it('parses #rrggbb and rejects other formats', () => {
    expect(parseHexColor('#ff8000')).toEqual([255, 128, 0]);
    expect(() => parseHexColor('red')).toThrow(RangeError);
    expect(() => parseHexColor('#fff')).toThrow(RangeError);
  });

  it('returns the end colours at 0 and 1, and the midpoint between two colours', () => {
    expect(interpolateColor(['#000000', '#ffffff'], 0)).toBe('#000000');
    expect(interpolateColor(['#000000', '#ffffff'], 1)).toBe('#ffffff');
    expect(interpolateColor(['#000000', '#ffffff'], 0.5)).toBe('#808080');
  });

  it('walks through several colours and clamps out-of-range input', () => {
    const ramp = ['#000000', '#ff0000', '#00ff00'];
    expect(interpolateColor(ramp, 0.5)).toBe('#ff0000');
    expect(interpolateColor(ramp, -1)).toBe('#000000');
    expect(interpolateColor(ramp, 2)).toBe('#00ff00');
  });
});

describe('layoutContinuousLegend', () => {
  it('builds the requested number of stops from low to high', () => {
    const l = layoutContinuousLegend([0, 100], { colors: ['#000000', '#ffffff'], stops: 3 });
    expect(l.stops.map((s) => s.offset)).toEqual([0, 0.5, 1]);
    expect(l.stops[0]?.color).toBe('#000000');
    expect(l.stops[2]?.color).toBe('#ffffff');
  });

  it('places ticks along the bar, in px from the low end', () => {
    const l = layoutContinuousLegend([0, 10], { length: 100, tickCount: 5 });
    expect(l.ticks.map((t) => t.value)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(l.ticks[0]?.position).toBeCloseTo(0);
    expect(l.ticks[l.ticks.length - 1]?.position).toBeCloseTo(100);
  });

  it('formats tick labels in the chosen locale', () => {
    const fr = layoutContinuousLegend([0, 2500], { length: 200, locale: 'fr-FR' });
    expect(fr.ticks.map((t) => t.label)).toContain('1\u00a0000');
    const en = layoutContinuousLegend([0, 2500], { length: 200, locale: 'en-US' });
    expect(en.ticks.map((t) => t.label)).toContain('1,000');
  });

  it('draws one tick at the middle for a flat domain', () => {
    const l = layoutContinuousLegend([5, 5], { length: 80 });
    expect(l.ticks).toEqual([{ value: 5, position: 40, label: '5' }]);
  });

  it('defaults to a horizontal legend with white-to-accent colours', () => {
    const l = layoutContinuousLegend([0, 1]);
    expect(l.orientation).toBe('horizontal');
    expect(l.stops[0]?.color).toBe('#ffffff');
  });

  it('rejects an unordered domain, too few colours, or a bad colour', () => {
    expect(() => layoutContinuousLegend([10, 0])).toThrow(RangeError);
    expect(() => layoutContinuousLegend([0, Number.NaN])).toThrow(RangeError);
    expect(() => layoutContinuousLegend([0, 1], { colors: ['#000000'] })).toThrow(RangeError);
    expect(() => layoutContinuousLegend([0, 1], { colors: ['#000000', 'blue'] })).toThrow(
      RangeError,
    );
  });
});

describe('renderContinuousLegend', () => {
  it('draws a gradient, a bar filled with it, and one label per tick', () => {
    const group = makeGroup();
    const layout = renderContinuousLegend(group, [0, 10], { length: 100 });
    const gradient = group.querySelector('linearGradient');
    expect(gradient).not.toBeNull();
    expect(group.querySelectorAll('stop')).toHaveLength(layout.stops.length);
    const bar = group.querySelector('rect.gradient');
    expect(bar?.getAttribute('fill')).toBe(`url(#${gradient?.id ?? ''})`);
    expect(group.querySelectorAll('text.tick-label')).toHaveLength(layout.ticks.length);
  });

  it('gives each redraw a new gradient id and replaces the contents', () => {
    const group = makeGroup();
    renderContinuousLegend(group, [0, 10]);
    const first = group.querySelector('linearGradient')?.id;
    renderContinuousLegend(group, [0, 10]);
    expect(group.querySelectorAll('linearGradient')).toHaveLength(1);
    expect(group.querySelector('linearGradient')?.id).not.toBe(first);
  });

  it('runs bottom-to-top for a vertical legend', () => {
    const group = makeGroup();
    const layout = renderContinuousLegend(group, [0, 10], {
      orientation: 'vertical',
      length: 100,
      tickCount: 2,
    });
    const lowLabel = Array.from(group.querySelectorAll('text.tick-label')).find(
      (t) => t.textContent === String(layout.ticks[0]?.label),
    );
    // Low values sit at the bottom: y is the full length, not 0.
    expect(Number(lowLabel?.getAttribute('y'))).toBeCloseTo(100);
    expect(group.querySelector('linearGradient')?.getAttribute('y2')).toBe('100%');
  });
});
