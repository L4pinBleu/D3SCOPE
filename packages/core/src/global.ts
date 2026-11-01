/**
 * Script-tag entry (PLAN.md §4, mode 3): puts the Plugin API on `window.D3SCOPE`,
 * so a plugin loaded with a plain `<script>` tag can register itself without
 * importing anything.
 *
 *   <script src="d3scope.global.js"></script>
 *   <script src="my-plugin.js"></script>   <!-- calls window.D3SCOPE.registerPlugin(...) -->
 *
 * Plugins written for this mode are plain objects. Use `definePlugin` only in
 * bundled builds.
 */
import {
  definePlugin,
  defineChart,
  getChart,
  getPalette,
  listCharts,
  listPlugins,
  loadPlugins,
  PLUGIN_API_VERSION,
  registerPlugin,
  renderChart,
  unregisterPlugin,
  type PluginDefinition,
} from './plugin/index.js';

/** The object installed on `window.D3SCOPE`. */
export interface D3ScopeGlobal {
  readonly apiVersion: string;
  definePlugin: typeof definePlugin;
  defineChart: typeof defineChart;
  registerPlugin(plugin: PluginDefinition): void;
  unregisterPlugin(name: string): void;
  listPlugins(): string[];
  listCharts(): string[];
  getChart: typeof getChart;
  getPalette: typeof getPalette;
  renderChart: typeof renderChart;
  loadPlugins: typeof loadPlugins;
}

/** Name of the global. Fixed by the public API: changing it is a breaking change. */
export const GLOBAL_NAME = 'D3SCOPE';

/**
 * Install the API on `target` (default: the global object). Calling it again
 * returns the object already installed, so two copies of the script do not
 * replace each other.
 */
export function installGlobal(target: object = globalThis): D3ScopeGlobal {
  const existing = (target as Record<string, unknown>)[GLOBAL_NAME] as D3ScopeGlobal | undefined;
  if (existing) return existing;

  const api: D3ScopeGlobal = {
    apiVersion: PLUGIN_API_VERSION,
    definePlugin,
    defineChart,
    registerPlugin,
    unregisterPlugin,
    listPlugins,
    listCharts,
    getChart,
    getPalette,
    renderChart,
    loadPlugins,
  };
  Object.defineProperty(target, GLOBAL_NAME, {
    value: Object.freeze(api),
    enumerable: true,
    configurable: false,
    writable: false,
  });
  return api;
}
