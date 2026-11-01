/**
 * Pure spec builders for the plot gallery, one function per page. Each one
 * takes the control values (numbers and colors arrive as typed text, so an
 * invalid entry can be rejected with a readable message instead of a NaN in
 * the spec) and returns a PlotSpec. Unit-tested in `tests/gallery.test.ts`.
 */
import type { AxisPosition, AxisSpec, ColorSpec, Mark, PlotSpec, ScaleKind } from '@d3scope/core';
import {
  area,
  cell,
  dot,
  histogram,
  line,
  rectX,
  rectY,
  ruleX,
  ruleY,
  stackedArea,
  text,
} from '@d3scope/core';
import {
  CITIES,
  DELIVERY_TIMES,
  ENERGY,
  HEAT,
  MONTHLY,
  SCATTER,
  TIME_SERIES,
  type CityRow,
  type EnergyRow,
  type HeatRow,
  type MonthlyRow,
} from './data.js';

/** Width and height of every gallery chart. */
export const GALLERY_SIZE = { width: 560, height: 340 } as const;

// ---------------------------------------------------------------------------
// Control parsing: text from an input becomes a value, or a clear error.
// ---------------------------------------------------------------------------

/**
 * Parse a finite number from a control. An empty field means "not set";
 * anything else that is not a finite number is rejected with a message.
 */
export function parseNumber(text: string, name: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  const value = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(value)) {
    throw new Error(`${name} : « ${text.trim()} » n'est pas un nombre fini`);
  }
  return value;
}

/** Parse a finite number that must be present. */
export function requiredNumber(text: string, name: string): number {
  const value = parseNumber(text, name);
  if (value === undefined) throw new Error(`${name} : un nombre est requis`);
  return value;
}

/** Parse a number in [0, 1]. */
function parseOpacity(text: string, name: string): number | undefined {
  const value = parseNumber(text, name);
  if (value === undefined) return undefined;
  if (value < 0 || value > 1) throw new Error(`${name} : la valeur doit être entre 0 et 1`);
  return value;
}

/** Split a comma-separated control into trimmed, non-empty items. */
export function parseList(text: string, name: string): string[] {
  const items = text
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
  if (items.length === 0) throw new Error(`${name} : au moins une valeur est requise`);
  return items;
}

/** A number-or-date axis bound, parsed according to the axis type. */
export function parseBound(
  text: string,
  name: string,
  type?: ScaleKind,
): number | Date | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  if (type === 'time') {
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`${name} : « ${trimmed} » n'est pas une date valide (AAAA-MM-JJ)`);
    }
    return date;
  }
  return parseNumber(trimmed, name);
}

// ---------------------------------------------------------------------------
// Shared axis building: every page exposes the same axis controls.
// ---------------------------------------------------------------------------

/** Control values for one axis, all as they come from the inputs. */
export interface AxisControls {
  /** `auto` (infer from the data), or an explicit scale type. */
  type: string;
  /** Lower bound of the domain, as text. */
  min: string;
  /** Upper bound of the domain, as text. */
  max: string;
  /** Round the domain to readable values. */
  nice: boolean;
  /** Distance between ticks, in data units, as text. */
  step: string;
  /** Approximate number of ticks, as text. */
  ticks: string;
  /** Axis title. */
  label: string;
  /** Gridlines at the ticks. */
  grid: boolean;
  /** Side of the plot. */
  position: string;
  /** Reverse the direction of the axis. */
  reverse: boolean;
}

/** The axis controls at rest. */
export const DEFAULT_AXIS: AxisControls = {
  type: 'auto',
  min: '',
  max: '',
  nice: true,
  step: '',
  ticks: '',
  label: '',
  grid: false,
  position: 'default',
  reverse: false,
};

