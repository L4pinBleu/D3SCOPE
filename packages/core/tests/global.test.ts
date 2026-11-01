import { describe, expect, it } from 'vitest';
import { GLOBAL_NAME, installGlobal, type D3ScopeGlobal } from '../src/global.js';
import { listPlugins, PLUGIN_API_VERSION, unregisterPlugin } from '../src/plugin/index.js';

describe('installGlobal', () => {
  it('installs the Plugin API under window.D3SCOPE-style name on the target', () => {
    const target: Record<string, unknown> = {};
    const api = installGlobal(target);
    expect(GLOBAL_NAME).toBe('D3SCOPE');
    expect(target[GLOBAL_NAME]).toBe(api);
    expect(api.apiVersion).toBe(PLUGIN_API_VERSION);
    for (const fn of [
      'registerPlugin',
      'unregisterPlugin',
      'listPlugins',
      'listCharts',
      'getChart',
      'renderChart',
      'loadPlugins',
      'definePlugin',
      'defineChart',
      'getPalette',
    ]) {
      expect(typeof (api as unknown as Record<string, unknown>)[fn], fn).toBe('function');
    }
  });

  it('freezes the object and the property, so scripts cannot replace them', () => {
    const target: Record<string, unknown> = {};
    const api = installGlobal(target);
    expect(Object.isFrozen(api)).toBe(true);
    const desc = Object.getOwnPropertyDescriptor(target, GLOBAL_NAME);
    expect(desc?.writable).toBe(false);
    expect(desc?.configurable).toBe(false);
  });

  it('returns the existing object on a second install instead of replacing it', () => {
    const target: Record<string, unknown> = {};
    const first = installGlobal(target);
    const second = installGlobal(target);
    expect(second).toBe(first);
  });

  it('lets a script-tag plugin register itself through the global', () => {
    const target: Record<string, unknown> = {};
    const api: D3ScopeGlobal = installGlobal(target);
    api.registerPlugin({
      name: 'script-tag-demo',
      version: '1.0.0',
      apiVersion: '^1.0.0',
      charts: {},
    });
    try {
      expect(api.listPlugins()).toContain('script-tag-demo');
      expect(listPlugins()).toContain('script-tag-demo');
    } finally {
      unregisterPlugin('script-tag-demo');
    }
  });
});
