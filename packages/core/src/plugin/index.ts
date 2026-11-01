/**
 * Plugin API v1 (PLAN.md §4). Public surface of `@d3scope/core/plugin`.
 *
 * A plugin is a plain object built with `definePlugin`. `registerPlugin` checks
 * the plugin's `apiVersion` range and registers its charts, themes and palettes.
 * Validation runs before anything is registered, so a rejected plugin leaves no
 * partial state behind.
 *
 * Only what this module exports is the plugin API (LICENSE-EXCEPTION.md §1).
 */
import { registerTheme, type ThemeTokens, unregisterTheme, hasTheme } from '../theme/index.js';
import type { Mark } from '../plot/types.js';
import {
  addExtension,
  BUILTIN_SCALES,
  getMarkFactory,
  getScaleFactory,
  getTransformFn,
  listMarkNames,
  listScaleNames,
  listTransformNames,
  type MarkFactory,
  type ScaleFactory,
  ownerOf,
  removeExtensionsOf,
  type TransformFn,
} from './extensions.js';

/**
 * Version of this Plugin API. Follows semver: breaking changes bump the major.
 * 1.1.0 adds the extension points `marks`, `scales` and `transforms`.
 */
export const PLUGIN_API_VERSION = '1.1.0';

/** A chart a plugin provides: draws `data` into `svg` with `options`. */
export interface ChartDefinition<TData = unknown, TOptions = unknown> {
  render(svg: SVGSVGElement, data: TData, options: TOptions): void;
}

export interface PluginDefinition {
  /** Unique plugin name, lowercase, for example `d3scope-plugin-candlestick`. */
  name: string;
  /** Plugin version, `MAJOR.MINOR.PATCH`. */
  version: string;
  /** Plugin API range the plugin supports, `^MAJOR.MINOR.PATCH` or `MAJOR.MINOR.PATCH`. */
  apiVersion: string;
  /** Charts by name. Chart names are global: two plugins cannot use the same name. */
  charts?: Record<string, ChartDefinition>;
  /** Themes by name, registered with the theme registry. */
  themes?: Record<string, ThemeTokens>;
  /** Colour palettes by name: ordered lists of colours. */
  palettes?: Record<string, readonly string[]>;
  /** Mark factories by name (API 1.1). Names are global, like chart names. */
  marks?: Record<string, MarkFactory>;
  /**
   * Scale factories by name (API 1.1). A registered name can be used as an
   * axis `type`. The built-in types `linear`, `log`, `time` and `band` are reserved.
   */
  scales?: Record<string, ScaleFactory>;
  /** Pure data transforms by name (API 1.1). */
  transforms?: Record<string, TransformFn>;
}

/** Error for an invalid or incompatible plugin. */
export class PluginError extends Error {
  override name = 'PluginError';
}

const NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;
const RANGE_PATTERN = /^(\^)?(\d+)\.(\d+)\.(\d+)$/;

/** Check `version` against a range: `^X.Y.Z` (same major, not older) or exact `X.Y.Z`. */
export function apiVersionSatisfies(version: string, range: string): boolean {
  const v = VERSION_PATTERN.exec(version);
  const r = RANGE_PATTERN.exec(range);
  if (!v) throw new RangeError(`apiVersionSatisfies: invalid version "${version}"`);
  if (!r) throw new RangeError(`apiVersionSatisfies: unsupported range "${range}"`);

  const [vMaj, vMin, vPat] = [v[1], v[2], v[3]].map(Number) as [number, number, number];
  const [, caret, rMaj, rMin, rPat] = r;
  const [major, minor, patch] = [rMaj, rMin, rPat].map(Number) as [number, number, number];

  if (caret === undefined) {
    return vMaj === major && vMin === minor && vPat === patch;
  }
  if (vMaj !== major) return false;
  if (vMin !== minor) return vMin > minor;
  return vPat >= patch;
}

