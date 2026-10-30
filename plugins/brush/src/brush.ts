/**
 * Brush: a time-range selector over a series (core plugin).
 *
 * Drag on the overview to select a range, drag inside the selection to move it,
 * and double-click to clear. Each change is published to the optional shared
 * `TimeRangeLink` and to `onChange`. Changes that arrive from the link redraw the
 * brush without echoing back.
 *
 * Built only on `@d3scope/core/plugin`. Mouse events are used, not pointer events,
 * so it works the same in every browser and in jsdom.
 */
import {
  layoutBrush,
  pixelsToRange,
  rangeToPixels,
  sameRange,
  type BrushLayout,
  type BrushPoint,
  type TimeRange,
} from './layout.js';
import type { TimeRangeLink } from './link.js';

export interface BrushOptions {
  width: number;
  height: number;
  /** Line and area colour. Default: `#4a9eed`. */
  color?: string;
  /** Initial selection. Ignored when `link` already holds a range. */
  range?: TimeRange;
  /** Shared range to publish to and follow. */
  link?: TimeRangeLink;
  /** Called with the new range, or `undefined` when cleared, after a user change. */
  onChange?: (range: TimeRange | undefined) => void;
}

type Drag =
  { mode: 'new'; anchor: number } | { mode: 'move'; startX: number; orig: [number, number] };

interface State {
  layout: BrushLayout;
  /** Selection in px, sorted. `undefined` when nothing is selected. */
  selection: [number, number] | undefined;
  drag: Drag | undefined;
  unsubscribe: (() => void) | undefined;
  endDrag: () => void;
  /** Removes this render's svg listeners. */
  detach: () => void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const states = new WeakMap<SVGSVGElement, State>();

function el(name: string, attrs: Record<string, string | number>): SVGElement {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** The current selection as a time range, or `undefined`. */
export function brushRange(svg: SVGSVGElement): TimeRange | undefined {
  const state = states.get(svg);
  return state?.selection
    ? pixelsToRange(state.selection[0], state.selection[1], state.layout)
    : undefined;
}

/** Draw the overview of `data` into `svg`, with the selection and its handlers. */
export function renderBrush(
  svg: SVGSVGElement,
  data: readonly BrushPoint[],
  options: BrushOptions,
): BrushLayout {
  const previous = states.get(svg);
  previous?.endDrag();
  previous?.detach();
  previous?.unsubscribe?.();

  const layout = layoutBrush(data, options.width, options.height);
  const initial = options.link?.get() ?? options.range;
  const state: State = {
    layout,
    selection: initial ? rangeToPixels(initial, layout) : undefined,
    drag: undefined,
    unsubscribe: undefined,
    endDrag: () => undefined,
    detach: () => undefined,
  };
  states.set(svg, state);

  const color = options.color ?? '#4a9eed';
  svg.setAttribute('width', String(options.width));
  svg.setAttribute('height', String(options.height));

  const current = (): TimeRange | undefined =>
    state.selection ? pixelsToRange(state.selection[0], state.selection[1], layout) : undefined;

  const publish = (): void => {
    const range = current();
    options.link?.set(range);
    options.onChange?.(range);
  };

  const localX = (event: MouseEvent): number => event.clientX - svg.getBoundingClientRect().left;

  const draw = (): void => {
    const nodes: SVGElement[] = [];
    if (layout.areaPath) {
      nodes.push(
        el('path', { class: 'area', d: layout.areaPath, fill: color, 'fill-opacity': 0.2 }),
      );
      nodes.push(
        el('path', {
          class: 'line',
          d: layout.linePath,
          fill: 'none',
          stroke: color,
          'stroke-width': 1.5,
        }),
      );
    }
    if (state.selection) {
      const [a, b] = state.selection;
      nodes.push(
        el('rect', {
          class: 'selection',
          x: a,
          y: 0,
          width: Math.max(0, b - a),
          height: layout.height,
          fill: color,
          'fill-opacity': 0.25,
          stroke: color,
        }),
      );
    }
    const overlay = el('rect', {
      class: 'overlay',
      x: 0,
      y: 0,
      width: layout.width,
      height: layout.height,
      fill: 'transparent',
      cursor: 'crosshair',
    });
    nodes.push(overlay);
    svg.replaceChildren(...nodes);
  };

  const onDown = (event: MouseEvent): void => {
    const x = localX(event);
    const sel = state.selection;
    if (sel && x >= sel[0] && x <= sel[1]) {
      state.drag = { mode: 'move', startX: x, orig: [sel[0], sel[1]] };
    } else {
      state.drag = { mode: 'new', anchor: x };
      state.selection = [x, x];
      draw();
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const onMove = (event: MouseEvent): void => {
    const drag = state.drag;
    if (!drag) return;
    const x = Math.min(layout.width, Math.max(0, localX(event)));
    if (drag.mode === 'new') {
      state.selection = [Math.min(drag.anchor, x), Math.max(drag.anchor, x)];
    } else {
      const [a, b] = drag.orig;
      const width = b - a;
      const dx = localX(event) - drag.startX;
      const start = Math.min(Math.max(0, a + dx), layout.width - width);
      state.selection = [start, start + width];
    }
    draw();
  };

  const endDrag = (): void => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    state.drag = undefined;
  };
  state.endDrag = endDrag;

  const onUp = (): void => {
    const wasDragging = state.drag !== undefined;
    endDrag();
    if (!wasDragging) return;
    if (state.selection && state.selection[1] - state.selection[0] < 2) {
      state.selection = undefined;
    }
    draw();
    publish();
  };

  const onDouble = (): void => {
    state.selection = undefined;
    draw();
    publish();
  };

  draw();
  svg.addEventListener('mousedown', onDown);
  svg.addEventListener('dblclick', onDouble);

  // Follow the shared link: redraw on changes from elsewhere, never echo back.
  if (options.link) {
    const link = options.link;
    state.unsubscribe = link.subscribe((range) => {
      if (sameRange(range, current())) return;
      state.selection = range ? rangeToPixels(range, layout) : undefined;
      draw();
    });
  }

  // The next render calls this, so old listeners never stack up.
  state.detach = () => {
    svg.removeEventListener('mousedown', onDown);
    svg.removeEventListener('dblclick', onDouble);
  };
  return layout;
}
