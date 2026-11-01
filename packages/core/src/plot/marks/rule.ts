/**
 * Rule marks. `ruleX` and `ruleY` draw one full-height (or full-width) line
 * per datum at its x (or y) position: guides, thresholds, event markers.
 */
import type { Accessor } from '../channel.js';
import { valueOf, valuesOf } from '../channel.js';
import type { Mark } from '../types.js';
import { cssVar, LIGHT_THEME } from '../../theme/index.js';

interface RuleOptions {
  stroke?: string;
  strokeWidth?: number;
  dash?: string;
}

function ruleMark<T>(
  axis: 'x' | 'y',
  data: readonly T[],
  accessor: Accessor<T>,
  options: RuleOptions,
): Mark {
  const values = valuesOf(data, accessor);
  const mark: Mark = {
    name: `rule-${axis}`,
    render(ctx): void {
      const layer = ctx.layer(`rule-${axis}`);
      const svgNs = 'http://www.w3.org/2000/svg';
      for (const datum of data) {
        const p = (axis === 'x' ? ctx.x : ctx.y).position(valueOf(datum, accessor));
        if (!Number.isFinite(p)) return;
        const line = document.createElementNS(svgNs, 'line');
        line.setAttribute('class', 'd3s-rule');
        if (axis === 'x') {
          line.setAttribute('x1', String(p));
          line.setAttribute('x2', String(p));
          line.setAttribute('y1', '0');
          line.setAttribute('y2', String(ctx.innerHeight));
        } else {
          line.setAttribute('x1', '0');
          line.setAttribute('x2', String(ctx.innerWidth));
          line.setAttribute('y1', String(p));
          line.setAttribute('y2', String(p));
        }
        line.setAttribute('stroke', options.stroke ?? cssVar('textMuted', LIGHT_THEME.textMuted));
        if (options.strokeWidth !== undefined) {
          line.setAttribute('stroke-width', String(options.strokeWidth));
        }
        if (options.dash) line.setAttribute('stroke-dasharray', options.dash);
        layer.appendChild(line);
      }
    },
  };
  if (axis === 'x') mark.xValues = () => values;
  else mark.yValues = () => values;
  return mark;
}

/** Vertical rules, one per datum, at the x position, full plot height. */
export function ruleX<T>(data: readonly T[], options: { x: Accessor<T> } & RuleOptions): Mark {
  const { x, ...rest } = options;
  return ruleMark('x', data, x, rest);
}

/** Horizontal rules, one per datum, at the y position, full plot width. */
export function ruleY<T>(data: readonly T[], options: { y: Accessor<T> } & RuleOptions): Mark {
  const { y, ...rest } = options;
  return ruleMark('y', data, y, rest);
}