/** Declare a plugin. Checks the fields it can check without the registry. */
export function definePlugin<T extends PluginDefinition>(plugin: T): T {
  if (!NAME_PATTERN.test(plugin.name)) {
    throw new PluginError(
      `definePlugin: invalid name "${plugin.name}" (lowercase letters, digits, . _ -)`,
    );
  }
  if (!VERSION_PATTERN.test(plugin.version)) {
    throw new PluginError(`definePlugin: "${plugin.name}" version must be MAJOR.MINOR.PATCH`);
  }
  if (!RANGE_PATTERN.test(plugin.apiVersion)) {
    throw new PluginError(`definePlugin: "${plugin.name}" apiVersion must be ^X.Y.Z or X.Y.Z`);
  }
  return plugin;
}

interface ChartEntry {
  plugin: string;
  chart: ChartDefinition;
}

const plugins = new Map<string, PluginDefinition>();
const charts = new Map<string, ChartEntry>();
const palettes = new Map<string, { plugin: string; colors: readonly string[] }>();

/**
 * Register a plugin. Throws `PluginError` without changing any state when the
 * plugin is invalid, its `apiVersion` does not match this core, or a name is
 * already taken.
 */
export function registerPlugin(plugin: PluginDefinition): void {
  definePlugin(plugin);

  if (plugins.has(plugin.name)) {
    throw new PluginError(`registerPlugin: plugin "${plugin.name}" is already registered`);
  }
  if (!apiVersionSatisfies(PLUGIN_API_VERSION, plugin.apiVersion)) {
    throw new PluginError(
      `registerPlugin: "${plugin.name}" needs Plugin API ${plugin.apiVersion}, this core provides ${PLUGIN_API_VERSION}`,
    );
  }

  const chartNames = Object.keys(plugin.charts ?? {});
  for (const chart of chartNames) {
    const owner = charts.get(chart);
    if (owner) {
      throw new PluginError(
        `registerPlugin: chart "${chart}" is already provided by "${owner.plugin}"`,
      );
    }
  }
  for (const [kind, names, label] of [
    ['mark', Object.keys(plugin.marks ?? {}), 'mark'],
    ['scale', Object.keys(plugin.scales ?? {}), 'scale'],
    ['transform', Object.keys(plugin.transforms ?? {}), 'transform'],
  ] as const) {
    for (const name of names) {
      if (!NAME_PATTERN.test(name)) {
        throw new PluginError(`registerPlugin: invalid ${label} name "${name}"`);
      }
    }
    if (kind === 'scale') {
      for (const name of names) {
        if (BUILTIN_SCALES.includes(name)) {
          throw new PluginError(`registerPlugin: scale "${name}" is a built-in scale type`);
        }
      }
    }
    for (const name of names) {
      const owner = ownerOf(kind, name);
      if (owner) {
        throw new PluginError(
          `registerPlugin: ${label} "${name}" is already provided by "${owner}"`,
        );
      }
    }
  }
  for (const [label, record] of [
    ['mark', plugin.marks],
    ['scale', plugin.scales],
    ['transform', plugin.transforms],
  ] as const) {
    for (const [name, fn] of Object.entries(record ?? {})) {
      if (typeof fn !== 'function') {
        throw new PluginError(`registerPlugin: ${label} "${name}" must be a function`);
      }
    }
  }

  const paletteNames = Object.keys(plugin.palettes ?? {});
  for (const palette of paletteNames) {
    const owner = palettes.get(palette);
    if (owner) {
      throw new PluginError(
        `registerPlugin: palette "${palette}" is already provided by "${owner.plugin}"`,
      );
    }
  }
  for (const theme of Object.keys(plugin.themes ?? {})) {
    if (hasTheme(theme)) {
      throw new PluginError(`registerPlugin: theme "${theme}" already exists`);
    }
  }

  // All checks passed: now register.
  plugins.set(plugin.name, plugin);
  for (const chart of chartNames) {
    const def = plugin.charts?.[chart];
    if (def) charts.set(chart, { plugin: plugin.name, chart: def });
  }
  for (const palette of paletteNames) {
    const colors = plugin.palettes?.[palette];
    if (colors) palettes.set(palette, { plugin: plugin.name, colors });
  }
  for (const [theme, tokens] of Object.entries(plugin.themes ?? {})) {
    registerTheme(theme, tokens);
  }
  for (const [name, fn] of Object.entries(plugin.marks ?? {}))
    addExtension('mark', name, plugin.name, fn);
  for (const [name, fn] of Object.entries(plugin.scales ?? {}))
    addExtension('scale', name, plugin.name, fn);
  for (const [name, fn] of Object.entries(plugin.transforms ?? {})) {
    addExtension('transform', name, plugin.name, fn);
  }
}

