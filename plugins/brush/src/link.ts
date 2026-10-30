import type { TimeRange } from './layout.js';

export type { TimeRange } from './layout.js';

export type RangeListener = (range: TimeRange | undefined) => void;

/**
 * A time range shared between charts. A brush publishes its selection here;
 * any other chart can `subscribe` to follow it, and `set` to drive the brush.
 * Listeners are called synchronously, in subscription order.
 */
export interface TimeRangeLink {
  get(): TimeRange | undefined;
  /** Set the shared range (or `undefined` to clear it) and notify every listener. */
  set(range: TimeRange | undefined): void;
  /** Listen to changes. Returns the function that removes the listener. */
  subscribe(listener: RangeListener): () => void;
}

export function createTimeRangeLink(initial?: TimeRange): TimeRangeLink {
  let current: TimeRange | undefined = initial;
  const listeners = new Set<RangeListener>();
  return {
    get: () => current,
    set(range) {
      current = range;
      for (const listener of [...listeners]) listener(range);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
