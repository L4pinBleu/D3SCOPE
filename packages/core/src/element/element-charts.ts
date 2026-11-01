import { renderLineChart, type TimePoint } from '../charts/line.js';
import type { LocaleName } from '../format/index.js';

export interface LineLikeOptions {
  width: number;
  height: number;
  tooltip: boolean;
  locale: LocaleName | undefined;
  area: boolean;
}

/**
 * Line and area data arrive as JSON, so dates are strings. Convert them to Date
 * and validate each point before drawing.
 */
export function renderAreaOrLine(
  svg: SVGSVGElement,
  rows: unknown[],
  options: LineLikeOptions,
): void {
  const points: TimePoint[] = rows.map((row, i) => {
    if (typeof row !== 'object' || row === null) {
      throw new Error(`element ${String(i)}: expected {date, value}`);
    }
    const { date, value } = row as { date?: unknown; value?: unknown };
    if (typeof date !== 'string' && !(date instanceof Date)) {
      throw new Error(`element ${String(i)}: "date" must be a string (YYYY-MM-DD)`);
    }
    const parsed = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(parsed.getTime()))
      throw new Error(`element ${String(i)}: invalid date "${String(date)}"`);
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`element ${String(i)}: "value" must be a finite number`);
    }
    return { date: parsed, value };
  });
  renderLineChart(svg, points, options);
}
