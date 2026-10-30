// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  apiVersionSatisfies,
  defineChart,
  definePlugin,
  getChart,
  getPalette,
  listCharts,
  listPlugins,
  PLUGIN_API_VERSION,
  PluginError,
  registerPlugin,
  renderChart,
  unregisterPlugin,
  type PluginDefinition,
} from '../src/plugin/index.js';
import { getTheme, hasTheme, LIGHT_THEME } from '../src/theme/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const chartRender = vi.fn();
const CHART = { render: chartRender };

function plugin(overrides: Partial<PluginDefinition> = {}): PluginDefinition {
  return {
    name: 'demo-plugin',
    version: '1.0.0',
    apiVersion: '^1.0.0',
    charts: { demoChart: CHART },
    themes: { demoTheme: { ...LIGHT_THEME, accent: '#123456' } },
    palettes: { demoPalette: ['#111111', '#222222'] },
    ...overrides,
  };
}

const registered: string[] = [];
function register(p: PluginDefinition): void {
  registerPlugin(p);
  registered.push(p.name);
}

afterEach(() => {
  for (const name of registered.splice(0)) unregisterPlugin(name);
  chartRender.mockClear();
});

describe('apiVersionSatisfies', () => {
  it('accepts a caret range with the same major and a not older minor/patch', () => {
    expect(apiVersionSatisfies('1.0.0', '^1.0.0')).toBe(true);
    expect(apiVersionSatisfies('1.4.2', '^1.0.0')).toBe(true);
    expect(apiVersionSatisfies('1.4.2', '^1.5.0')).toBe(false);
  });

  it('rejects a different major', () => {
    expect(apiVersionSatisfies('2.0.0', '^1.0.0')).toBe(false);
    expect(apiVersionSatisfies('0.9.0', '^1.0.0')).toBe(false);
  });

  it('matches an exact version exactly', () => {
    expect(apiVersionSatisfies('1.0.0', '1.0.0')).toBe(true);
    expect(apiVersionSatisfies('1.0.1', '1.0.0')).toBe(false);
  });

  it('throws on malformed input', () => {
    expect(() => apiVersionSatisfies('1.0', '^1.0.0')).toThrow(RangeError);
    expect(() => apiVersionSatisfies('1.0.0', '>=1.0.0')).toThrow(RangeError);
  });
});

describe('definePlugin', () => {
  it('returns the plugin unchanged when it is valid', () => {
    const p = plugin();
    expect(definePlugin(p)).toBe(p);
  });

  it('rejects an invalid name, version or apiVersion', () => {
    expect(() => definePlugin(plugin({ name: 'Bad Name' }))).toThrow(PluginError);
    expect(() => definePlugin(plugin({ version: '1.0' }))).toThrow(/MAJOR.MINOR.PATCH/);
    expect(() => definePlugin(plugin({ apiVersion: '*' }))).toThrow(/apiVersion/);
  });
});

describe('registerPlugin', () => {
  it('registers charts, palettes and themes', () => {
    register(plugin());
    expect(listPlugins()).toContain('demo-plugin');
    expect(getChart('demoChart')).toBe(CHART);
    expect(listCharts()).toContain('demoChart');
    expect(getPalette('demoPalette')).toEqual(['#111111', '#222222']);
    expect(getTheme('demoTheme').accent).toBe('#123456');
  });

  it('refuses a plugin whose apiVersion this core does not provide, with no partial state', () => {
    expect(PLUGIN_API_VERSION).toBe('1.0.0');
    expect(() => {
      register(plugin({ name: 'future', apiVersion: '^2.0.0', charts: { futureChart: CHART } }));
    }).toThrow(/needs Plugin API \^2.0.0, this core provides 1.0.0/);
    expect(getChart('futureChart')).toBeUndefined();
    expect(listPlugins()).not.toContain('future');
  });

  it('refuses a duplicate plugin name', () => {
    register(plugin());
    expect(() => {
      register(plugin({ charts: {}, themes: {}, palettes: {} }));
    }).toThrow(/already registered/);
  });

  it('refuses a chart name owned by another plugin, without registering the rest', () => {
    register(plugin());
    expect(() => {
      register(
        plugin({
          name: 'other',
          charts: { newChart: CHART, demoChart: CHART },
          themes: {},
          palettes: {},
        }),
      );
    }).toThrow(/chart "demoChart" is already provided by "demo-plugin"/);
    expect(getChart('newChart')).toBeUndefined();
  });

  it('refuses a theme or palette name that is already taken', () => {
    register(plugin());
    expect(() => {
      register(
        plugin({ name: 'theme-clash', charts: {}, palettes: {}, themes: { default: LIGHT_THEME } }),
      );
    }).toThrow(/theme "default" already exists/);
    expect(() => {
      register(
        plugin({ name: 'palette-clash', charts: {}, themes: {}, palettes: { demoPalette: [] } }),
      );
    }).toThrow(/palette "demoPalette" is already provided/);
  });
});

describe('renderChart', () => {
  it('draws through the registered chart', () => {
    register(plugin());
    const svg = document.createElementNS(SVG_NS, 'svg');
    renderChart('demoChart', svg, [1, 2], { x: 1 });
    expect(chartRender).toHaveBeenCalledWith(svg, [1, 2], { x: 1 });
  });

  it('throws for an unknown chart name', () => {
    expect(() => {
      renderChart('nothing', document.createElementNS(SVG_NS, 'svg'), null, null);
    }).toThrow(/no chart named "nothing"/);
  });
});

describe('unregisterPlugin', () => {
  it('removes the plugin charts, palettes and themes', () => {
    register(plugin());
    unregisterPlugin('demo-plugin');
    expect(listPlugins()).not.toContain('demo-plugin');
    expect(getChart('demoChart')).toBeUndefined();
    expect(getPalette('demoPalette')).toBeUndefined();
    expect(hasTheme('demoTheme')).toBe(false);
  });

  it('does nothing for an unknown name', () => {
    expect(() => {
      unregisterPlugin('never-registered');
    }).not.toThrow();
  });

  it('keeps the built-in default theme', () => {
    expect(hasTheme('default')).toBe(true);
  });
});

describe('defineChart', () => {
  it('passes typed data and options through to the renderer', () => {
    const render =
      vi.fn<(svg: SVGSVGElement, data: number[], options: { scale: number }) => void>();
    const typed = defineChart<number[], { scale: number }>({ render });
    const svg = document.createElementNS(SVG_NS, 'svg');
    typed.render(svg, [3], { scale: 2 });
    expect(render).toHaveBeenCalledWith(svg, [3], { scale: 2 });
  });
});
