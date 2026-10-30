// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getChart,
  getPalette,
  listCharts,
  listPlugins,
  registerPlugin,
  renderChart,
  unregisterPlugin,
} from '@d3scope/core/plugin';
import { getTheme, hasTheme } from '@d3scope/core';
import plugin, { warmTheme } from '../src/index';

const SVG_NS = 'http://www.w3.org/2000/svg';

describe('plugin template', () => {
  it('registers with the core and exposes its chart, theme and palette', () => {
    registerPlugin(plugin);
    try {
      expect(listPlugins()).toContain('d3scope-plugin-template');
      expect(listCharts()).toContain('template-dots');
      expect(getChart('template-dots')).toBeDefined();
      expect(hasTheme('template-warm')).toBe(true);
      expect(getTheme('template-warm').accent).toBe(warmTheme.accent);
      expect(getPalette('template-warm')).toEqual(warmTheme.palette);
    } finally {
      unregisterPlugin('d3scope-plugin-template');
    }
  });

  it('draws one circle per point and replaces them on redraw', () => {
    registerPlugin(plugin);
    try {
      const svg = document.createElementNS(SVG_NS, 'svg');
      renderChart(
        'template-dots',
        svg,
        [
          { x: 1, y: 2 },
          { x: 3, y: 4 },
        ],
        { radius: 2 },
      );
      expect(svg.querySelectorAll('circle')).toHaveLength(2);
      expect(svg.querySelector('circle')?.getAttribute('r')).toBe('2');
      expect(svg.querySelector('circle')?.getAttribute('fill')).toBe('#4a9eed');

      renderChart('template-dots', svg, [{ x: 0, y: 0 }], { color: '#000' });
      expect(svg.querySelectorAll('circle')).toHaveLength(1);
      expect(svg.querySelector('circle')?.getAttribute('fill')).toBe('#000');
    } finally {
      unregisterPlugin('d3scope-plugin-template');
    }
  });

  it('imports only from the public Plugin API (license boundary, LICENSE-EXCEPTION.md §1)', () => {
    const srcDir = join(__dirname, '..', 'src');
    const sources = readdirSync(srcDir).filter((f) => f.endsWith('.ts'));
    const imports = sources.flatMap((f) =>
      [...readFileSync(join(srcDir, f), 'utf8').matchAll(/from '([^']+)'/g)].map((m) => m[1] ?? ''),
    );
    expect(imports.length).toBeGreaterThan(0);
    for (const spec of imports) {
      expect(spec === '@d3scope/core/plugin' || spec.startsWith('.'), spec).toBe(true);
    }
  });
});
