/**
 * Playground logic that does not touch the DOM: parsing the data typed in the
 * editor, dispatching to the core chart renderers, and building the code
 * snippet shown to users. Unit-tested in `tests/playground.test.ts`.
 */
import {
  renderBarChart,
  renderLineChart,
  renderPieChart,
  renderSparkline,
  type BarDatum,
  type LocaleName,
  type PieDatum,
  type TimePoint,
} from '@d3scope/core';

export type ChartKind = 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'sparkline';

export const CHART_KINDS: readonly { id: ChartKind; label: string }[] = [
  { id: 'bar', label: 'Barres' },
  { id: 'line', label: 'Courbe' },
  { id: 'area', label: 'Aire' },
  { id: 'pie', label: 'Camembert' },
  { id: 'donut', label: 'Anneau' },
  { id: 'sparkline', label: 'Sparkline' },
];

export const SAMPLES: Record<ChartKind, string> = {
  bar: JSON.stringify(
    [
      { label: 'Jan', value: 120 },
      { label: 'Fév', value: 95 },
      { label: 'Mar', value: 140 },
      { label: 'Avr', value: -30 },
    ],
    null,
    2,
  ),
  line: JSON.stringify(
    [
      { date: '2026-01-01', value: 100 },
      { date: '2026-01-08', value: 112 },
      { date: '2026-01-15', value: 108 },
      { date: '2026-01-22', value: 131 },
    ],
    null,
    2,
  ),
  area: JSON.stringify(
    [
      { date: '2026-01-01', value: 100 },
      { date: '2026-01-08', value: 112 },
      { date: '2026-01-15', value: 108 },
      { date: '2026-01-22', value: 131 },
    ],
    null,
    2,
  ),
  pie: JSON.stringify(
    [
      { label: 'Actions', value: 55 },
      { label: 'Obligations', value: 25 },
      { label: 'Liquidités', value: 20 },
    ],
    null,
    2,
  ),
  donut: JSON.stringify(
    [
      { label: 'Actions', value: 55 },
      { label: 'Obligations', value: 25 },
      { label: 'Liquidités', value: 20 },
    ],
    null,
    2,
  ),
  sparkline: JSON.stringify([3, 5, 4, 7, 6, 9, 8], null, 2),
};

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export type ParsedData =
  | { kind: 'categories'; data: BarDatum[] }
  | { kind: 'slices'; data: PieDatum[] }
  | { kind: 'time'; data: TimePoint[] }
  | { kind: 'values'; data: number[] };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function finite(v: unknown, where: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(`${where}: "value" doit être un nombre fini`);
  }
  return v;
}

/**
 * Parse the editor text for `kind`. Errors are returned as text, never thrown,
 * so the UI can show them next to the editor.
 */
