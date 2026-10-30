import { definePlugin, defineChart } from '@d3scope/core/plugin';
import { renderTreemap, type TreemapOptions } from './treemap.js';
import type { TreeNode } from './layout.js';

export type { TreeNode } from './layout.js';
export { layoutTreemap, type TreemapCell } from './layout.js';
export { renderTreemap, treemapPath, type TreemapOptions } from './treemap.js';

/** Chart name registered with the core. */
export const TREEMAP_CHART = 'treemap';

export default definePlugin({
  name: 'd3scope-plugin-treemap',
  version: '0.1.0',
  apiVersion: '^1.0.0',
  charts: {
    [TREEMAP_CHART]: defineChart<TreeNode, TreemapOptions>({
      render: (svg, data, options) => {
        renderTreemap(svg, data, options);
      },
    }),
  },
});
