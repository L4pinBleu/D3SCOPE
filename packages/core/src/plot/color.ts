/**
 * Colour by label: each distinct label gets one colour from the palette, in order
 * of first appearance. The legend uses the same mapping, so colours always match.
 */
import { LIGHT_THEME } from '../theme/index.js';

export interface LabelColorScale {
  /** Colour of a label. Labels not seen at creation get the next palette colour. */
  (label: string): string;
  /** Labels in the order they were given colours. */
  readonly labels: readonly string[];
}

/** Build a colour scale for `labels` (duplicates ignored). */
export function labelColorScale(
  labels: readonly string[],
  palette: readonly string[] = LIGHT_THEME.palette,
): LabelColorScale {
  if (palette.length === 0) throw new RangeError('labelColorScale: the palette is empty');
  const order: string[] = [];
  const index = new Map<string, number>();
  const add = (label: string): void => {
    if (!index.has(label)) {
      index.set(label, order.length);
      order.push(label);
    }
  };
  for (const label of labels) add(label);
  const colorOf = (label: string): string => {
    add(label);
    const i = index.get(label) ?? 0;
    // Wrap around the palette when there are more labels than colours.
    return palette[i % palette.length] ?? palette[0] ?? '#000000';
  };
  return Object.assign(colorOf, {
    get labels(): readonly string[] {
      return order;
    },
  });
}
