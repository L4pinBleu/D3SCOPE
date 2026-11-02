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

// ---------------------------------------------------------------------------
// Fixtures for the new chart pages: stacked/grouped bars, areas, histogram,
// bubbles and the heatmap. The existing fixtures above are left untouched.
// ---------------------------------------------------------------------------

/** One month, one energy consumption value, in one of two regions. */
export interface EnergyRow {
  month: string;
  value: number;
  series: 'Nord' | 'Sud';
}

/** Twelve months × two regions: two rows per month, ready to stack or group. */
export const ENERGY: readonly EnergyRow[] = [
  { month: 'Jan', value: 210, series: 'Nord' },
  { month: 'Jan', value: 165, series: 'Sud' },
  { month: 'Fév', value: 190, series: 'Nord' },
  { month: 'Fév', value: 150, series: 'Sud' },
  { month: 'Mar', value: 172, series: 'Nord' },
  { month: 'Mar', value: 138, series: 'Sud' },
  { month: 'Avr', value: 140, series: 'Nord' },
  { month: 'Avr', value: 128, series: 'Sud' },
  { month: 'Mai', value: 118, series: 'Nord' },
  { month: 'Mai', value: 121, series: 'Sud' },
  { month: 'Juin', value: 96, series: 'Nord' },
  { month: 'Juin', value: 132, series: 'Sud' },
  { month: 'Juil', value: 88, series: 'Nord' },
  { month: 'Juil', value: 148, series: 'Sud' },
  { month: 'Août', value: 92, series: 'Nord' },
  { month: 'Août', value: 155, series: 'Sud' },
  { month: 'Sep', value: 124, series: 'Nord' },
  { month: 'Sep', value: 133, series: 'Sud' },
  { month: 'Oct', value: 166, series: 'Nord' },
  { month: 'Oct', value: 141, series: 'Sud' },
  { month: 'Nov', value: 198, series: 'Nord' },
  { month: 'Nov', value: 158, series: 'Sud' },
  { month: 'Déc', value: 224, series: 'Nord' },
  { month: 'Déc', value: 172, series: 'Sud' },
];

/** One daily delivery time, in minutes, over a quarter. */
export const DELIVERY_TIMES: readonly number[] = [
  21, 34, 28, 41, 19, 33, 27, 38, 22, 31, 26, 45, 24, 30, 29, 36, 20, 32, 25, 43, 23, 35, 28, 39,
  26, 31, 22, 37, 33, 24, 29, 42, 27, 30, 21, 36, 32, 25, 40, 28, 34, 23, 31, 26, 38, 29, 24, 35,
  27, 33, 22, 44, 30, 26, 39, 25, 32, 28, 41, 20, 37, 31, 24, 45, 29, 34, 23, 36, 27, 32, 21, 43,
  30, 26, 38, 25, 33, 22, 40, 28,
];

/** One city: population (millions), GDP per capita (k$), one of three regions. */
export interface CityRow {
  name: string;
  population: number;
  gdp: number;
  region: 'Centre' | 'Est' | 'Ouest';
}

/** Twelve cities, enough for three distinct regional clusters. */
export const CITIES: readonly CityRow[] = [
  { name: 'Aurelia', population: 1.2, gdp: 38, region: 'Centre' },
  { name: 'Belmont', population: 2.4, gdp: 52, region: 'Centre' },
  { name: 'Casterly', population: 0.9, gdp: 31, region: 'Centre' },
  { name: 'Dorne', population: 3.1, gdp: 61, region: 'Centre' },
  { name: 'Eyrie', population: 1.8, gdp: 24, region: 'Est' },
  { name: 'Freyvale', population: 2.6, gdp: 29, region: 'Est' },
  { name: 'Gulltown', population: 1.1, gdp: 21, region: 'Est' },
  { name: 'Harrenhal', population: 1.5, gdp: 33, region: 'Est' },
  { name: 'Ironport', population: 2.9, gdp: 44, region: 'Ouest' },
  { name: 'Lannisport', population: 0.8, gdp: 27, region: 'Ouest' },
  { name: 'Merroway', population: 1.6, gdp: 36, region: 'Ouest' },
  { name: 'Nightsong', population: 0.7, gdp: 19, region: 'Ouest' },
];