/** Turn the axis controls into an AxisSpec (possibly empty). */
export function axisSpec(c: AxisControls, axis: 'x' | 'y'): AxisSpec {
  const type = c.type === 'auto' ? undefined : (c.type as ScaleKind);
  const min = parseBound(c.min, `${axis}.min`, type);
  const max = parseBound(c.max, `${axis}.max`, type);
  if (min !== undefined && max !== undefined && Number(min) > Number(max)) {
    throw new Error(`${axis} : min (${String(min)}) doit être ≤ max (${String(max)})`);
  }
  const step = parseNumber(c.step, `${axis}.step`);
  if (step !== undefined && step <= 0) throw new Error(`${axis}.step : doit être positif`);
  const ticks = parseNumber(c.ticks, `${axis}.ticks`);
  if (ticks !== undefined && ticks <= 0) throw new Error(`${axis}.ticks : doit être positif`);
  const spec: AxisSpec = {};
  if (type !== undefined) spec.type = type;
  if (min !== undefined) spec.min = min;
  if (max !== undefined) spec.max = max;
  if (!c.nice) spec.nice = false;
  if (step !== undefined) spec.step = step;
  if (ticks !== undefined) spec.ticks = Math.round(ticks);
  if (c.label.trim() !== '') spec.label = c.label.trim();
  if (c.grid) spec.grid = true;
  if (c.position !== 'default') spec.position = c.position as AxisPosition;
  if (c.reverse) spec.reverse = true;
  return spec;
}

// ---------------------------------------------------------------------------
// Page 1 and 2: bars.
// ---------------------------------------------------------------------------

export interface BarControls {
  /** Position categories on a numeric (linear) axis instead of a band axis. */
  linearPosition: boolean;
  /** Fill by the row's category instead of the theme accent. */
  fillByCategory: boolean;
  /** Bar opacity, as text in [0, 1]. */
  opacity: string;
  /** Bar width in pixels (linear position axis only), as text. */
  barWidth: string;
  x: AxisControls;
  y: AxisControls;
}

export const DEFAULT_BAR: BarControls = {
  linearPosition: false,
  fillByCategory: true,
  opacity: '0.9',
  barWidth: '20',
  x: { ...DEFAULT_AXIS },
  y: { ...DEFAULT_AXIS },
};

/** The monthly rows, numbered so a linear position axis is possible. */
export const MONTHLY_NUMBERED: readonly (MonthlyRow & { index: number })[] = MONTHLY.map(
  (row, index) => ({ ...row, index }),
);

/** Bar fill option from the controls: a category field or nothing. */
function barFill(c: BarControls): 'series' | undefined {
  return c.fillByCategory ? 'series' : undefined;
}

/** Vertical bars (rectY): x = months, y = values. */
export function barYSpec(c: BarControls): PlotSpec {
  const opacity = parseOpacity(c.opacity, 'opacity');
  const barWidth = parseNumber(c.barWidth, 'barWidth');
  if (barWidth !== undefined && barWidth <= 0) {
    throw new Error('barWidth : doit être positif');
  }
  const marks: Mark[] = [
    rectY<(typeof MONTHLY_NUMBERED)[number]>(MONTHLY_NUMBERED, {
      x: c.linearPosition ? 'index' : 'month',
      y: 'value',
      ...(barFill(c) === 'series' ? { fill: 'series' as const } : {}),
      ...(opacity !== undefined ? { opacity } : {}),
      ...(c.linearPosition && barWidth !== undefined ? { barWidth } : {}),
    }),
  ];
  return {
    ...GALLERY_SIZE,
    x: axisSpec(c.x, 'x'),
    y: axisSpec(c.y, 'y'),
    marks,
  };
}

/** Horizontal bars (rectX): x = values, y = months. */
export function barXSpec(c: BarControls): PlotSpec {
  const opacity = parseOpacity(c.opacity, 'opacity');
  const barWidth = parseNumber(c.barWidth, 'barWidth');
  if (barWidth !== undefined && barWidth <= 0) {
    throw new Error('barWidth : doit être positif');
  }
  const marks: Mark[] = [
    rectX<(typeof MONTHLY_NUMBERED)[number]>(MONTHLY_NUMBERED, {
      x: 'value',
      y: c.linearPosition ? 'index' : 'month',
      ...(barFill(c) === 'series' ? { fill: 'series' as const } : {}),
      ...(opacity !== undefined ? { opacity } : {}),
      ...(c.linearPosition && barWidth !== undefined ? { barWidth } : {}),
    }),
  ];
  return {
    ...GALLERY_SIZE,
    x: axisSpec(c.x, 'x'),
    y: axisSpec(c.y, 'y'),
    marks,
  };
}

