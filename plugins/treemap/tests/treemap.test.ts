// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { listCharts, registerPlugin, renderChart, unregisterPlugin } from '@d3scope/core/plugin';
import plugin, { TREEMAP_CHART } from '../src/index';
import { layoutTreemap, type TreeNode } from '../src/layout';
import { renderTreemap, treemapPath } from '../src/treemap';

const SVG_NS = 'http://www.w3.org/2000/svg';
const TREE: TreeNode = {
  name: 'Portefeuille',
  children: [
    { name: 'Actions', value: 60 },
    {
      name: 'Obligations',
      children: [
        { name: 'État', value: 20 },
        { name: 'Entreprises', value: 10 },
      ],
    },
    { name: 'Liquidités', value: 10 },
  ],
};

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

function cells(svg: SVGSVGElement): SVGGElement[] {
  return Array.from(svg.querySelectorAll<SVGGElement>('g.treemap-cell'));
}

function headerText(svg: SVGSVGElement): string {
  return svg.querySelector('g.treemap-header text')?.textContent ?? '';
}

function click(el: Element | null | undefined): void {
  el?.dispatchEvent(new MouseEvent('click'));
}

describe('layoutTreemap', () => {
  it('makes one cell per child, largest first, with leaf sums as values', () => {
    const out = layoutTreemap(TREE, 300, 200, 0);
    expect(out.map((c) => c.name)).toEqual(['Actions', 'Obligations', 'Liquidités']);
    expect(out.map((c) => c.value)).toEqual([60, 30, 10]);
    expect(out.map((c) => c.hasChildren)).toEqual([false, true, false]);
  });

  it('gives each cell an area proportional to its value and keeps cells inside the box', () => {
    const out = layoutTreemap(TREE, 300, 200, 0);
    const total = out.reduce((s, c) => s + (c.x1 - c.x0) * (c.y1 - c.y0), 0);
    expect(total).toBeCloseTo(300 * 200, 0);
    for (const c of out) {
      expect(c.x0).toBeGreaterThanOrEqual(0);
      expect(c.y0).toBeGreaterThanOrEqual(0);
      expect(c.x1).toBeLessThanOrEqual(300 + 1e-6);
      expect(c.y1).toBeLessThanOrEqual(200 + 1e-6);
      expect(((c.x1 - c.x0) * (c.y1 - c.y0)) / (300 * 200)).toBeCloseTo(c.value / 100, 1);
    }
  });

  it('returns no cells for an empty tree', () => {
    expect(layoutTreemap({ name: 'empty', children: [] }, 100, 100)).toEqual([]);
  });
});

describe('renderTreemap', () => {
  const OPTS = { width: 300, height: 224, locale: 'fr-FR' };

  it('draws one cell per child under a header with the root name', () => {
    const svg = makeSvg();
    renderTreemap(svg, TREE, OPTS);
    expect(cells(svg)).toHaveLength(3);
    expect(headerText(svg)).toBe('Portefeuille');
    expect(svg.querySelector('g.treemap-back')).toBeNull();
  });

  it('shows a value in the locale format in each cell title', () => {
    const svg = makeSvg();
    renderTreemap(svg, { name: 'x', children: [{ name: 'Big', value: 1234.5 }] }, OPTS);
    // Intl uses a narrow no-break space in fr-FR (the core's format/ uses a plain one).
    expect(svg.querySelector('g.treemap-cell title')?.textContent).toBe('Big : 1\u202f234,5');
  });

  it('drills into a branch on click and returns with the back button', () => {
    const svg = makeSvg();
    renderTreemap(svg, TREE, OPTS);
    click(cells(svg)[1]);
    expect(headerText(svg)).toBe('Portefeuille / Obligations');
    expect(cells(svg).map((c) => c.querySelector('title')?.textContent.split(' : ')[0])).toEqual([
      'État',
      'Entreprises',
    ]);
    expect(treemapPath(svg).map((n) => n.name)).toEqual(['Portefeuille', 'Obligations']);

    click(svg.querySelector('g.treemap-back'));
    expect(headerText(svg)).toBe('Portefeuille');
    expect(cells(svg)).toHaveLength(3);
  });

  it('does not drill into a leaf, but still reports the click', () => {
    const svg = makeSvg();
    const onNodeClick = vi.fn();
    renderTreemap(svg, TREE, { ...OPTS, onNodeClick });
    click(cells(svg)[0]);
    expect(headerText(svg)).toBe('Portefeuille');
    expect(onNodeClick).toHaveBeenCalledOnce();
    const [node, path] = onNodeClick.mock.calls[0] as [TreeNode, TreeNode[]];
    expect(node.name).toBe('Actions');
    expect(path.map((n) => n.name)).toEqual(['Portefeuille', 'Actions']);
  });

  it('keeps the drill-down position when redrawn with the same data', () => {
    const svg = makeSvg();
    renderTreemap(svg, TREE, OPTS);
    click(cells(svg)[1]);
    renderTreemap(svg, TREE, OPTS);
    expect(headerText(svg)).toBe('Portefeuille / Obligations');
  });

  it('starts from the top again when given new data', () => {
    const svg = makeSvg();
    renderTreemap(svg, TREE, OPTS);
    click(cells(svg)[1]);
    renderTreemap(svg, { name: 'Autre', children: [{ name: 'A', value: 1 }] }, OPTS);
    expect(headerText(svg)).toBe('Autre');
  });
});

describe('treemap plugin', () => {
  it('registers the treemap chart with the core and draws through renderChart', () => {
    registerPlugin(plugin);
    try {
      expect(listCharts()).toContain(TREEMAP_CHART);
      const svg = makeSvg();
      renderChart(TREEMAP_CHART, svg, TREE, { width: 300, height: 224 });
      expect(cells(svg)).toHaveLength(3);
    } finally {
      unregisterPlugin('d3scope-plugin-treemap');
    }
  });
});