// ---------------------------------------------------------------------------
// Fixtures for the pages of the new core features: titles, curves, bands,
// log and time axes, box plots, radar and polar area. Synthetic data only.
// ---------------------------------------------------------------------------

/** One month and one value spanning several decades. */
export interface LogRow {
  month: string;
  value: number;
}

/** Twelve monthly values over four decades: a straight line on a log axis. */
export const LOG_SERIES: readonly LogRow[] = [
  { month: 'Jan', value: 1.2 },
  { month: 'Fév', value: 3.5 },
  { month: 'Mar', value: 9 },
  { month: 'Avr', value: 24 },
  { month: 'Mai', value: 65 },
  { month: 'Juin', value: 180 },
  { month: 'Juil', value: 520 },
  { month: 'Août', value: 1400 },
  { month: 'Sep', value: 3900 },
  { month: 'Oct', value: 10500 },
  { month: 'Nov', value: 28000 },
  { month: 'Déc', value: 76000 },
];

/** One band: two bounds (order does not matter) and a label. */
export interface BandRow {
  from: number;
  to: number;
  label: string;
}

/** Two tolerance zones over the monthly values, for `rangeY`. */
export const SPEC_BANDS: readonly BandRow[] = [
  { from: 80, to: 120, label: 'Zone cible' },
  { from: 130, to: 150, label: 'Alerte' },
];

/** One date band over the 30-day series, for `rangeX`. */
export interface TimeBandRow {
  from: Date;
  to: Date;
  label: string;
}

/** Two campaign periods over the 30-day series, for `rangeX`. */
export const TIME_BANDS: readonly TimeBandRow[] = [
  {
    from: new Date(Date.UTC(2026, 0, 6)),
    to: new Date(Date.UTC(2026, 0, 12)),
    label: 'Campagne A',
  },
  {
    from: new Date(Date.UTC(2026, 0, 18)),
    to: new Date(Date.UTC(2026, 0, 24)),
    label: 'Campagne B',
  },
];

/** One category and one value, for the box plot. */
export interface BoxRow {
  group: string;
  value: number;
}

/** Four groups of delivery times, with enough spread for whiskers and an outlier. */
export const BOX_GROUPS: readonly BoxRow[] = ['A', 'B', 'C', 'D'].flatMap((group, g) =>
  Array.from({ length: 9 }, (_, i) => ({
    group,
    value:
      20 + g * 8 + Math.round(6 * Math.sin((i / 9) * Math.PI * 2)) + (i === 4 && g === 1 ? 30 : 0),
  })),
);

/** One radar series: a name and one value per axis. */
export interface RadarSeriesRow {
  name: string;
  values: number[];
}

/** The five axes of the radar. */
export const RADAR_AXES: readonly string[] = ['Qualité', 'Coût', 'Délai', 'Service', 'Innovation'];

/** Two products compared on the five radar axes. */
export const RADAR_SERIES: readonly RadarSeriesRow[] = [
  { name: 'Produit A', values: [8, 6, 7, 9, 5] },
  { name: 'Produit B', values: [6, 8, 5, 7, 8] },
];

/** One polar sector: a label and a non-negative value. */
export interface PolarRow {
  label: string;
  value: number;
}

/** Seven weekday totals for the polar area chart. */
export const POLAR_SECTORS: readonly PolarRow[] = [
  { label: 'Lun', value: 12 },
  { label: 'Mar', value: 18 },
  { label: 'Mer', value: 9 },
  { label: 'Jeu', value: 22 },
  { label: 'Ven', value: 16 },
  { label: 'Sam', value: 28 },
  { label: 'Dim', value: 6 },
];

/** One hour of one day: the temperature, in °C. */
export interface HeatRow {
  day: string;
  hour: string;
  temp: number;
}

/** Seven days × six hours: a week of temperatures, ready for `cell`. */
const HEAT_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;
const HEAT_HOURS = ['0h', '4h', '8h', '12h', '16h', '20h'] as const;
export const HEAT: readonly HeatRow[] = HEAT_DAYS.flatMap((day, d) =>
  HEAT_HOURS.map((hour, h) => {
    const dayShift = Math.round(3 * Math.sin((d / 7) * Math.PI * 2));
    const hourShift = Math.round(9 * Math.sin(((h - 2) / 6) * Math.PI * 2));
    return { day, hour, temp: 11 + dayShift + hourShift + ((d * 3 + h) % 4) - 1.5 };
  }),
);