// ---------------------------------------------------------------------------
// Page 3: lines.
// ---------------------------------------------------------------------------

export interface LineControls {
  /** Field to group the rows into series, or `none`. */
  series: string;
  /** Literal stroke colour, overriding the series colours. */
  stroke: string;
  /** Stroke width, as text. */
  strokeWidth: string;
  x: AxisControls;
  y: AxisControls;
}

export const DEFAULT_LINE: LineControls = {
  series: 'series',
  stroke: '',
  strokeWidth: '2',
  x: { ...DEFAULT_AXIS },
  y: { ...DEFAULT_AXIS },
};

/** Line chart over the 30-day series. */
export function lineSpec(c: LineControls): PlotSpec {
  const strokeWidth = parseNumber(c.strokeWidth, 'strokeWidth');
  if (strokeWidth !== undefined && strokeWidth <= 0) {
    throw new Error('strokeWidth : doit être positif');
  }
  const stroke = c.stroke.trim();
  const marks: Mark[] = [
    line<(typeof TIME_SERIES)[number]>(TIME_SERIES, {
      x: 'date',
      y: 'value',
      ...(c.series === 'none' ? {} : { series: 'series' as const }),
      ...(stroke !== '' ? { stroke } : {}),
      ...(strokeWidth !== undefined ? { strokeWidth } : {}),
    }),
  ];
  return {
    ...GALLERY_SIZE,
    x: axisSpec(c.x, 'x'),
    y: axisSpec(c.y, 'y'),
    marks,
  };
}

// ---------------------------------------------------------------------------
// Page 4: dots.
// ---------------------------------------------------------------------------

export interface DotControls {
  /** Radius in pixels, as text. */
  r: string;
  /** Fill by the row's group. */
  fillByCategory: boolean;
  /** Opacity, as text in [0, 1]. */
  opacity: string;
  x: AxisControls;
  y: AxisControls;
}

export const DEFAULT_DOT: DotControls = {
  r: '4',
  fillByCategory: true,
  opacity: '0.85',
  x: { ...DEFAULT_AXIS },
  y: { ...DEFAULT_AXIS },
};

/** Scatter plot. */
export function dotSpec(c: DotControls): PlotSpec {
  const r = parseNumber(c.r, 'r');
  if (r !== undefined && r <= 0) throw new Error('r : doit être positif');
  const opacity = parseOpacity(c.opacity, 'opacity');
  const marks: Mark[] = [
    dot<(typeof SCATTER)[number]>(SCATTER, {
      x: 'x',
      y: 'y',
      ...(c.fillByCategory ? { fill: 'group' as const } : {}),
      ...(r !== undefined ? { r } : {}),
      ...(opacity !== undefined ? { opacity } : {}),
    }),
  ];
  return {
    ...GALLERY_SIZE,
    x: axisSpec(c.x, 'x'),
    y: axisSpec(c.y, 'y'),
    marks,
  };
}

// ---------------------------------------------------------------------------
// Page 5: rules and text.
// ---------------------------------------------------------------------------

export interface RuleControls {
  /** Comma-separated y values for ruleY, as text. */
  ruleYValues: string;
  /** Comma-separated x values for ruleX, as text. */
  ruleXValues: string;
  /** SVG dash pattern, e.g. `4 4`. */
  dash: string;
  /** Rule opacity, as text in [0, 1]. */
  opacity: string;
  /** Text anchor. */
  anchor: string;
  /** Horizontal text offset, as text. */
  dx: string;
  /** Vertical text offset, as text. */
  dy: string;
  /** Font size, as text. */
  fontSize: string;
  x: AxisControls;
  y: AxisControls;
}

