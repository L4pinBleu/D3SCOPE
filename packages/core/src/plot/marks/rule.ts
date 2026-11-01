/**
 * Reference rules. `ruleY` draws horizontal lines at y values, `ruleX` vertical
 * lines at x values, spanning the whole plot area.
 */
import type { Mark, PlotContext, Primitive } from '../types.js';
import { cssVar, LIGHT_THEME } from '../../theme/index.js';

export interface RuleOptions {
  /** Line colour. Default: the theme accent. */
  stroke?: string;
  /** Line width, in pixels. Default: 1. */
  strokeWidth?: number;
  /** SVG dash pattern, e.g. `4 4`. Default: solid. */
  dash?: string;
  /** Line opacity, from 0 to 1. Default: 1. */
  opacity?: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function drawRule(
  ctx: PlotContext,
  layerName: string,
  values: readonly Primitive[],
  orient: 'horizontal' | 'vertical',
  options: RuleOptions,
): void {
  const stroke = options.stroke ?? cssVar('accent', LIGHT_THEME.accent);
  const layer = ctx.layer(layerName);
  for (const v of values) {
    const p = orient === 'horizontal' ? ctx.y.position(v) : xPosition(ctx, v);
    if (!Number.isFinite(p)) continue;
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('class', 'd3s-rule');
    if (orient === 'horizontal') {
      line.setAttribute('x1', '0');
      line.setAttribute('x2', String(ctx.innerWidth));
      line.setAttribute('y1', String(p));
      line.setAttribute('y2', String(p));
    } else {
      line.setAttribute('x1', String(p));
      line.setAttribute('x2', String(p));
      line.setAttribute('y1', '0');
      line.setAttribute('y2', String(ctx.innerHeight));
    }
    line.setAttribute('stroke', stroke);
    line.setAttribute('stroke-width', String(options.strokeWidth ?? 1));
    line.setAttribute('stroke-opacity', String(options.opacity ?? 1));
    if (options.dash) line.setAttribute('stroke-dasharray', options.dash);
    layer.appendChild(line);
  }
}

/** Pixel position of an x value: the band centre on a band scale. */
function xPosition(ctx: PlotContext, v: Primitive): number {
  const p = ctx.x.position(v);
  return ctx.x.bandwidth() > 0 ? p + ctx.x.bandwidth() / 2 : p;
}

/** Horizontal reference lines at each y value. */
export function ruleY(values: readonly number[], options: RuleOptions = {}): Mark {
  return {
    name: 'rule-y',
    yValues: () => values,
    render(ctx: PlotContext): void {
      drawRule(ctx, 'rule', values, 'horizontal', options);
    },
  };
}

/** Vertical reference lines at each x value. */
export function ruleX(
  values: readonly (number | Date | string)[],
  options: RuleOptions = {},
): Mark {
  return {
    name: 'rule-x',
    xValues: () => values,
    render(ctx: PlotContext): void {
      drawRule(ctx, 'rule', values, 'vertical', options);
    },
  };
}
