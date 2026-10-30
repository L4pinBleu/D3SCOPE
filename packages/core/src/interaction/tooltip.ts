/**
 * Tooltip (PLAN.md §8 `interaction/`, decision: SVG by default, HTML optional).
 *
 * - `svg` (default): a `<g>` inside the chart's SVG. It is exported with the
 *   chart (PNG/SVG export) and themed through the SVG's own styles.
 * - `html`: an absolutely positioned `<div>` in a container. It is themed with
 *   CSS variables (`--card`, `--foreground`, `--border`) and is NOT part of the
 *   PNG export.
 *
 * Points are in the chart SVG's user space (the same coordinates as `d3.pointer`).
 */
import { select } from 'd3-selection';

export interface TooltipContent {
  /** Bold first line. Optional. */
  title?: string;
  /** Plain lines shown under the title. Rendered as text, never as HTML. */
  lines: string[];
}

export interface TooltipPoint {
  x: number;
  y: number;
}

export type TooltipMode = 'svg' | 'html';

export interface TooltipOptions {
  /** Where the tooltip is drawn. Default: `'svg'`. */
  mode?: TooltipMode;
  /** HTML mode only. Element that holds the tooltip. Default: the SVG's parent. */
  container?: HTMLElement;
}

export interface Tooltip {
  show(content: TooltipContent, point: TooltipPoint): void;
  hide(): void;
  /** Remove the tooltip DOM. The instance must not be used afterwards. */
  destroy(): void;
}

/** Gap between the pointer and the tooltip box, in px. */
const OFFSET = 12;
const PADDING = 8;
const LINE_HEIGHT = 16;
/** Rough glyph width used to size the SVG box without measuring text. */
const CHAR_WIDTH = 7;

/** Create a tooltip attached to `svg` in the requested mode. */
export function createTooltip(svg: SVGSVGElement, options: TooltipOptions = {}): Tooltip {
  return options.mode === 'html'
    ? createHtmlTooltip(svg, options.container)
    : createSvgTooltip(svg);
}

/** One tooltip per chart SVG, reused across redraws (keyed by mode). */
const cache = new WeakMap<SVGSVGElement, { key: string; tooltip: Tooltip }>();

/**
 * Get the chart's tooltip for a redraw. `undefined` (off) destroys any tooltip
 * left from an earlier draw. Charts call this on every render.
 */
export function acquireTooltip(
  svg: SVGSVGElement,
  options: boolean | TooltipOptions | undefined,
): Tooltip | undefined {
  if (options === undefined || options === false) {
    releaseTooltip(svg);
    return undefined;
  }
  const opts = options === true ? {} : options;
  const key = opts.mode ?? 'svg';
  const cached = cache.get(svg);
  if (cached?.key === key) return cached.tooltip;
  cached?.tooltip.destroy();
  const tooltip = createTooltip(svg, opts);
  cache.set(svg, { key, tooltip });
  return tooltip;
}

/** Destroy the chart's tooltip, if any. */
export function releaseTooltip(svg: SVGSVGElement): void {
  cache.get(svg)?.tooltip.destroy();
  cache.delete(svg);
}

/** Box size for `content`, in px, so the SVG tooltip can draw its background. */
export function tooltipBoxSize(content: TooltipContent): { width: number; height: number } {
  const all = content.title === undefined ? content.lines : [content.title, ...content.lines];
  const longest = Math.max(0, ...all.map((line) => line.length));
  return {
    width: longest * CHAR_WIDTH + PADDING * 2,
    height: all.length * LINE_HEIGHT + PADDING * 2,
  };
}

/**
 * Pick the box corner so it stays inside `bounds`: right of the pointer by
 * default, flipped to the left (or moved up) when it would overflow.
 */
export function placeTooltip(
  point: TooltipPoint,
  box: { width: number; height: number },
  bounds: { width: number; height: number },
): TooltipPoint {
  let x = point.x + OFFSET;
  let y = point.y + OFFSET;
  if (x + box.width > bounds.width) x = point.x - OFFSET - box.width;
  if (y + box.height > bounds.height) y = point.y - OFFSET - box.height;
  return { x: Math.max(0, x), y: Math.max(0, y) };
}

function createSvgTooltip(svg: SVGSVGElement): Tooltip {
  const root = select(svg)
    .append('g')
    .attr('class', 'd3scope-tooltip')
    .attr('pointer-events', 'none')
    .style('display', 'none');
  const bg = root.append('rect').attr('rx', 4).attr('fill', '#ffffff').attr('stroke', '#d0d7de');
  const text = root.append('text').attr('font-size', 12).attr('fill', '#1f2328');

  return {
    show(content, point) {
      const box = tooltipBoxSize(content);
      const bounds = svgBounds(svg);
      const at = placeTooltip(point, box, bounds);

      text.selectAll('tspan').remove();
      const all = content.title === undefined ? content.lines : [content.title, ...content.lines];
      all.forEach((line, i) => {
        text
          .append('tspan')
          .attr('x', PADDING)
          .attr('dy', i === 0 ? PADDING + 12 : LINE_HEIGHT)
          .attr('font-weight', i === 0 && content.title !== undefined ? 'bold' : null)
          .text(line);
      });

      bg.attr('width', box.width).attr('height', box.height);
      root.attr('transform', `translate(${String(at.x)},${String(at.y)})`).style('display', null);
    },
    hide() {
      root.style('display', 'none');
    },
    destroy() {
      root.remove();
    },
  };
}

function createHtmlTooltip(svg: SVGSVGElement, container?: HTMLElement): Tooltip {
  const host = container ?? svg.parentElement;
  if (!host) throw new Error('createTooltip: html mode needs a container or an SVG with a parent');

  const el = document.createElement('div');
  el.className = 'd3scope-tooltip';
  el.setAttribute('role', 'tooltip');
  Object.assign(el.style, {
    position: 'absolute',
    pointerEvents: 'none',
    display: 'none',
    padding: `${String(PADDING)}px`,
    borderRadius: '4px',
    border: '1px solid var(--border, #d0d7de)',
    background: 'var(--card, #ffffff)',
    color: 'var(--foreground, #1f2328)',
    font: '12px/1.33 var(--font-sans, system-ui, sans-serif)',
    whiteSpace: 'nowrap',
  });
  host.appendChild(el);

  return {
    show(content, point) {
      const box = tooltipBoxSize(content);
      const hostRect = host.getBoundingClientRect();
      const svgRect = svg.getBoundingClientRect();
      // Chart point → container coordinates.
      const origin = {
        x: svgRect.left - hostRect.left + point.x,
        y: svgRect.top - hostRect.top + point.y,
      };
      const at = placeTooltip(origin, box, { width: host.clientWidth, height: host.clientHeight });

      el.replaceChildren();
      if (content.title !== undefined) {
        const strong = document.createElement('strong');
        strong.textContent = content.title;
        el.appendChild(strong);
      }
      for (const line of content.lines) {
        const row = document.createElement('div');
        row.textContent = line;
        el.appendChild(row);
      }
      el.style.left = `${String(at.x)}px`;
      el.style.top = `${String(at.y)}px`;
      el.style.display = 'block';
    },
    hide() {
      el.style.display = 'none';
    },
    destroy() {
      el.remove();
    },
  };
}

function svgBounds(svg: SVGSVGElement): { width: number; height: number } {
  const width = Number.parseFloat(svg.getAttribute('width') ?? '');
  const height = Number.parseFloat(svg.getAttribute('height') ?? '');
  return { width: width > 0 ? width : Infinity, height: height > 0 ? height : Infinity };
}