export const DEFAULT_RULE: RuleControls = {
  ruleYValues: '100, 140',
  ruleXValues: 'Juin',
  dash: '4 4',
  opacity: '0.8',
  anchor: 'middle',
  dx: '0',
  dy: '-8',
  fontSize: '12',
  x: { ...DEFAULT_AXIS },
  y: { ...DEFAULT_AXIS },
};

/** Bars with reference rules and one text label per month. */
export function ruleSpec(c: RuleControls): PlotSpec {
  const yRuleValues = parseNumberList(c.ruleYValues, 'ruleY');
  const xRuleValues = parseRuleXValues(c.ruleXValues, 'ruleX');
  const dash = c.dash.trim();
  const opacity = parseOpacity(c.opacity, 'opacity');
  const isAnchor = (v: string): v is 'start' | 'middle' | 'end' =>
    v === 'start' || v === 'middle' || v === 'end';
  if (!isAnchor(c.anchor)) {
    throw new Error('anchor : start, middle ou end attendu');
  }
  const anchor = c.anchor;
  const dx = parseNumber(c.dx, 'dx');
  const dy = parseNumber(c.dy, 'dy');
  const fontSize = requiredNumber(c.fontSize, 'fontSize');
  if (fontSize <= 0) throw new Error('fontSize : doit être positif');
  const ruleOptions = {
    ...(dash !== '' ? { dash } : {}),
    ...(opacity !== undefined ? { opacity } : {}),
  };
  const marks: Mark[] = [
    rectY<MonthlyRow>(MONTHLY, { x: 'month', y: 'value', fill: 'series', opacity: 0.9 }),
    ...(yRuleValues.length > 0 ? [ruleY(yRuleValues, ruleOptions)] : []),
    ...(xRuleValues.length > 0 ? [ruleX(xRuleValues, ruleOptions)] : []),
    text<MonthlyRow>(MONTHLY, {
      x: 'month',
      y: 'value',
      text: 'month',
      anchor,
      ...(dx !== undefined ? { dx } : {}),
      ...(dy !== undefined ? { dy } : {}),
      fontSize,
    }),
  ];
  return {
    ...GALLERY_SIZE,
    x: axisSpec(c.x, 'x'),
    y: axisSpec(c.y, 'y'),
    marks,
  };
}

function parseNumberList(text: string, name: string): number[] {
  return parseList(text, name).map((item) => {
    const value = Number(item.replace(',', '.'));
    if (!Number.isFinite(value)) {
      throw new Error(`${name} : « ${item} » n'est pas un nombre`);
    }
    return value;
  });
}

/** ruleX accepts numbers, dates or categories; here: numbers or categories. */
function parseRuleXValues(text: string, name: string): (number | string)[] {
  return parseList(text, name).map((item) => {
    const value = Number(item.replace(',', '.'));
    return Number.isFinite(value) && item !== '' ? value : item;
  });
}

// ---------------------------------------------------------------------------
// Page 6: axes (a line chart whose whole point is the axis options).
// ---------------------------------------------------------------------------

export type AxisPageControls = Record<'x' | 'y', AxisControls>;

export const DEFAULT_AXES: AxisPageControls = {
  x: { ...DEFAULT_AXIS, type: 'time', label: 'Jour', grid: true },
  y: { ...DEFAULT_AXIS, label: 'Valeur', nice: true },
};

/** A line chart driven only by its axis controls. */
export function axesSpec(c: AxisPageControls): PlotSpec {
  const marks: Mark[] = [
    line<(typeof TIME_SERIES)[number]>(TIME_SERIES, { x: 'date', y: 'value', strokeWidth: 2 }),
  ];
  return {
    ...GALLERY_SIZE,
    x: axisSpec(c.x, 'x'),
    y: axisSpec(c.y, 'y'),
    marks,
  };
}

// ---------------------------------------------------------------------------
// Page 7: colour legend.
// ---------------------------------------------------------------------------

