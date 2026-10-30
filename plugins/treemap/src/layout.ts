/**
 * Treemap layout (pure, no DOM). Uses d3-hierarchy's squarified tiling.
 */
import { hierarchy, treemap } from 'd3-hierarchy';

/** A node of the tree: a leaf has `value`, a branch has `children`. */
export interface TreeNode {
  name: string;
  value?: number;
  children?: TreeNode[];
}

export interface TreemapCell {
  /** The node this cell draws. */
  node: TreeNode;
  name: string;
  /** Sum of the leaf values under the node. */
  value: number;
  /** True when the node has children, so clicking it can drill down. */
  hasChildren: boolean;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Tile the children of `root` into `width` × `height`. Cells are sorted by value,
 * largest first. `padding` is the gap between cells, in px.
 */
export function layoutTreemap(
  root: TreeNode,
  width: number,
  height: number,
  padding = 2,
): TreemapCell[] {
  const h = hierarchy<TreeNode>(root, (d) => d.children)
    .sum((d) => (d.children && d.children.length > 0 ? 0 : (d.value ?? 0)))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const laid = treemap<TreeNode>()
    .size([Math.max(0, width), Math.max(0, height)])
    .paddingInner(padding)(h);

  return (laid.children ?? []).map((child) => ({
    node: child.data,
    name: child.data.name,
    value: child.value ?? 0,
    hasChildren: (child.data.children?.length ?? 0) > 0,
    x0: child.x0,
    y0: child.y0,
    x1: child.x1,
    y1: child.y1,
  }));
}
