/**
 * Channels: how a mark reads a value from each datum. A channel is either a
 * field name (`'date'`) or a function (`(d) => d.value * 2`).
 */
import type { Primitive } from './types.js';

export type Accessor<T> = (keyof T & string) | ((datum: T) => Primitive);

/** Value of `datum` through `accessor`. */
export function valueOf<T>(datum: T, accessor: Accessor<T>): Primitive {
  if (typeof accessor === 'function') return accessor(datum);
  return datum[accessor] as unknown as Primitive;
}

/** Values of all `data` through `accessor`, in data order. */
export function valuesOf<T>(data: readonly T[], accessor: Accessor<T>): Primitive[] {
  return data.map((d) => valueOf(d, accessor));
}
