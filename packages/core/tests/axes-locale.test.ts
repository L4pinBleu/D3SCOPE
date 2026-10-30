// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { AxisDomain, AxisScale } from 'd3-axis';
import { defaultTickFormat, renderAxis } from '../src/axes/index.js';
import { bandScale, linearScale, timeScale } from '../src/scales/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function labels<D extends AxisDomain>(
  scale: AxisScale<D>,
  locale?: 'fr-FR' | 'en-US',
  tickCount?: number,
): string[] {
  const group = document.createElementNS(SVG_NS, 'g');
  document.body.appendChild(group);
  renderAxis(group, scale, {
    orientation: 'bottom',
    locale,
    ...(tickCount === undefined ? {} : { tickCount }),
  });
  const out = Array.from(group.querySelectorAll('g.tick text'), (t) => t.textContent);
  group.remove();
  return out;
}

describe('default tick labels are locale-aware', () => {
  it('uses a decimal comma and grouping for numbers in fr-FR', () => {
    const out = labels(linearScale([0, 2500], [0, 300], { nice: true }));
    expect(out).toContain('1\u00a0000');
    expect(out).toContain('2\u00a0000');
  });

  it('uses the step to choose decimals (a 0.5 step shows one digit)', () => {
    const out = labels(linearScale([0, 2], [0, 300], { nice: false }), 'fr-FR', 4);
    expect(out).toContain('0,5');
    expect(out).toContain('1,5');
  });

  it('uses a dot in en-US', () => {
    const out = labels(linearScale([0, 2], [0, 300], { nice: false }), 'en-US', 4);
    expect(out).toContain('0.5');
  });

  it('formats time ticks with the locale date pattern', () => {
    const scale = timeScale([new Date(2026, 0, 1), new Date(2026, 0, 31)], [0, 300]);
    const out = labels(scale);
    expect(out.some((t) => /^\d{2}\/\d{2}\/2026$/.test(t))).toBe(true);
  });

  it('keeps band labels as they are', () => {
    const out = labels(bandScale(['Jan', 'Fév'], [0, 200]));
    expect(out).toEqual(['Jan', 'Fév']);
  });
});

describe('defaultTickFormat', () => {
  it('returns undefined for band scales', () => {
    expect(defaultTickFormat(bandScale(['a'], [0, 10]), 5, undefined)).toBeUndefined();
  });

  it('returns a formatter for numeric and time scales', () => {
    expect(defaultTickFormat(linearScale([0, 10], [0, 10]), 5, undefined)).toBeTypeOf('function');
    expect(
      defaultTickFormat(timeScale([new Date(0), new Date(1)], [0, 10]), 5, undefined),
    ).toBeTypeOf('function');
  });

  it('handles a single tick without dividing by zero', () => {
    const fmt = defaultTickFormat(linearScale([5, 5], [0, 10]), 1, 'en-US');
    expect(fmt?.(5)).toBe('5');
  });
});