/**
 * Remove a plugin's charts and palettes. Its themes are removed too, unless
 * another plugin reuses the name (themes are only removed when registered by
 * this plugin).
 */
export function unregisterPlugin(name: string): void {
  const plugin = plugins.get(name);
  if (!plugin) return;
  for (const chart of Object.keys(plugin.charts ?? {})) {
    if (charts.get(chart)?.plugin === name) charts.delete(chart);
  }
  for (const palette of Object.keys(plugin.palettes ?? {})) {
    if (palettes.get(palette)?.plugin === name) palettes.delete(palette);
  }
  for (const theme of Object.keys(plugin.themes ?? {})) {
    unregisterTheme(theme);
  }
  removeExtensionsOf(name);
  plugins.delete(name);
}

/** Names of registered plugins, in registration order. */
export function listPlugins(): string[] {
  return [...plugins.keys()];
}

/** Names of all charts provided by plugins, in registration order. */
export function listCharts(): string[] {
  return [...charts.keys()];
}

/** A chart by name, or `undefined` if no plugin provides it. */
export function getChart(name: string): ChartDefinition | undefined {
  return charts.get(name)?.chart;
}

/** Draw a registered chart. Throws `PluginError` for an unknown name. */
export function renderChart(
  name: string,
  svg: SVGSVGElement,
  data: unknown,
  options: unknown,
): void {
  const chart = getChart(name);
  if (!chart) throw new PluginError(`renderChart: no chart named "${name}"`);
  chart.render(svg, data, options);
}

/** Names of the marks provided by plugins (API 1.1). */
export function listMarks(): string[] {
  return listMarkNames();
}

/** Names of the scale types provided by plugins (API 1.1). */
export function listScales(): string[] {
  return listScaleNames();
}

/** Names of the transforms provided by plugins (API 1.1). */
export function listTransforms(): string[] {
  return listTransformNames();
}

/** Build a mark provided by a plugin. Throws `PluginError` for an unknown name. */
export function createMark(name: string, rows: readonly unknown[], options: unknown): Mark {
  const factory = getMarkFactory(name);
  if (!factory) throw new PluginError(`createMark: no mark named "${name}"`);
  return factory(rows, options);
}

/** Apply a transform provided by a plugin. Throws `PluginError` for an unknown name. */
export function applyTransform(
  name: string,
  rows: readonly unknown[],
  options: unknown,
): unknown[] {
  const fn = getTransformFn(name);
  if (!fn) throw new PluginError(`applyTransform: no transform named "${name}"`);
  return fn(rows, options);
}

/** A scale factory provided by a plugin, or `undefined`. */
export function getScale(name: string): ScaleFactory | undefined {
  return getScaleFactory(name);
}

/** Wrap a mark factory with its row and option types. Helps plugin authors. */
// The generic types document the plugin's row and option shapes for its authors;
// they are not inferred from the return type, so the lint rule is disabled here.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function defineMark<TRow, TOptions>(
  factory: (rows: readonly TRow[], options: TOptions) => Mark,
): MarkFactory {
  return (rows, options) => factory(rows as readonly TRow[], options as TOptions);
}

/** Wrap a transform with its row and option types. Helps plugin authors. */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function defineTransform<TRow, TOptions, TOut>(
  fn: (rows: readonly TRow[], options: TOptions) => TOut[],
): TransformFn {
  return (rows, options) => fn(rows as readonly TRow[], options as TOptions);
}

/** A palette by name, or `undefined`. */
export function getPalette(name: string): readonly string[] | undefined {
  return palettes.get(name)?.colors;
}

/** Wrap a chart renderer with its data and options types. Helps plugin authors. */
export function defineChart<TData, TOptions>(
  chart: ChartDefinition<TData, TOptions>,
): ChartDefinition {
  return {
    render(svg, data, options) {
      chart.render(svg, data as TData, options as TOptions);
    },
  };
}

export type { ThemeTokens } from '../theme/index.js';
export type { MarkFactory, ScaleFactory, TransformFn } from './extensions.js';
export { loadPlugins, type LoadPluginsOptions, type PluginLoadResult } from './loader.js';
