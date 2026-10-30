// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  layoutCategoricalLegend,
  renderCategoricalLegend,
  type LegendItem,
} from '../src/legends/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const ITEMS: LegendItem[] = [
  { label: 'Actions', color: '#4a9eed' },
  { label: 'Crypto', color: '#f59e0b' },
  { label: 'Cash', color: '#22c55e' },
];

function makeGroup(): SVGGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const g: SVGGElement = document.createElementNS(SVG_NS, 'g');
  svg.appendChild(g);
  document.body.appendChild(svg);
  return g;
}

describe('layoutCategoricalLegend', () => {
  it('stacks items vertically by default', () => {
    const { entries, height } = layoutCategoricalLegend(ITEMS, {
      swatchSize: 10,
      fontSize: 10,
      itemGap: 5,
    });
    expect(entries.map((e) => e.x)).toEqual([0, 0, 0]);
    expect(entries.map((e) => e.y)).toEqual([0, 15, 30]);
    expect(height).toBe(40); // 3 rows of 10 + 2 gaps of 5
  });

  it('places items in a row when horizontal', () => {
    const { entries, height } = layoutCategoricalLegend(ITEMS, {
      orientation: 'horizontal',
      swatchSize: 10,
      labelGap: 0,
      itemGap: 0,
      fontSize: 10,
    });
    expect(entries.map((e) => e.y)).toEqual([0, 0, 0]);
    // each item: swatch 10 + label (chars * 10 * 0.6), no gap
    expect(entries[1]?.x).toBeCloseTo(10 + 'Actions'.length * 6);
    expect(height).toBe(10);
  });

  it('estimates the width from the longest label when vertical', () => {
    const { width } = layoutCategoricalLegend(ITEMS, {
      swatchSize: 10,
      labelGap: 4,
      fontSize: 10,
    });
    // longest label is "Actions" (7 chars): 10 + 4 + 7 * 10 * 0.6
    expect(width).toBeCloseTo(10 + 4 + 42);
  });

  it('returns an empty layout for no items', () => {
    expect(layoutCategoricalLegend([])).toEqual({ entries: [], width: 0, height: 0 });
  });

  it('keeps the item data on each entry', () => {
    const { entries } = layoutCategoricalLegend(ITEMS);
    expect(entries[2]?.item).toEqual({ label: 'Cash', color: '#22c55e' });
  });
});

describe('renderCategoricalLegend', () => {
  it('draws one swatch and one label per item', () => {
    const g = makeGroup();
    renderCategoricalLegend(g, ITEMS);
    expect(g.querySelectorAll('g.legend-entry').length).toBe(3);
    expect(g.querySelectorAll('rect').length).toBe(3);
    const labels = Array.from(g.querySelectorAll('text'), (t) => t.textContent);
    expect(labels).toEqual(['Actions', 'Crypto', 'Cash']);
  });

  it('uses the item colour for the swatch', () => {
    const g = makeGroup();
    renderCategoricalLegend(g, ITEMS);
    const fills = Array.from(g.querySelectorAll('rect'), (r) => r.getAttribute('fill'));
    expect(fills).toEqual(['#4a9eed', '#f59e0b', '#22c55e']);
  });

  it('positions entries with a translate transform', () => {
    const g = makeGroup();
    renderCategoricalLegend(g, ITEMS, { swatchSize: 10, itemGap: 5, fontSize: 10 });
    const transforms = Array.from(g.querySelectorAll('g.legend-entry'), (e) =>
      e.getAttribute('transform'),
    );
    expect(transforms).toEqual(['translate(0,0)', 'translate(0,15)', 'translate(0,30)']);
  });

  it('replaces entries on redraw instead of duplicating them', () => {
    const g = makeGroup();
    renderCategoricalLegend(g, ITEMS);
    renderCategoricalLegend(g, ITEMS.slice(0, 1));
    expect(g.querySelectorAll('g.legend-entry').length).toBe(1);
  });

  it('returns the layout it drew', () => {
    const g = makeGroup();
    const layout = renderCategoricalLegend(g, ITEMS, { orientation: 'horizontal' });
    expect(layout.entries.length).toBe(3);
    expect(layout.height).toBeGreaterThan(0);
  });
});