export function parseChartData(kind: ChartKind, text: string): ParseResult<ParsedData> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `JSON invalide : ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!Array.isArray(raw)) return { ok: false, error: 'Attendu : un tableau JSON' };

  try {
    if (kind === 'bar') {
      return { ok: true, value: { kind: 'categories', data: categories(raw) } };
    }
    if (kind === 'pie' || kind === 'donut') {
      const data = categories(raw).map((d) => ({ label: d.label, value: d.value }));
      return { ok: true, value: { kind: 'slices', data } };
    }
    if (kind === 'line' || kind === 'area') {
      return { ok: true, value: { kind: 'time', data: timeSeries(raw) } };
    }
    return {
      ok: true,
      value: {
        kind: 'values',
        data: raw.map((item, i) => {
          if (typeof item === 'number') return finite(item, `élément ${String(i)}`);
          if (isRecord(item)) return finite(item.value, `élément ${String(i)}`);
          throw new Error(`élément ${String(i)} : nombre attendu`);
        }),
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function categories(raw: unknown[]): BarDatum[] {
  return raw.map((item, i) => {
    if (!isRecord(item) || typeof item.label !== 'string') {
      throw new Error(`élément ${String(i)} : "label" (texte) attendu`);
    }
    return { label: item.label, value: finite(item.value, `élément ${String(i)}`) };
  });
}

function timeSeries(raw: unknown[]): TimePoint[] {
  return raw.map((item, i) => {
    if (!isRecord(item) || typeof item.date !== 'string') {
      throw new Error(`élément ${String(i)} : "date" (AAAA-MM-JJ) attendue`);
    }
    const date = new Date(item.date);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`élément ${String(i)} : date invalide "${item.date}"`);
    }
    return { date, value: finite(item.value, `élément ${String(i)}`) };
  });
}

export interface DrawOptions {
  width: number;
  height: number;
  tooltip: boolean;
  locale: LocaleName;
}

/** Draw `parsed` as `kind` into `svg`, with the playground options. */
export function drawChart(
  svg: SVGSVGElement,
  kind: ChartKind,
  parsed: ParsedData,
  options: DrawOptions,
): void {
  const { width, height, tooltip, locale } = options;
  if (kind === 'bar' && parsed.kind === 'categories') {
    renderBarChart(svg, parsed.data, { width, height, tooltip, locale });
  } else if ((kind === 'line' || kind === 'area') && parsed.kind === 'time') {
    renderLineChart(svg, parsed.data, { width, height, tooltip, locale, area: kind === 'area' });
  } else if ((kind === 'pie' || kind === 'donut') && parsed.kind === 'slices') {
    const innerRadius = kind === 'donut' ? Math.min(width, height) / 4 : 0;
    renderPieChart(svg, parsed.data, { width, height, tooltip, locale, innerRadius });
  } else if (kind === 'sparkline' && parsed.kind === 'values') {
    renderSparkline(svg, parsed.data, { width, height, area: false });
  } else {
    throw new Error(`drawChart: données "${parsed.kind}" incompatibles avec "${kind}"`);
  }
}

/** Code the user can copy: the same call the playground makes. */
export function buildSnippet(kind: ChartKind, parsed: ParsedData, options: DrawOptions): string {
  const common = `width: ${String(options.width)}, height: ${String(options.height)}, locale: '${options.locale}'`;
  const tip = options.tooltip ? ', tooltip: true' : '';
  const dataText = dataLiteral(parsed);
  const svgLine = "const svg = document.querySelector<SVGSVGElement>('svg')!;";

  if (kind === 'bar') {
    return [
      "import { renderBarChart } from '@d3scope/core';",
      svgLine,
      `renderBarChart(svg, ${dataText}, { ${common}${tip} });`,
    ].join('\n');
  }
  if (kind === 'line' || kind === 'area') {
    const area = kind === 'area' ? ', area: true' : '';
    return [
      "import { renderLineChart } from '@d3scope/core';",
      svgLine,
      `renderLineChart(svg, ${dataText}, { ${common}${tip}${area} });`,
    ].join('\n');
  }
  if (kind === 'pie' || kind === 'donut') {
    const inner =
      kind === 'donut'
        ? `, innerRadius: ${String(Math.min(options.width, options.height) / 4)}`
        : '';
    return [
      "import { renderPieChart } from '@d3scope/core';",
      svgLine,
      `renderPieChart(svg, ${dataText}, { ${common}${tip}${inner} });`,
    ].join('\n');
  }
  return [
    "import { renderSparkline } from '@d3scope/core';",
    svgLine,
    `renderSparkline(svg, ${dataText}, { width: ${String(options.width)}, height: ${String(options.height)} });`,
  ].join('\n');
}

/** Data as a JS literal. Dates become `new Date("…")` so the snippet runs as is. */
function dataLiteral(parsed: ParsedData): string {
  if (parsed.kind === 'time') {
    const rows = parsed.data.map(
      (p) =>
        `  { date: new Date('${p.date.toISOString().slice(0, 10)}'), value: ${String(p.value)} }`,
    );
    return `[\n${rows.join(',\n')}\n]`;
  }
  return JSON.stringify(parsed.data, null, 2);
}
