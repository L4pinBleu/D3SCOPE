/**
 * Treemap chart (core plugin). Draws the children of the current node as cells,
 * sized by value. Clicking a cell that has children drills down into it; the
 * header shows the path and a back button returns one level.
 *
 * Built only on `@d3scope/core/plugin`: the tooltip is the native SVG `<title>`,
 * and value formatting uses `Intl.NumberFormat`, because the plugin API does not
 * expose the core tooltip or `format/` yet.
 */
import { layoutTreemap, type TreeNode } from './layout.js';

export interface TreemapOptions {
  width: number;
  height: number;
  /** Gap between cells in px. Default: 2. */
  padding?: number;
  /** Cell colours, used in order. Default: a built-in palette. */
  colors?: readonly string[];
  /** Locale for values in tooltips. Default: `fr-FR`. */
  locale?: string;
  /** Called when a cell is clicked (before any drill-down). */
  onNodeClick?: (node: TreeNode, path: readonly TreeNode[]) => void;
}

/** Height of the header with the path and back button, in px. */
const HEADER = 24;
const DEFAULT_COLORS = [
  '#4a9eed',
  '#f5a623',
  '#7ed321',
  '#d0021b',
  '#9013fe',
  '#50e3c2',
  '#b8e986',
  '#8b572a',
];
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Drill-down state per SVG: the stack of nodes from the root to the current one. */
const stacks = new WeakMap<SVGSVGElement, { root: TreeNode; stack: TreeNode[] }>();

function el(name: string, attrs: Record<string, string | number>): SVGElement {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** Current drill-down path (root first), for tests and for callers that persist it. */
export function treemapPath(svg: SVGSVGElement): readonly TreeNode[] {
  return stacks.get(svg)?.stack ?? [];
}

/** Draw `data` into `svg`. Redrawing keeps the drill-down position for the same data. */
export function renderTreemap(svg: SVGSVGElement, data: TreeNode, options: TreemapOptions): void {
  const state = stacks.get(svg);
  const stack = state?.root === data ? state.stack : [data];
  stacks.set(svg, { root: data, stack });

  const current = stack[stack.length - 1] ?? data;
  const colors = options.colors?.length ? options.colors : DEFAULT_COLORS;
  const format = new Intl.NumberFormat(options.locale ?? 'fr-FR');
  const padding = options.padding ?? 2;

  svg.setAttribute('width', String(options.width));
  svg.setAttribute('height', String(options.height));
  const nodes: SVGElement[] = [];

  // Header: path and back button.
  const header = el('g', { class: 'treemap-header' });
  const crumbs = stack.map((n) => n.name).join(' / ');
  const title = el('text', { x: 8, y: 16, 'font-size': 12, fill: '#1f2328' });
  title.textContent = crumbs;
  header.appendChild(title);
  if (stack.length > 1) {
    const back = el('g', { class: 'treemap-back', cursor: 'pointer' });
    back.appendChild(
      el('rect', {
        x: options.width - 64,
        y: 2,
        width: 56,
        height: 20,
        rx: 3,
        fill: '#f6f8fa',
        stroke: '#d0d7de',
      }),
    );
    const label = el('text', {
      x: options.width - 36,
      y: 16,
      'font-size': 12,
      'text-anchor': 'middle',
      fill: '#1f2328',
    });
    label.textContent = '↑ retour';
    back.appendChild(label);
    back.addEventListener('click', () => {
      stack.pop();
      renderTreemap(svg, data, options);
    });
    header.appendChild(back);
  }
  nodes.push(header);

  // Cells.
  const cells = layoutTreemap(current, options.width, options.height - HEADER, padding);
  cells.forEach((cell, i) => {
    const g = el('g', {
      class: 'treemap-cell',
      transform: `translate(${String(cell.x0)},${String(cell.y0 + HEADER)})`,
      cursor: cell.hasChildren ? 'pointer' : 'default',
    });
    const w = cell.x1 - cell.x0;
    const h = cell.y1 - cell.y0;
    g.appendChild(
      el('rect', {
        width: w,
        height: h,
        fill: colors[i % colors.length] ?? '#4a9eed',
        stroke: '#ffffff',
      }),
    );
    const tip = el('title', {});
    tip.textContent = `${cell.name} : ${format.format(cell.value)}`;
    g.appendChild(tip);
    if (w > 48 && h > 18) {
      const label = el('text', { x: 4, y: 14, 'font-size': 12, fill: '#ffffff' });
      label.textContent = cell.name;
      g.appendChild(label);
    }
    g.addEventListener('click', () => {
      options.onNodeClick?.(cell.node, [...stack, cell.node]);
      if (cell.hasChildren) {
        stack.push(cell.node);
        renderTreemap(svg, data, options);
      }
    });
    nodes.push(g);
  });

  svg.replaceChildren(...nodes);
}
