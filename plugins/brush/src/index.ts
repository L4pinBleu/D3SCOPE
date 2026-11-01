import { defineChart, definePlugin } from '@d3scope/core/plugin';
import { renderBrush, type BrushOptions } from './brush.js';
import type { BrushPoint } from './layout.js';

export type { BrushPoint, TimeRange } from './layout.js';
export { createTimeRangeLink, type TimeRangeLink } from './link.js';
export { brushRange, renderBrush, type BrushOptions } from './brush.js';
export {
  layoutBrush,
  pixelsToRange,
  rangeToPixels,
  sameRange,
  timeToX,
  xToTime,
} from './layout.js';

/** Chart name registered with the core. */
export const BRUSH_CHART = 'brush';

export default definePlugin({
  name: 'd3scope-plugin-brush',
  version: '0.1.0',
  apiVersion: '^1.0.0',
  charts: {
    [BRUSH_CHART]: defineChart<readonly BrushPoint[], BrushOptions>({
      render: (svg, data, options) => {
        renderBrush(svg, data, options);
      },
    }),
  },
});
