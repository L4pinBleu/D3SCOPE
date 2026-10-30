/**
 * Folder loader (PLAN.md §4, mode 2): `loadPlugins(baseUrl)` reads
 * `manifest.json` from `baseUrl` and imports each listed plugin at runtime.
 *
 * Manifest format:
 *   { "plugins": ["./treemap.js", "https://example.com/brush.js"] }
 *
 * Each entry is resolved against the manifest URL. A plugin module must export
 * a `PluginDefinition` as its default export. One bad entry does not stop the
 * others: every failure is reported in the result.
 */
import { PluginError, registerPlugin, type PluginDefinition } from './index.js';

export interface LoadPluginsOptions {
  /** Fetch used for the manifest. Default: the global `fetch`. */
  fetch?: (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
  /** Imports a plugin module. Default: a dynamic `import()`. */
  importModule?: (url: string) => Promise<unknown>;
}

export interface PluginLoadFailure {
  url: string;
  error: string;
}

export interface PluginLoadResult {
  /** Names of the plugins registered, in manifest order. */
  loaded: string[];
  failed: PluginLoadFailure[];
}

function isPluginDefinition(v: unknown): v is PluginDefinition {
  return typeof v === 'object' && v !== null && 'name' in v && 'apiVersion' in v;
}

/** Read the manifest and register every plugin it lists. Throws only if the manifest itself is unusable. */
export async function loadPlugins(
  baseUrl: string,
  options: LoadPluginsOptions = {},
): Promise<PluginLoadResult> {
  const fetchFn = options.fetch ?? ((url: string) => fetch(url));
  const importFn = options.importModule ?? ((url: string) => import(/* @vite-ignore */ url));

  const manifestUrl = new URL('manifest.json', new URL(baseUrl, 'http://localhost/')).href;
  const response = await fetchFn(manifestUrl);
  if (!response.ok) {
    throw new PluginError(
      `loadPlugins: cannot read ${manifestUrl} (HTTP ${String(response.status)})`,
    );
  }
  const manifest: unknown = await response.json();
  const entries =
    typeof manifest === 'object' && manifest !== null && 'plugins' in manifest
      ? manifest.plugins
      : undefined;
  if (!Array.isArray(entries) || !entries.every((e): e is string => typeof e === 'string')) {
    throw new PluginError(`loadPlugins: ${manifestUrl} must be {"plugins": ["…", …]}`);
  }

  const result: PluginLoadResult = { loaded: [], failed: [] };
  for (const entry of entries) {
    const url = new URL(entry, manifestUrl).href;
    try {
      const mod: unknown = await importFn(url);
      const plugin: unknown =
        typeof mod === 'object' && mod !== null && 'default' in mod ? mod.default : undefined;
      if (!isPluginDefinition(plugin)) {
        throw new PluginError('the module has no default export of a plugin definition');
      }
      registerPlugin(plugin);
      result.loaded.push(plugin.name);
    } catch (e) {
      result.failed.push({ url, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return result;
}
