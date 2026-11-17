/**
 * Grid marks. `gridX` and `gridY` draw lines at the ticks of an axis. Axis
 * `grid` options use them too.
 */
import type { GridStyle, Mark, PlotContext } from './types.js';
import { cssVar, LIGHT_THEME } from '../theme/index.js';
import { tickValues } from './scales.js';

function gridMark(axis: 'x' | 'y', style: GridStyle): Mark {
  return {
    name: `grid-${axis}`,
    render(ctx: PlotContext): void {
      const scale = axis === 'x' ? ctx.x : ctx.y;
      const spec = axis === 'x' ? ctx.xSpec : ctx.ySpec;
      if (scale.kind === 'band') return; // no gridlines between categories
      const color = style.color ?? cssVar('grid', LIGHT_THEME.grid);
      const layer = ctx.layer(`grid-${axis}`);
      for (const v of tickValues(scale, spec)) {
        const p = scale.position(v);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        const [x1, x2, y1, y2] =
          axis === 'x' ? [p, p, 0, ctx.innerHeight] : [0, ctx.innerWidth, p, p];
        line.setAttribute('x1', String(x1));
        line.setAttribute('x2', String(x2));
        line.setAttribute('y1', String(y1));
        line.setAttribute('y2', String(y2));
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-opacity', String(style.opacity ?? 1));
        if (style.dash) line.setAttribute('stroke-dasharray', style.dash);
        layer.appendChild(line);
      }
    },
  };
}

/** Vertical gridlines at the x ticks. */
export function gridX(style: GridStyle = {}): Mark {
  return gridMark('x', style);
}

/** Horizontal gridlines at the y ticks. */
export function gridY(style: GridStyle = {}): Mark {
  return gridMark('y', style);
}