export interface LegendControls {
  /** Draw the legend above the plot. */
  legend: boolean;
  /** Categories, comma-separated (order matters). */
  domain: string;
  /** Colours, comma-separated, used in order. */
  range: string;
}

export const DEFAULT_LEGEND: LegendControls = {
  legend: true,
  domain: 'Nord, Sud',
  range: '#2f6fed, #e5642f',
};

/** Stacked-category bars with an explicit colour scale. */
export function legendSpec(c: LegendControls): PlotSpec {
  const color: ColorSpec = {};
  if (c.domain.trim() !== '') {
    color.domain = parseList(c.domain, 'color.domain');
  }
  if (c.range.trim() !== '') {
    color.range = parseList(c.range, 'color.range');
  }
  if (c.legend) color.legend = true;
  const marks: Mark[] = [
    rectY<MonthlyRow>(MONTHLY, { x: 'month', y: 'value', fill: 'series', opacity: 0.9 }),
  ];
  return {
    ...GALLERY_SIZE,
    ...(Object.keys(color).length > 0 ? { color } : {}),
    x: axisSpec(DEFAULT_BAR.x, 'x'),
    y: axisSpec(DEFAULT_BAR.y, 'y'),
    marks,
  };
}

// ---------------------------------------------------------------------------
// Page 8: stacked bars (rectY with `stack`).
// ---------------------------------------------------------------------------

export interface StackedBarControls {
  /** Stack the two series of each month. Off: plain bars filled by series. */
  stack: boolean;
  /** Normalise every month to 100 % (only meaningful when stacked). */
  normalize: boolean;
  /** Show the colour legend. */
  legend: boolean;
  /** Series colours, comma-separated, used in order. */
  range: string;
  /** Bar opacity, as text in [0, 1]. */
  opacity: string;
  x: AxisControls;
  y: AxisControls;
}

export const DEFAULT_STACKED_BAR: StackedBarControls = {
  stack: true,
  normalize: false,
  legend: true,
  range: '',
  opacity: '0.9',
  x: { ...DEFAULT_AXIS },
  y: { ...DEFAULT_AXIS },
};

/** Stacked (or plain) vertical bars over the two energy series. */
export function stackedBarSpec(c: StackedBarControls): PlotSpec {
  const opacity = parseOpacity(c.opacity, 'opacity');
  const color: ColorSpec = {};
  if (c.legend) color.legend = true;
  if (c.range.trim() !== '') color.range = parseList(c.range, 'color.range');
  const marks: Mark[] = [
    rectY<EnergyRow>(ENERGY, {
      x: 'month',
      y: 'value',
      ...(c.stack
        ? {
            stack: { series: 'series' as const },
            ...(c.normalize ? { normalize: true } : {}),
          }
        : { fill: 'series' as const }),
      ...(opacity !== undefined ? { opacity } : {}),
    }),
  ];
  return {
    ...GALLERY_SIZE,
    ...(Object.keys(color).length > 0 ? { color } : {}),
    x: axisSpec(c.x, 'x'),
    y: axisSpec(c.y, 'y'),
    marks,
  };
}

// ---------------------------------------------------------------------------
// Page 9: grouped bars (rectY/rectX with `group`).
// ---------------------------------------------------------------------------

export interface GroupedBarControls {
  /** Group the two series side by side. Off: plain bars filled by series. */
  group: boolean;
  /** Horizontal variant (rectX) instead of vertical (rectY). */
  horizontal: boolean;
  /** Show the colour legend. */
  legend: boolean;
  /** Bar opacity, as text in [0, 1]. */
  opacity: string;
  x: AxisControls;
  y: AxisControls;
}

export const DEFAULT_GROUPED_BAR: GroupedBarControls = {
  group: true,
  horizontal: false,
  legend: true,
  opacity: '0.9',
  x: { ...DEFAULT_AXIS },
  y: { ...DEFAULT_AXIS },
};

