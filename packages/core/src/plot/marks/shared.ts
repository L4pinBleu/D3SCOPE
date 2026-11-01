/**
 * Helpers shared by the plot marks: value accessors, numeric coercion, pixel
 * positions and the fill rule for categorical colour.
 */
import type { PlotContext, Primitive } from '../types.js';

/** A field name of the row, or a function of the row. */
export type Accessor<T, V> = keyof T | ((row: T) => V);

/** Resolve an accessor to a function. The result may be null/undefined at runtime. */
export function accessor<T, V>(key: Accessor<T, V>): (row: T) => V | null | undefined {
  return typeof key === 'function' ? (row) => key(row) : (row) => row[key] as V | null | undefined;
}

/** Coerce a value to a finite number, or `null` when missing or NaN. */
export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.getTime();
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Coerce a Primitive to a number for ordering (Date → ms, string → NaN). */
export function toMillis(value: Primitive): number {
  if (value instanceof Date) return value.getTime();
  return typeof value === 'number' ? value : Number(value);
}

/** Pixel x of a value: band centre for band scales, else the plain position. */
export function xPosition(ctx: PlotContext, value: Primitive): number {
  const p = ctx.x.position(value);
  const bandwidth = ctx.x.bandwidth();
  return bandwidth > 0 ? p + bandwidth / 2 : p;
}

/** Whether a value can be placed on an axis: a finite number, a date, or a non-empty category. */
export function isPlottable(value: unknown): value is Primitive {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'string' && value !== '';
}

/**
 * How a `fill` option reads the rows. Decided once per mark, so `colorValues`
 * and `render` always agree:
 * - `category`: a field name of the rows, read through the plot's colour scale;
 * - `literal`: a CSS colour used for every row;
 * - `function`: a colour computed per row;
 * - `default`: no fill given, the theme accent.
 *
 * A string is a field when it is a key of the first row; otherwise it is a
 * literal colour.
 */
export type FillMode<T> =
  | { kind: 'category'; field: keyof T }
  | { kind: 'literal'; colour: string }
  | { kind: 'function'; compute: (row: T) => string }
  | { kind: 'default' };

export function fillMode<T>(
  fill: string | ((row: T) => string) | undefined,
  rows: readonly T[],
): FillMode<T> {
  if (fill === undefined) return { kind: 'default' };
  if (typeof fill === 'function') return { kind: 'function', compute: fill };
  const first = rows[0];
  if (fill !== '' && typeof first === 'object' && first !== null && fill in first) {
    return { kind: 'category', field: fill as keyof T };
  }
  return { kind: 'literal', colour: fill };
}
