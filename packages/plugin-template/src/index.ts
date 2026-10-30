/**
 * D3SCOPE plugin template (MIT, see LICENSE).
 *
 * Copy this package into your own repository and rename it. It shows the three
 * extension points of Plugin API v1: a chart, a theme and a palette. It imports
 * only from `@d3scope/core/plugin`, which is what keeps a plugin outside the
 * AGPL-3.0 (LICENSE-EXCEPTION.md §1).
 */
import { defineChart, definePlugin, type ThemeTokens } from '@d3scope/core/plugin';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface DotPoint {
  x: number;
  y: number;
}

export interface DotOptions {
  /** Dot radius in px. Default: 4. */
  radius?: number;
  /** Dot colour. Default: `#4a9eed`. */
  color?: string;
}

/** Draws one circle per point. Redrawing replaces the previous dots. */
const dots = defineChart<readonly DotPoint[], DotOptions>({
  render(svg, data, options) {
    const radius = options.radius ?? 4;
    const color = options.color ?? '#4a9eed';
    svg.replaceChildren(
      ...data.map((p) => {
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', String(p.x));
        circle.setAttribute('cy', String(p.y));
        circle.setAttribute('r', String(radius));
        circle.setAttribute('fill', color);
        return circle;
      }),
    );
  },
});

/** A warm light theme, built from the same token names as the core theme. */
export const warmTheme: ThemeTokens = {
  surface: '#fff7ed',
  text: '#431407',
  textMuted: '#9a3412',
  border: '#fdba74',
  grid: '#ffedd5',
  accent: '#c2410c',
  positive: '#15803d',
  negative: '#b91c1c',
  fontFamily: 'system-ui, sans-serif',
  palette: ['#c2410c', '#ea580c', '#f59e0b', '#84cc16'],
};

export default definePlugin({
  name: 'd3scope-plugin-template',
  version: '0.1.0',
  apiVersion: '^1.0.0',
  charts: { 'template-dots': dots },
  themes: { 'template-warm': warmTheme },
  palettes: { 'template-warm': warmTheme.palette },
});
