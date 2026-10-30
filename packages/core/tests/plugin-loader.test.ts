/* eslint-disable @typescript-eslint/require-await -- test stubs mimic async APIs without awaiting */
import { afterEach, describe, expect, it } from 'vitest';
import { listPlugins, loadPlugins, PluginError, unregisterPlugin } from '../src/plugin/index.js';

function manifestFetch(body: unknown, status = 200) {
  return async (url: string) => ({
    ok: status === 200,
    status,
    json: async () => body,
    url,
  });
}

function pluginModule(name: string) {
  return {
    default: {
      name,
      version: '1.0.0',
      apiVersion: '^1.0.0',
      charts: {},
    },
  };
}

afterEach(() => {
  for (const name of listPlugins()) {
    if (name.startsWith('loader-')) unregisterPlugin(name);
  }
});

describe('loadPlugins', () => {
  it('reads the manifest and registers each listed plugin, in order', async () => {
    const seen: string[] = [];
    const result = await loadPlugins('/plugins/', {
      fetch: manifestFetch({ plugins: ['./a.js', './b.js'] }),
      importModule: async (url) => {
        seen.push(url);
        return pluginModule(url.endsWith('a.js') ? 'loader-a' : 'loader-b');
      },
    });
    expect(seen).toEqual(['http://localhost/plugins/a.js', 'http://localhost/plugins/b.js']);
    expect(result.loaded).toEqual(['loader-a', 'loader-b']);
    expect(result.failed).toEqual([]);
    expect(listPlugins()).toContain('loader-a');
  });

  it('resolves absolute entry URLs as they are', async () => {
    const seen: string[] = [];
    await loadPlugins('https://cdn.example/app/', {
      fetch: manifestFetch({ plugins: ['https://other.example/x.js'] }),
      importModule: async (url) => {
        seen.push(url);
        return pluginModule('loader-x');
      },
    });
    expect(seen).toEqual(['https://other.example/x.js']);
  });

  it('keeps going after a failed plugin and reports it', async () => {
    const result = await loadPlugins('/p/', {
      fetch: manifestFetch({ plugins: ['./broken.js', './ok.js'] }),
      importModule: async (url) => {
        if (url.endsWith('broken.js')) throw new Error('404 Not Found');
        return pluginModule('loader-ok');
      },
    });
    expect(result.loaded).toEqual(['loader-ok']);
    expect(result.failed).toEqual([
      { url: 'http://localhost/p/broken.js', error: '404 Not Found' },
    ]);
  });

  it('reports a module without a plugin default export', async () => {
    const result = await loadPlugins('/p/', {
      fetch: manifestFetch({ plugins: ['./empty.js'] }),
      importModule: async () => ({ default: 42 }),
    });
    expect(result.failed[0]?.error).toMatch(/no default export of a plugin definition/);
  });

  it('reports an incompatible plugin (apiVersion) without registering it', async () => {
    const result = await loadPlugins('/p/', {
      fetch: manifestFetch({ plugins: ['./future.js'] }),
      importModule: async () => ({
        default: { name: 'loader-future', version: '2.0.0', apiVersion: '^2.0.0', charts: {} },
      }),
    });
    expect(result.loaded).toEqual([]);
    expect(result.failed[0]?.error).toMatch(/needs Plugin API \^2.0.0/);
    expect(listPlugins()).not.toContain('loader-future');
  });

  it('throws when the manifest cannot be read', async () => {
    await expect(
      loadPlugins('/missing/', { fetch: manifestFetch(null, 404), importModule: async () => ({}) }),
    ).rejects.toThrow(/HTTP 404/);
  });

  it('throws when the manifest has the wrong shape', async () => {
    await expect(
      loadPlugins('/p/', {
        fetch: manifestFetch({ plugins: 'x.js' }),
        importModule: async () => ({}),
      }),
    ).rejects.toThrow(PluginError);
    await expect(
      loadPlugins('/p/', {
        fetch: manifestFetch({ plugins: [1] }),
        importModule: async () => ({}),
      }),
    ).rejects.toThrow(/must be/);
  });
});
