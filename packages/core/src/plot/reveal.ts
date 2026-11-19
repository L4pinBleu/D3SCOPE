/**
 * Animation of the first display of a plot: the marks are revealed from left to
 * right, by growing the clip rectangle of the plot area (`d3-timer`, `d3-ease`).
 * The axes, the titles and the decorations appear at once.
 */
import { timer } from 'd3-timer';
import { timingOf } from './easing.js';
import type { PlotContext, ZoomAnimation } from './types.js';

/**
 * Full width of a clip rectangle while its plot is revealed: the export draws the
 * plot whole, whatever the state of the animation.
 */
export const REVEAL_WIDTH_ATTRIBUTE = 'data-d3s-full-width';

/** Reveal the marks of `ctx`. Stops by itself if the plot is drawn again meanwhile. */
export function reveal(ctx: PlotContext, spec: ZoomAnimation | undefined): void {
  const timing = timingOf(spec);
  const rect = ctx.svg.querySelector(':scope > .d3s-plot > defs > clipPath > rect');
  if (!timing || !rect) return;
  const width = ctx.innerWidth;
  rect.setAttribute(REVEAL_WIDTH_ATTRIBUTE, String(width));
  rect.setAttribute('width', '0');
  const animation = timer((elapsed) => {
    // A redraw (zoom, data update) puts a new clip rectangle at full width.
    if (!rect.isConnected) {
      animation.stop();
      return;
    }
    const done = elapsed >= timing.duration;
    const share = done ? 1 : Math.max(0, timing.ease(elapsed / timing.duration));
    rect.setAttribute('width', String(Math.max(0, share * width)));
    if (done) {
      rect.setAttribute('width', String(width));
      rect.removeAttribute(REVEAL_WIDTH_ATTRIBUTE);
      animation.stop();
    }
  });
}
