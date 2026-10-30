// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { bandScale, linearScale, timeScale } from '../src/scales/index.js';
import { createAxis, renderAxis } from '../src/axes/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeGroup(): SVGGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const g: SVGGElement = document.createElementNS(SVG_NS, 'g');
  svg.appendChild(g);
  document.body.appendChild(svg);
  return g;
}

function tickLabels(group: SVGGElement): string[] {
  return Array.from(group.querySelectorAll('.tick text'), (t) => t.textContent);
}

describe('createAxis', () => {
  it('builds an axis for the given orientation', () => {
    const scale = linearScale([0, 10], [0, 100], { nice: false });
    const g = makeGroup();
    renderAxis(g, scale, { orientation: 'bottom' });
    // a bottom axis places its tick labels below the axis line (positive y)
    const transform = g.querySelector('.tick')?.getAttribute('transform') ?? '';
    expect(transform).toMatch(/^translate\(/);
    expect(g.querySelector('.domain')).not.toBeNull();
  });

  it('returns a configured d3 axis generator', () => {
    const scale = linearScale([0, 10], [0, 100]);
    const axis = createAxis(scale, { orientation: 'left', tickCount: 3, tickSize: 10 });
    expect(typeof axis).toBe('function');
    expect(axis.tickSize()).toBe(10);
  });
});

describe('renderAxis', () => {
  it('draws one tick per value from the scale (default count)', () => {
    const g = makeGroup();
    renderAxis(g, linearScale([0, 10], [0, 100], { nice: false }), { orientation: 'bottom' });
    // d3 default: about 10 ticks on 0..10
    expect(g.querySelectorAll('.tick').length).toBe(11);
  });

  it('honours tickCount', () => {
    const g = makeGroup();
    renderAxis(g, linearScale([0, 10], [0, 100], { nice: false }), {
      orientation: 'bottom',
      tickCount: 5,
    });
    expect(tickLabels(g)).toEqual(['0', '2', '4', '6', '8', '10']);
  });

  it('applies tickFormat to each label', () => {
    const g = makeGroup();
    renderAxis(g, linearScale([0, 10], [0, 100], { nice: false }), {
      orientation: 'bottom',
      tickCount: 2,
      tickFormat: (v) => `${String(v)} €`,
    });
    expect(tickLabels(g)).toEqual(['0 €', '5 €', '10 €']);
  });

  it('applies tickSize and tickPadding to the tick lines and labels', () => {
    const g = makeGroup();
    renderAxis(g, linearScale([0, 10], [0, 100], { nice: false }), {
      orientation: 'bottom',
      tickCount: 2,
      tickSize: 12,
      tickPadding: 7,
    });
    const line = g.querySelector('.tick line');
    expect(line?.getAttribute('y2')).toBe('12');
    const text = g.querySelector('.tick text');
    expect(text?.getAttribute('y')).toBe('19'); // tickSize + tickPadding
  });

  it('draws the left axis on the left side (domain line at x≈0, ticks extend left)', () => {
    const g = makeGroup();
    renderAxis(g, linearScale([0, 10], [100, 0], { nice: false }), { orientation: 'left' });
    // d3 path: M(-tickSize),(range end) H0.5 V(range start) H(-tickSize)
    expect(g.querySelector('.domain')?.getAttribute('d')).toMatch(/^M-6,.*H0\.5/);
  });

  it('renders a time scale with date labels', () => {
    const g = makeGroup();
    const scale = timeScale(
      [new Date('2026-01-01T00:00:00Z'), new Date('2026-01-04T00:00:00Z')],
      [0, 300],
      { nice: false },
    );
    renderAxis(g, scale, { orientation: 'bottom', tickCount: 3 });
    expect(g.querySelectorAll('.tick').length).toBeGreaterThan(0);
  });

  it('renders a band scale with one label per category', () => {
    const g = makeGroup();
    renderAxis(g, bandScale(['a', 'b', 'c'], [0, 300]), { orientation: 'bottom' });
    expect(tickLabels(g)).toEqual(['a', 'b', 'c']);
  });

  it('replaces ticks on redraw instead of duplicating them', () => {
    const g = makeGroup();
    const opts = { orientation: 'bottom' as const, tickCount: 5 };
    renderAxis(g, linearScale([0, 10], [0, 100], { nice: false }), opts);
    renderAxis(g, linearScale([0, 20], [0, 100], { nice: false }), opts);
    expect(tickLabels(g)).toEqual(['0', '5', '10', '15', '20']);
  });
});
