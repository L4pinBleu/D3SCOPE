// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  buildSnippet,
  CHART_KINDS,
  drawChart,
  parseChartData,
  SAMPLES,
  type ChartKind,
  type DrawOptions,
} from '../src/lib/playground';

const OPTS: DrawOptions = { width: 300, height: 200, tooltip: true, locale: 'fr-FR' };
const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

describe('parseChartData', () => {
  it('parses every built-in sample for its own kind', () => {
    for (const { id } of CHART_KINDS) {
      const result = parseChartData(id, SAMPLES[id]);
      expect(result.ok, id).toBe(true);
    }
  });

  it('reports invalid JSON as text', () => {
    const result = parseChartData('bar', '[{');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/JSON invalide/);
  });

  it('requires an array', () => {
    const result = parseChartData('bar', '{"a":1}');
    expect(result).toEqual({ ok: false, error: 'Attendu : un tableau JSON' });
  });

  it('requires a label on categorical data', () => {
    const result = parseChartData('bar', '[{"value": 1}]');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('"label"');
  });

  it('rejects non-numeric values with the element index', () => {
    const result = parseChartData('pie', '[{"label":"a","value":"x"}]');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('élément 0');
  });

  it('turns dates into Date objects and rejects invalid ones', () => {
    const ok = parseChartData('line', '[{"date":"2026-01-02","value":3}]');
    expect(ok.ok).toBe(true);
    if (ok.ok && ok.value.kind === 'time') {
      expect(ok.value.data[0]?.date).toBeInstanceOf(Date);
    }
    const bad = parseChartData('line', '[{"date":"nope","value":3}]');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toContain('date invalide');
  });

  it('accepts sparkline values as numbers or as {value} objects', () => {
    const a = parseChartData('sparkline', '[1, 2, 3]');
    const b = parseChartData('sparkline', '[{"value": 1}, {"value": 2}]');
    expect(a.ok && a.value.kind === 'values' && a.value.data).toEqual([1, 2, 3]);
    expect(b.ok && b.value.kind === 'values' && b.value.data).toEqual([1, 2]);
  });

  it('rejects a sparkline item that is neither a number nor an object', () => {
    const result = parseChartData('sparkline', '["x"]');
    expect(result.ok).toBe(false);
  });
});

describe('drawChart', () => {
  it('draws each kind through its core renderer', () => {
    const cases: ChartKind[] = ['bar', 'line', 'area', 'pie', 'donut', 'sparkline'];
    for (const kind of cases) {
      const parsed = parseChartData(kind, SAMPLES[kind]);
      if (!parsed.ok) throw new Error(parsed.error);
      const svg = makeSvg();
      drawChart(svg, kind, parsed.value, OPTS);
      expect(svg.childElementCount, kind).toBeGreaterThan(0);
    }
  });

  it('adds an area only for the area kind', () => {
    const parsed = parseChartData('area', SAMPLES.area);
    if (!parsed.ok) throw new Error(parsed.error);
    const svg = makeSvg();
    drawChart(svg, 'area', parsed.value, OPTS);
    expect(svg.querySelector('path.area')).not.toBeNull();
  });

  it('makes a donut hole, a pie has none', () => {
    const parsed = parseChartData('donut', SAMPLES.donut);
    if (!parsed.ok) throw new Error(parsed.error);
    const svg = makeSvg();
    drawChart(svg, 'donut', parsed.value, OPTS);
    // An annular slice has two arcs; a pie wedge starts from the centre.
    expect(svg.querySelector('path.slice')?.getAttribute('d')).not.toMatch(/^M0,0/);
  });

  it('throws when the data does not fit the kind', () => {
    const parsed = parseChartData('line', SAMPLES.line);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(() => {
      drawChart(makeSvg(), 'bar', parsed.value, OPTS);
    }).toThrow(/incompatibles/);
  });
});

describe('buildSnippet', () => {
  it('produces an import and a call with the same options as the playground', () => {
    const parsed = parseChartData('bar', SAMPLES.bar);
    if (!parsed.ok) throw new Error(parsed.error);
    const code = buildSnippet('bar', parsed.value, OPTS);
    expect(code).toContain("import { renderBarChart } from '@d3scope/core';");
    expect(code).toContain("locale: 'fr-FR'");
    expect(code).toContain('tooltip: true');
    expect(code).toContain('"label": "Jan"');
  });

  it('writes line dates as Date constructors so the snippet runs as is', () => {
    const parsed = parseChartData('line', SAMPLES.line);
    if (!parsed.ok) throw new Error(parsed.error);
    const code = buildSnippet('line', parsed.value, { ...OPTS, tooltip: false });
    expect(code).toContain("date: new Date('2026-01-01')");
    expect(code).not.toContain('tooltip: true');
  });

  it('adds innerRadius for a donut and area: true for the area kind', () => {
    const donut = parseChartData('donut', SAMPLES.donut);
    const area = parseChartData('area', SAMPLES.area);
    if (!donut.ok || !area.ok) throw new Error('fixture');
    expect(buildSnippet('donut', donut.value, OPTS)).toContain('innerRadius: 50');
    expect(buildSnippet('area', area.value, OPTS)).toContain('area: true');
  });

  it('builds a sparkline call without axes options', () => {
    const parsed = parseChartData('sparkline', SAMPLES.sparkline);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(buildSnippet('sparkline', parsed.value, OPTS)).toContain('renderSparkline(svg, [');
  });
});