/** Grouped (or plain) bars, vertical or horizontal. */
export function groupedBarSpec(c: GroupedBarControls): PlotSpec {
  const opacity = parseOpacity(c.opacity, 'opacity');
  const color: ColorSpec = {};
  if (c.legend) color.legend = true;
  const common = {
    ...(c.group ? { group: { series: 'series' as const } } : { fill: 'series' as const }),
    ...(opacity !== undefined ? { opacity } : {}),
  };
  const marks: Mark[] = [
    c.horizontal
      ? rectX<EnergyRow>(ENERGY, { x: 'value', y: 'month', ...common })
      : rectY<EnergyRow>(ENERGY, { x: 'month', y: 'value', ...common }),
  ];
  return {
    ...GALLERY_SIZE,
    ...(Object.keys(color).length > 0 ? { color } : {}),
    x: axisSpec(c.x, 'x'),
    y: axisSpec(c.y, 'y'),
    marks,
  };
}

// ---------------------------------------------------------------------------
// Page 10: areas (area, and stackedArea for the stacked mode).
// ---------------------------------------------------------------------------

export interface AreaControls {
  /** `aires`: one area per series; `empilée`: the series stacked. */
  mode: string;
  /** Field to group the rows into series, or `none` (plain mode only). */
  series: string;
  /** Normalise the stacked mode to 100 %. */
  normalize: boolean;
  /** Area opacity, as text in [0, 1]. */
  opacity: string;
  x: AxisControls;
  y: AxisControls;
}

export const DEFAULT_AREA: AreaControls = {
  mode: 'aires',
  series: 'series',
  normalize: false,
  opacity: '0.6',
  x: { ...DEFAULT_AXIS },
  y: { ...DEFAULT_AXIS },
};

/** One area per series over the 30-day series, or a stacked area chart. */
export function areaSpec(c: AreaControls): PlotSpec {
  const opacity = parseOpacity(c.opacity, 'opacity');
  const withOpacity = opacity !== undefined ? { opacity } : {};
  const marks: Mark[] = [
    c.mode === 'empilée'
      ? stackedArea<EnergyRow>(ENERGY, {
          x: 'month',
          y: 'value',
          series: 'series',
          ...(c.normalize ? { normalize: true } : {}),
          ...withOpacity,
        })
      : area<(typeof TIME_SERIES)[number]>(TIME_SERIES, {
          x: 'date',
          y: 'value',
          ...(c.series === 'none' ? {} : { series: 'series' as const }),
          ...withOpacity,
        }),
  ];
  return {
    ...GALLERY_SIZE,
    x: axisSpec(c.x, 'x'),
    y: axisSpec(c.y, 'y'),
    marks,
  };
}

// ---------------------------------------------------------------------------
// Page 11: histogram (histogram over a numeric dataset).
// ---------------------------------------------------------------------------

export interface HistogramControls {
  /** Approximate number of bins, as text. Default: Sturges. */
  count: string;
  /** Literal fill colour, as text. Default: the theme accent. */
  fill: string;
  /** Bar opacity, as text in [0, 1]. */
  opacity: string;
  x: AxisControls;
  y: AxisControls;
}

export const DEFAULT_HISTOGRAM: HistogramControls = {
  count: '',
  fill: '',
  opacity: '0.9',
  x: { ...DEFAULT_AXIS },
  y: { ...DEFAULT_AXIS },
};

/** Histogram of the delivery times. */
export function histogramSpec(c: HistogramControls): PlotSpec {
  const count = parseNumber(c.count, 'count');
  if (count !== undefined && (count <= 0 || !Number.isInteger(count))) {
    throw new Error('count : doit être un entier positif');
  }
  const fill = c.fill.trim();
  const opacity = parseOpacity(c.opacity, 'opacity');
  const marks: Mark[] = [
    histogram(DELIVERY_TIMES, {
      ...(count !== undefined ? { count: Math.round(count) } : {}),
      ...(fill !== '' ? { fill } : {}),
      ...(opacity !== undefined ? { opacity } : {}),
    }),
  ];
  return {
    ...GALLERY_SIZE,
    x: axisSpec(c.x, 'x'),
    y: axisSpec(c.y, 'y'),
    marks,
  };
}

