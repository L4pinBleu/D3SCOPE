/**
 * Sample data for the plot gallery. One module so every page draws from the
 * same, realistic fixtures: a monthly series with two categories, a 30-day
 * time series and a small scatter.
 */

/** One month, one value, one of two categories. */
export interface MonthlyRow {
  month: string;
  value: number;
  series: 'Nord' | 'Sud';
}

/** Twelve monthly values over two categories. */
export const MONTHLY: readonly MonthlyRow[] = [
  { month: 'Jan', value: 120, series: 'Nord' },
  { month: 'Fév', value: 95, series: 'Sud' },
  { month: 'Mar', value: 140, series: 'Nord' },
  { month: 'Avr', value: 88, series: 'Sud' },
  { month: 'Mai', value: 132, series: 'Nord' },
  { month: 'Juin', value: 105, series: 'Sud' },
  { month: 'Juil', value: 150, series: 'Nord' },
  { month: 'Août', value: 76, series: 'Sud' },
  { month: 'Sep', value: 118, series: 'Nord' },
  { month: 'Oct', value: 96, series: 'Sud' },
  { month: 'Nov', value: 138, series: 'Nord' },
  { month: 'Déc', value: 110, series: 'Sud' },
];

/** One day of the 30-day series, in one of two series. */
export interface DayRow {
  date: Date;
  value: number;
  series: 'A' | 'B';
}

/** Thirty consecutive days starting 2026-01-01. */
export const TIME_SERIES: readonly DayRow[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(Date.UTC(2026, 0, 1 + i));
  const value = 60 + Math.round(30 * Math.sin(i / 4)) + i + (i % 2 === 0 ? 12 : 0);
  return { date, value, series: i % 2 === 0 ? ('A' as const) : ('B' as const) };
});

/** One scatter point, in one of three groups. */
export interface ScatterRow {
  x: number;
  y: number;
  group: 'alpha' | 'beta' | 'gamma';
}

/** A small, clearly grouped scatter. */
export const SCATTER: readonly ScatterRow[] = [
  { x: 10, y: 24, group: 'alpha' },
  { x: 18, y: 31, group: 'alpha' },
  { x: 26, y: 27, group: 'alpha' },
  { x: 34, y: 38, group: 'alpha' },
  { x: 42, y: 35, group: 'alpha' },
  { x: 15, y: 12, group: 'beta' },
  { x: 24, y: 15, group: 'beta' },
  { x: 33, y: 11, group: 'beta' },
  { x: 45, y: 18, group: 'beta' },
  { x: 55, y: 14, group: 'beta' },
  { x: 50, y: 48, group: 'gamma' },
  { x: 58, y: 44, group: 'gamma' },
  { x: 66, y: 52, group: 'gamma' },
  { x: 74, y: 47, group: 'gamma' },
  { x: 82, y: 55, group: 'gamma' },
];
