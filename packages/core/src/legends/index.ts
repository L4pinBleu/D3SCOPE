/**
 * Legends (PLAN.md §3). This module covers the categorical legend: one colour
 * swatch and label per series or category.
 *
 * Layout is computed by the pure `layoutCategoricalLegend` function, so it can be
 * tested without a DOM. `renderCategoricalLegend` only draws the result.
 *
 * Label widths are estimated from the font size (`fontSize * 0.6` per character).
 * Real text measurement would need the DOM and is not needed for this layout.
 */
import { select } from 'd3-selection';

export interface LegendItem {
  label: string;
  color: string;
}

export type LegendOrientation = 'horizontal' | 'vertical';

export interface CategoricalLegendOptions {
  /** Items in one row (`horizontal`) or one column (`vertical`). Default: `vertical`. */
  orientation?: LegendOrientation;
  /** Side of the colour swatch, in pixels. Default: 12. */
  swatchSize?: number;
  /** Gap between the swatch and its label, in pixels. Default: 6. */
  labelGap?: number;
  /** Space between two items, in pixels. Default: 12. */
  itemGap?: number;
  /** Label font size, in pixels. Default: 12. */
  fontSize?: number;
}

export interface LegendEntry {
  item: LegendItem;
  x: number;
  y: number;
}

export interface CategoricalLegendLayout {
  entries: LegendEntry[];
  width: number;
  height: number;
}

const CHAR_WIDTH_RATIO = 0.6;

/** Compute the position of each item. Pure: no DOM access. */
export function layoutCategoricalLegend(
  items: readonly LegendItem[],
  options: CategoricalLegendOptions = {},
): CategoricalLegendLayout {
  const orientation = options.orientation ?? 'vertical';
  const swatch = options.swatchSize ?? 12;
  const labelGap = options.labelGap ?? 6;
  const itemGap = options.itemGap ?? 12;
  const fontSize = options.fontSize ?? 12;
  const rowHeight = Math.max(swatch, fontSize);

  const entries: LegendEntry[] = [];
  let x = 0;
  let y = 0;
  let width = 0;

  for (const item of items) {
    entries.push({ item, x, y });
    const labelWidth = item.label.length * fontSize * CHAR_WIDTH_RATIO;
    const itemWidth = swatch + labelGap + labelWidth;
    if (orientation === 'vertical') {
      width = Math.max(width, itemWidth);
      y += rowHeight + itemGap;
    } else {
      x += itemWidth + itemGap;
      width = x - itemGap;
    }
  }

  const height = items.length === 0 ? 0 : orientation === 'vertical' ? y - itemGap : rowHeight;

  return { entries, width, height };
}

/**
 * Draw the legend inside `group`. Redrawing replaces the previous entries, so it
 * is safe to call on every data update.
 */
export function renderCategoricalLegend(
  group: SVGGElement,
  items: readonly LegendItem[],
  options: CategoricalLegendOptions = {},
): CategoricalLegendLayout {
  const layout = layoutCategoricalLegend(items, options);
  const swatch = options.swatchSize ?? 12;
  const labelGap = options.labelGap ?? 6;
  const fontSize = options.fontSize ?? 12;

  const root = select(group);
  root.selectAll('g.legend-entry').remove();

  const entry = root
    .selectAll<SVGGElement, LegendEntry>('g.legend-entry')
    .data(layout.entries)
    .join('g')
    .attr('class', 'legend-entry')
    .attr('transform', (d) => `translate(${String(d.x)},${String(d.y)})`);

  entry
    .append('rect')
    .attr('width', swatch)
    .attr('height', swatch)
    .attr('fill', (d) => d.item.color);

  entry
    .append('text')
    .attr('x', swatch + labelGap)
    .attr('y', swatch / 2)
    .attr('dominant-baseline', 'central')
    .attr('font-size', fontSize)
    .text((d) => d.item.label);

  return layout;
}