// ---------------------------------------------------------------------------
// Page 12: bubbles (dot with `size` and `sizeRange`).
// ---------------------------------------------------------------------------

export interface BubbleControls {
  /** Radius of the smallest bubble, as text. */
  sizeMin: string;
  /** Radius of the largest bubble, as text. */
  sizeMax: string;
  /** Fill by the city's region instead of the theme accent. */
  fillByCategory: boolean;
  /** Opacity, as text in [0, 1]. */
  opacity: string;
  x: AxisControls;
  y: AxisControls;
}

export const DEFAULT_BUBBLE: BubbleControls = {
  sizeMin: '4',
  sizeMax: '24',
  fillByCategory: true,
  opacity: '0.7',
  x: { ...DEFAULT_AXIS },
  y: { ...DEFAULT_AXIS },
};

/** Bubble chart: population × GDP, the bubble area encodes the population. */
export function bubbleSpec(c: BubbleControls): PlotSpec {
  const sizeMin = parseNumber(c.sizeMin, 'sizeRange.min');
  if (sizeMin !== undefined && sizeMin <= 0) {
    throw new Error('sizeRange.min : doit être positif');
  }
  const sizeMax = parseNumber(c.sizeMax, 'sizeRange.max');
  if (sizeMax !== undefined && sizeMax <= 0) {
    throw new Error('sizeRange.max : doit être positif');
  }
  if (sizeMin !== undefined && sizeMax !== undefined && sizeMin > sizeMax) {
    throw new Error('sizeRange : min doit être ≤ max');
  }
  const sizeRange: [number, number] | undefined =
    sizeMin !== undefined || sizeMax !== undefined ? [sizeMin ?? 3, sizeMax ?? 20] : undefined;
  const opacity = parseOpacity(c.opacity, 'opacity');
  const marks: Mark[] = [
    dot<CityRow>(CITIES, {
      x: 'population',
      y: 'gdp',
      size: 'population',
      ...(sizeRange !== undefined ? { sizeRange } : {}),
      ...(c.fillByCategory ? { fill: 'region' as const } : {}),
      ...(opacity !== undefined ? { opacity } : {}),
    }),
  ];
  return {
    ...GALLERY_SIZE,
    x: axisSpec(c.x, 'x'),
    y: axisSpec(c.y, 'y'),
    marks,
  };
}

// ---------------------------------------------------------------------------
// Page 13: heatmap (cell over a day × hour grid).
// ---------------------------------------------------------------------------

export interface CellControls {
  /** Cell opacity, as text in [0, 1]. */
  opacity: string;
  x: AxisControls;
  y: AxisControls;
}

export const DEFAULT_CELL: CellControls = {
  opacity: '0.9',
  x: { ...DEFAULT_AXIS },
  y: { ...DEFAULT_AXIS },
};

/** Heatmap of the week's temperatures: hours on x, days on y. */
export function cellSpec(c: CellControls): PlotSpec {
  const opacity = parseOpacity(c.opacity, 'opacity');
  const marks: Mark[] = [
    cell<HeatRow>(HEAT, {
      x: 'hour',
      y: 'day',
      fill: 'temp',
      ...(opacity !== undefined ? { opacity } : {}),
    }),
  ];
  return {
    ...GALLERY_SIZE,
    x: axisSpec(c.x, 'x'),
    y: axisSpec(c.y, 'y'),
    marks,
  };
}

// ---------------------------------------------------------------------------
// Spec summary: what the JSON panel shows (marks are functions, so they are
// summarized by name to keep the JSON readable and copyable).
// ---------------------------------------------------------------------------

/** The spec with each mark replaced by its name. */
export interface SpecSummary extends Omit<PlotSpec, 'marks'> {
  marks: readonly string[];
}

/** Summarize a spec for the JSON panel: marks become their names. */
export function specSummary(spec: PlotSpec): SpecSummary {
  const { marks, ...rest } = spec;
  return { ...rest, marks: marks.map((mark) => mark.name) };
}
