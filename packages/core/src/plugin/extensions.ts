/**
 * Registry of the plugin extension points added in Plugin API 1.1.0: marks,
 * scales and transforms. Filled and emptied by `registerPlugin` and
 * `unregisterPlugin` (plugin/index.ts); read by the plot model.
 */
import type { AxisSpec, Mark, Primitive, PlotScale } from '../plot/types.js';

/** Builds a mark from rows and options. Plugins usually wrap it with `defineMark`. */
export type MarkFactory = (rows: readonly unknown[], options: unknown) => Mark;

/**
 * Builds a scale for an axis: `values` are every value the axis receives,
 * `range` is the pixel range (already oriented), `spec` is the axis spec.
 * The scale's `d3` field must be a d3 scale: the axes are drawn with d3-axis.
 */
export type ScaleFactory = (
  values: readonly Primitive[],
  range: readonly [number, number],
  spec: AxisSpec,
) => PlotScale;

/** A pure data transform, like `stackY` or `bin`: rows and options in, rows out. */
export type TransformFn = (rows: readonly unknown[], options: unknown) => unknown[];

/** Scale types of the core. Plugins cannot register these names. */
export const BUILTIN_SCALES: readonly string[] = ['linear', 'log', 'time', 'band'];

interface Entry<T> {
  plugin: string;
  value: T;
}

const marks = new Map<string, Entry<MarkFactory>>();
const scales = new Map<string, Entry<ScaleFactory>>();
const transforms = new Map<string, Entry<TransformFn>>();

/** Owner plugin of each extension name, for collision checks. */
export function ownerOf(kind: 'mark' | 'scale' | 'transform', name: string): string | undefined {
  const map = kind === 'mark' ? marks : kind === 'scale' ? scales : transforms;
  return map.get(name)?.plugin;
}

/** Add an extension. Called by `registerPlugin` after its checks pass. */
export function addExtension(
  kind: 'mark' | 'scale' | 'transform',
  name: string,
  plugin: string,
  value: MarkFactory | ScaleFactory | TransformFn,
): void {
  const map = kind === 'mark' ? marks : kind === 'scale' ? scales : transforms;
  (map as Map<string, Entry<typeof value>>).set(name, { plugin, value });
}

/** Remove every extension of one plugin. */
export function removeExtensionsOf(plugin: string): void {
  for (const map of [marks, scales, transforms]) {
    for (const [name, entry] of map) {
      if (entry.plugin === plugin) map.delete(name);
    }
  }
}

/** A mark factory by name, or `undefined`. */
export function getMarkFactory(name: string): MarkFactory | undefined {
  return marks.get(name)?.value;
}

/** A scale factory by name, or `undefined`. */
export function getScaleFactory(name: string): ScaleFactory | undefined {
  return scales.get(name)?.value;
}

/** A transform by name, or `undefined`. */
export function getTransformFn(name: string): TransformFn | undefined {
  return transforms.get(name)?.value;
}

/** Names of the registered marks, in registration order. */
export function listMarkNames(): string[] {
  return [...marks.keys()];
}

/** Names of the registered scales, in registration order. */
export function listScaleNames(): string[] {
  return [...scales.keys()];
}

/** Names of the registered transforms, in registration order. */
export function listTransformNames(): string[] {
  return [...transforms.keys()];
}
