/**
 * Colour scale for the plot model: maps category labels to colours, in order,
 * from the `color` spec or from the categories the marks declare.
 */
import { LIGHT_THEME } from '../theme/index.js';
import type { ColorScale, ColorSpec } from './types.js';

/** Unique categories, in order of first appearance. */
export function uniqueCategories(values: readonly string[]): string[] {
  return [...new Set(values)];
}

/**
 * Build the colour scale. `declared` is the categories the marks use; the
 * domain comes from `spec.domain` when given, else from `declared`.
 */
export function createColorScale(declared: readonly string[], spec: ColorSpec = {}): ColorScale {
  const domain = spec.domain ? [...spec.domain] : uniqueCategories(declared);
  const range = spec.range && spec.range.length > 0 ? spec.range : LIGHT_THEME.palette;
  const index = new Map<string, number>(domain.map((c, i) => [c, i]));
  const scale = (category: string): string => {
    const i = index.get(category);
    if (i === undefined) {
      throw new RangeError(`plot: category "${category}" is not in the colour domain`);
    }
    return range[i % range.length] ?? range[0] ?? LIGHT_THEME.palette[0] ?? '#4a9eed';
  };
  return Object.assign(scale, { domain: [...domain] as readonly string[] });
}
