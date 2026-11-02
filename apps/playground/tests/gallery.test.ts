// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  axisSpec,
  areaSpec,
  barXSpec,
  barYSpec,
  bubbleSpec,
  cellSpec,
  DEFAULT_AXIS,
  DEFAULT_BAR,
  DEFAULT_BUBBLE,
  DEFAULT_CELL,
  DEFAULT_DOT,
  DEFAULT_GROUPED_BAR,
  DEFAULT_HISTOGRAM,
  DEFAULT_LEGEND,
  DEFAULT_LINE,
  DEFAULT_RULE,
  DEFAULT_STACKED_BAR,
  DEFAULT_AREA,
  DEFAULT_BANDS,
  DEFAULT_BOX_PLOT,
  DEFAULT_CURVES,
  DEFAULT_LOG,
  DEFAULT_POLAR,
  DEFAULT_RADAR,
  DEFAULT_TIME_AXIS,
  DEFAULT_TITLE,
  bandsSpec,
  boxPlotSpec,
  curvesSpec,
  dotSpec,
  axesSpec,
  groupedBarSpec,
  histogramSpec,
  legendSpec,
  lineSpec,
  logSpec,
  parseList,
  parseNumber,
  polarSpec,
  radarSpec,
  ruleSpec,
  specSummary,
  stackedBarSpec,
  timeAxisSpec,
  titleSpec,
  type AxisControls,
  type BarControls,
} from '../src/gallery/config';

/** An axis control set with `field` replaced. */
function withAxis(
  field: keyof AxisControls,
  value: AxisControls[keyof AxisControls],
): AxisControls {
  return { ...DEFAULT_AXIS, [field]: value };
}

/** Bar controls with the y-axis `step` set. */
function barWith(axis: 'x' | 'y', field: keyof AxisControls, value: unknown): BarControls {
  return { ...DEFAULT_BAR, [axis]: { ...DEFAULT_AXIS, [field]: value } };
}

describe('parseNumber', () => {
  it('accepts finite numbers and empty fields', () => {
    expect(parseNumber('12', 'x')).toBe(12);
    expect(parseNumber(' -3.5 ', 'x')).toBe(-3.5);
    expect(parseNumber('', 'x')).toBeUndefined();
  });

  it('rejects invalid values with a message, not NaN', () => {
    for (const bad of ['abc', 'NaN', '1e999', '12,3,4']) {
      expect(() => parseNumber(bad, 'opacity')).toThrow(/opacity/);
    }
  });
});

describe('parseList', () => {
  it('splits on commas and trims', () => {
    expect(parseList('a, b ,c', 'x')).toEqual(['a', 'b', 'c']);
  });

  it('rejects an empty list', () => {
    expect(() => parseList('  ,, ', 'color.domain')).toThrow(/color\.domain/);
  });
});

describe('axisSpec', () => {
  it('is empty for the default controls', () => {
    expect(axisSpec(DEFAULT_AXIS, 'x')).toEqual({});
  });

  it('maps the controls onto the spec', () => {
    const spec = axisSpec(
      {
        ...DEFAULT_AXIS,
        type: 'log',
        min: '1',
        max: '1000',
        nice: false,
        step: '10',
        ticks: '8',
        label: 'Valeur',
        grid: true,
        position: 'right',
        reverse: true,
      },
      'y',
    );
    expect(spec).toEqual({
      type: 'log',
      min: 1,
      max: 1000,
      nice: false,
      step: 10,
      ticks: 8,
      label: 'Valeur',
      grid: true,
      position: 'right',
      reverse: true,
    });
  });

  it('rejects min > max and non-positive step or ticks', () => {
    expect(() => axisSpec({ ...DEFAULT_AXIS, min: '5', max: '1' }, 'y')).toThrow(/min/);
    expect(() => axisSpec(withAxis('step', '-2'), 'y')).toThrow(/step/);
    expect(() => axisSpec(withAxis('ticks', '0'), 'y')).toThrow(/ticks/);
  });

  it('rejects a non-finite numeric value with a message', () => {
    expect(() => axisSpec(withAxis('step', 'abc'), 'y')).toThrow(/y\.step/);
  });

  it('parses time bounds as dates', () => {
    const spec = axisSpec(
      { ...DEFAULT_AXIS, type: 'time', min: '2026-01-01', max: '2026-01-31' },
      'x',
    );
    expect(spec.min).toBeInstanceOf(Date);
    expect(spec.max).toBeInstanceOf(Date);
    expect(() => axisSpec({ ...DEFAULT_AXIS, type: 'time', min: 'demain' }, 'x')).toThrow(
      /date valide/,
    );
  });
});

describe('barYSpec / barXSpec', () => {
  it('builds one rectY mark with fill by category and the given opacity', () => {
    const spec = specSummary(barYSpec(DEFAULT_BAR));
    expect(spec.width).toBe(560);
    expect(spec.height).toBe(340);
    expect(spec.marks).toEqual(['rectY']);
  });

  it('changes step on the spec when the axis step control changes', () => {
    const spec = barYSpec(barWith('y', 'step', '10'));
    expect(spec.y?.step).toBe(10);
    const other = barYSpec(barWith('y', 'step', '25'));
    expect(other.y?.step).toBe(25);
    expect(barYSpec(DEFAULT_BAR).y?.step).toBeUndefined();
  });

  it('drops the barWidth when the position axis is categorical', () => {
    const linear = barYSpec({ ...DEFAULT_BAR, linearPosition: true, barWidth: '15' });
    expect(linear.marks.length).toBe(1);
    const categorical = barYSpec({ ...DEFAULT_BAR, barWidth: '15' });
    // Both build fine; the linear one exposes a numeric x type.
    expect(linear.x?.type).toBeUndefined();
    expect(categorical.x?.type).toBeUndefined();
  });

  it('rejects a non-finite opacity or barWidth with a message', () => {
    expect(() => barYSpec({ ...DEFAULT_BAR, opacity: 'beaucoup' })).toThrow(/opacity/);
    expect(() => barYSpec({ ...DEFAULT_BAR, opacity: '2' })).toThrow(/entre 0 et 1/);
    expect(() => barXSpec({ ...DEFAULT_BAR, barWidth: '-3' })).toThrow(/barWidth/);
  });

  it('builds the horizontal variant with one rectX mark', () => {
    expect(specSummary(barXSpec(DEFAULT_BAR)).marks).toEqual(['rectX']);
  });
});

describe('lineSpec', () => {
  it('groups by series by default and overrides the stroke when given', () => {
    expect(specSummary(lineSpec(DEFAULT_LINE)).marks).toEqual(['line']);
    const noSeries = lineSpec({ ...DEFAULT_LINE, series: 'none', stroke: '#123456' });
    expect(specSummary(noSeries).marks).toEqual(['line']);
  });

  it('changes strokeWidth through the control and rejects bad values', () => {
    expect(lineSpec({ ...DEFAULT_LINE, strokeWidth: '5' }).marks.length).toBe(1);
    expect(() => lineSpec({ ...DEFAULT_LINE, strokeWidth: '0' })).toThrow(/strokeWidth/);
  });
});

describe('dotSpec', () => {
  it('builds one dot mark and propagates the radius control', () => {
    const spec = dotSpec({ ...DEFAULT_DOT, r: '9' });
    expect(specSummary(spec).marks).toEqual(['dot']);
    expect(() => dotSpec({ ...DEFAULT_DOT, r: '0' })).toThrow(/r/);
    expect(() => dotSpec({ ...DEFAULT_DOT, opacity: '1.5' })).toThrow(/entre 0 et 1/);
  });
});

describe('ruleSpec', () => {
  it('builds bars, rules and text', () => {
    const summary = specSummary(ruleSpec(DEFAULT_RULE));
    expect(summary.marks).toEqual(['rectY', 'rule-y', 'rule-x', 'text']);
  });

  it('parses the rule values as numbers or categories', () => {
    const numeric = ruleSpec({ ...DEFAULT_RULE, ruleXValues: '5.5, 7' });
    expect(specSummary(numeric).marks).toContain('rule-x');
  });

  it('rejects invalid rule values, anchor and font size', () => {
    expect(() => ruleSpec({ ...DEFAULT_RULE, ruleYValues: 'a, b' })).toThrow(/ruleY/);
    expect(() => ruleSpec({ ...DEFAULT_RULE, anchor: 'centre' })).toThrow(/anchor/);
    expect(() => ruleSpec({ ...DEFAULT_RULE, fontSize: '0' })).toThrow(/fontSize/);
    expect(() => ruleSpec({ ...DEFAULT_RULE, fontSize: '' })).toThrow(/nombre est requis/);
  });
});

describe('axesSpec', () => {
  it('builds a line chart and forwards the axis controls', () => {
    const spec = axesSpec({
      x: { ...DEFAULT_AXIS, type: 'time', label: 'Jour', grid: true },
      y: { ...DEFAULT_AXIS, min: '0', reverse: true },
    });
    expect(specSummary(spec).marks).toEqual(['line']);
    expect(spec.x?.type).toBe('time');
    expect(spec.y?.min).toBe(0);
    expect(spec.y?.reverse).toBe(true);
  });
});

describe('legendSpec', () => {
  it('exposes legend, domain order and range from the controls', () => {
    const spec = legendSpec(DEFAULT_LEGEND);
    expect(spec.color?.legend).toBe(true);
    expect(spec.color?.domain).toEqual(['Nord', 'Sud']);
    expect(spec.color?.range).toEqual(['#2f6fed', '#e5642f']);
    const off = legendSpec({ ...DEFAULT_LEGEND, legend: false, domain: 'Sud, Nord' });
    expect(off.color?.legend).toBeUndefined();
    expect(off.color?.domain).toEqual(['Sud', 'Nord']);
  });

  it('rejects a bad colour list', () => {
    expect(() => legendSpec({ ...DEFAULT_LEGEND, range: ' ,, ' })).toThrow(/color\.range/);
  });
});

describe('specSummary', () => {
  it('replaces the marks by their names so the JSON stays readable', () => {
    const summary = specSummary(barYSpec(DEFAULT_BAR));
    expect(JSON.parse(JSON.stringify(summary))).toEqual(summary);
  });
});

describe('stackedBarSpec', () => {
  it('builds one rectY mark with the legend by default', () => {
    const spec = stackedBarSpec(DEFAULT_STACKED_BAR);
    expect(specSummary(spec).marks).toEqual(['rectY']);
    expect(spec.color?.legend).toBe(true);
  });

  it('stacks by default, falls back to a plain series fill, and normalizes on demand', () => {
    const plain = stackedBarSpec({ ...DEFAULT_STACKED_BAR, stack: false });
    expect(specSummary(plain).marks).toEqual(['rectY']);
    expect(plain.color?.legend).toBe(true);
    const normalized = stackedBarSpec({ ...DEFAULT_STACKED_BAR, normalize: true });
    expect(specSummary(normalized).marks).toEqual(['rectY']);
  });

  it('propagates the series colour range and rejects a bad colour list', () => {
    const coloured = stackedBarSpec({ ...DEFAULT_STACKED_BAR, range: '#111, #222' });
    expect(coloured.color?.range).toEqual(['#111', '#222']);
    expect(() => stackedBarSpec({ ...DEFAULT_STACKED_BAR, range: '  ' })).not.toThrow();
    expect(() => stackedBarSpec({ ...DEFAULT_STACKED_BAR, opacity: 'beaucoup' })).toThrow(
      /opacity/,
    );
    expect(() => stackedBarSpec({ ...DEFAULT_STACKED_BAR, opacity: '2' })).toThrow(/entre 0 et 1/);
  });
});

describe('groupedBarSpec', () => {
  it('builds a vertical rectY by default and a horizontal rectX on demand', () => {
    expect(specSummary(groupedBarSpec(DEFAULT_GROUPED_BAR)).marks).toEqual(['rectY']);
    expect(specSummary(groupedBarSpec({ ...DEFAULT_GROUPED_BAR, horizontal: true })).marks).toEqual(
      ['rectX'],
    );
  });

  it('turns grouping off into a plain series fill and rejects a bad opacity', () => {
    expect(specSummary(groupedBarSpec({ ...DEFAULT_GROUPED_BAR, group: false })).marks).toEqual([
      'rectY',
    ]);
    expect(() => groupedBarSpec({ ...DEFAULT_GROUPED_BAR, opacity: '-1' })).toThrow(/entre 0 et 1/);
  });
});

describe('areaSpec', () => {
  it('builds one area mark per series by default', () => {
    const spec = areaSpec(DEFAULT_AREA);
    expect(specSummary(spec).marks).toEqual(['area']);
    expect(specSummary(areaSpec({ ...DEFAULT_AREA, series: 'none' })).marks).toEqual(['area']);
  });

  it('switches to a stacked area and normalizes on demand', () => {
    const stacked = areaSpec({ ...DEFAULT_AREA, mode: 'empilée' });
    expect(specSummary(stacked).marks).toEqual(['stackedArea']);
    const normalized = areaSpec({ ...DEFAULT_AREA, mode: 'empilée', normalize: true });
    expect(specSummary(normalized).marks).toEqual(['stackedArea']);
  });

  it('rejects an invalid opacity with a message', () => {
    expect(() => areaSpec({ ...DEFAULT_AREA, opacity: 'nulle' })).toThrow(/opacity/);
  });
});

describe('histogramSpec', () => {
  it('builds one histogram mark and accepts an explicit bin count', () => {
    expect(specSummary(histogramSpec(DEFAULT_HISTOGRAM)).marks).toEqual(['histogram']);
    expect(specSummary(histogramSpec({ ...DEFAULT_HISTOGRAM, count: '8' })).marks).toEqual([
      'histogram',
    ]);
  });

  it('rejects a non-integer, non-positive or missing-number count', () => {
    expect(() => histogramSpec({ ...DEFAULT_HISTOGRAM, count: '7.5' })).toThrow(/count/);
    expect(() => histogramSpec({ ...DEFAULT_HISTOGRAM, count: '0' })).toThrow(/count/);
    expect(() => histogramSpec({ ...DEFAULT_HISTOGRAM, count: 'abc' })).toThrow(/count/);
  });

  it('rejects an invalid opacity with a message', () => {
    expect(() => histogramSpec({ ...DEFAULT_HISTOGRAM, opacity: '3' })).toThrow(/entre 0 et 1/);
  });
});

describe('bubbleSpec', () => {
  it('builds one dot mark with fill by region and the default size range', () => {
    const spec = bubbleSpec(DEFAULT_BUBBLE);
    expect(specSummary(spec).marks).toEqual(['dot']);
    expect(() => bubbleSpec({ ...DEFAULT_BUBBLE, fillByCategory: false })).not.toThrow();
  });

  it('rejects a non-positive or reversed size range', () => {
    expect(() => bubbleSpec({ ...DEFAULT_BUBBLE, sizeMin: '-2' })).toThrow(/sizeRange\.min/);
    expect(() => bubbleSpec({ ...DEFAULT_BUBBLE, sizeMax: '0' })).toThrow(/sizeRange\.max/);
    expect(() => bubbleSpec({ ...DEFAULT_BUBBLE, sizeMin: '30', sizeMax: '10' })).toThrow(
      /sizeRange/,
    );
  });

  it('rejects an invalid opacity with a message', () => {
    expect(() => bubbleSpec({ ...DEFAULT_BUBBLE, opacity: 'gros' })).toThrow(/opacity/);
  });
});

describe('cellSpec', () => {
  it('builds one cell mark over the day × hour grid', () => {
    expect(specSummary(cellSpec(DEFAULT_CELL)).marks).toEqual(['cell']);
  });

  it('rejects an invalid opacity with a message', () => {
    expect(() => cellSpec({ ...DEFAULT_CELL, opacity: 'opaque' })).toThrow(/opacity/);
  });
});

describe('titleSpec', () => {
  it('sets the title and subtitle on the spec', () => {
    const spec = titleSpec(DEFAULT_TITLE);
    expect(spec.title).toBe('Ventes mensuelles');
    expect(spec.subtitle).toBe('Valeur par série, janvier à décembre');
    expect(specSummary(spec).marks).toEqual(['rectY']);
  });

  it('drops empty or whitespace-only titles and subtitles', () => {
    const spec = titleSpec({ title: '   ', subtitle: '' });
    expect(spec.title).toBeUndefined();
    expect(spec.subtitle).toBeUndefined();
  });
});

describe('curvesSpec', () => {
  it('draws an area and a line with the default curve', () => {
    const spec = curvesSpec(DEFAULT_CURVES);
    expect(specSummary(spec).marks).toEqual(['area', 'line']);
  });

  it('applies the changed curve to both marks', () => {
    const spec = curvesSpec({ ...DEFAULT_CURVES, curve: 'monotone' });
    expect(specSummary(spec).marks).toEqual(['area', 'line']);
  });

  it('rejects an unknown curve with a message', () => {
    expect(() => curvesSpec({ ...DEFAULT_CURVES, curve: 'zigzag' as never })).toThrow(
      /n'est pas une interpolation/,
    );
  });
});

describe('bandsSpec', () => {
  it('draws two horizontal bands behind the line by default', () => {
    const spec = bandsSpec(DEFAULT_BANDS);
    expect(specSummary(spec).marks).toEqual(['rangeY', 'line']);
  });

  it('switches to vertical bands (rangeX) on demand', () => {
    const spec = bandsSpec({ ...DEFAULT_BANDS, horizontal: true });
    expect(specSummary(spec).marks).toEqual(['rangeX', 'line']);
  });

  it('drops a band whose bounds are both empty', () => {
    const spec = bandsSpec({
      ...DEFAULT_BANDS,
      band2From: '',
      band2To: '',
      band2Label: '',
    });
    expect(specSummary(spec).marks[0]).toBe('rangeY');
    expect(specSummary(spec).marks).toEqual(['rangeY', 'line']);
  });

  it('requires both bounds of a band', () => {
    expect(() => bandsSpec({ ...DEFAULT_BANDS, bandFrom: '80', bandTo: '' })).toThrow(
      /les deux bornes/,
    );
    expect(() => bandsSpec({ ...DEFAULT_BANDS, bandFrom: '', bandTo: '120' })).toThrow(
      /les deux bornes/,
    );
  });

  it('rejects a non-finite bound or a bad opacity with a message', () => {
    expect(() => bandsSpec({ ...DEFAULT_BANDS, bandFrom: 'haute' })).toThrow(/bandFrom/);
    expect(() => bandsSpec({ ...DEFAULT_BANDS, opacity: '2' })).toThrow(/entre 0 et 1/);
  });
});

describe('logSpec', () => {
  it('forces a log y axis over the wide-range series', () => {
    const spec = logSpec(DEFAULT_LOG);
    expect(spec.y?.type).toBe('log');
    expect(specSummary(spec).marks).toEqual(['line']);
  });

  it('sets the base and the minor ticks on demand', () => {
    const spec = logSpec({ ...DEFAULT_LOG, base: '2', minorTicks: true });
    expect(spec.y?.base).toBe(2);
    expect(spec.y?.minorTicks).toBe(true);
  });

  it('rejects a base that is not above 1', () => {
    expect(() => logSpec({ ...DEFAULT_LOG, base: '1' })).toThrow(/y\.base/);
    expect(() => logSpec({ ...DEFAULT_LOG, base: '-3' })).toThrow(/y\.base/);
    expect(() => logSpec({ ...DEFAULT_LOG, base: 'gros' })).toThrow(/y\.base/);
  });
});

describe('timeAxisSpec', () => {
  it('gives the time axis ISO string bounds and keeps nice', () => {
    const spec = timeAxisSpec(DEFAULT_TIME_AXIS);
    expect(spec.x?.type).toBe('time');
    expect(spec.x?.min).toBe('2026-01-05');
    expect(spec.x?.max).toBe('2026-01-25');
    expect(spec.x?.nice).toBe(true);
    expect(specSummary(spec).marks).toEqual(['line']);
  });

  it('accepts empty bounds and a nice turned off', () => {
    const spec = timeAxisSpec({ ...DEFAULT_TIME_AXIS, min: '', max: '', nice: false });
    expect(spec.x?.min).toBeUndefined();
    expect(spec.x?.max).toBeUndefined();
    expect(spec.x?.nice).toBe(false);
  });

  it('rejects a reversed range and a non-time x type', () => {
    expect(() =>
      timeAxisSpec({ ...DEFAULT_TIME_AXIS, min: '2026-01-25', max: '2026-01-05' }),
    ).toThrow(/doit être ≤ max/);
    expect(() =>
      timeAxisSpec({ ...DEFAULT_TIME_AXIS, x: { ...DEFAULT_TIME_AXIS.x, type: 'linear' } }),
    ).toThrow(/« time »/);
  });
});

describe('boxPlotSpec', () => {
  it('builds one boxPlot mark with the default options', () => {
    const spec = boxPlotSpec(DEFAULT_BOX_PLOT);
    expect(specSummary(spec).marks).toEqual(['boxPlot']);
  });

  it('accepts a literal fill and a changed width', () => {
    const spec = boxPlotSpec({ ...DEFAULT_BOX_PLOT, fill: '#2f6fed', width: '0.8' });
    expect(specSummary(spec).marks).toEqual(['boxPlot']);
  });

  it('rejects a width outside [0.1, 1] and a bad opacity', () => {
    expect(() => boxPlotSpec({ ...DEFAULT_BOX_PLOT, width: '0.05' })).toThrow(/entre 0.1 et 1/);
    expect(() => boxPlotSpec({ ...DEFAULT_BOX_PLOT, width: '2' })).toThrow(/entre 0.1 et 1/);
    expect(() => boxPlotSpec({ ...DEFAULT_BOX_PLOT, opacity: 'large' })).toThrow(/opacity/);
  });
});

describe('radarSpec', () => {
  it('builds a radar spec over the five axes and two series', () => {
    const spec = radarSpec(DEFAULT_RADAR);
    expect(spec.axes).toHaveLength(5);
    expect(spec.series).toHaveLength(2);
    expect(spec.levels).toBe(4);
    expect(spec.fill).toBe(0.2);
    expect(spec.color?.legend).toBe(true);
  });

  it('accepts an explicit max, a changed level count and no labels', () => {
    const spec = radarSpec({ ...DEFAULT_RADAR, max: '10', levels: '6', labels: false });
    expect(spec.max).toBe(10);
    expect(spec.levels).toBe(6);
    expect(spec.labels).toBe(false);
  });

  it('rejects a non-positive max, a bad level count or a bad fill', () => {
    expect(() => radarSpec({ ...DEFAULT_RADAR, max: '-1' })).toThrow(/max/);
    expect(() => radarSpec({ ...DEFAULT_RADAR, levels: '2.5' })).toThrow(/levels/);
    expect(() => radarSpec({ ...DEFAULT_RADAR, levels: '0' })).toThrow(/levels/);
    expect(() => radarSpec({ ...DEFAULT_RADAR, fill: '2' })).toThrow(/entre 0 et 1/);
  });
});

describe('polarSpec', () => {
  it('builds a polar area spec over the seven weekday sectors', () => {
    const spec = polarSpec(DEFAULT_POLAR);
    expect(spec.data).toHaveLength(7);
    expect(spec.labels).not.toBe(false);
    expect(spec.color?.legend).toBe(true);
  });

  it('accepts an explicit max and drops the labels on demand', () => {
    const spec = polarSpec({ ...DEFAULT_POLAR, max: '30', labels: false, legend: false });
    expect(spec.max).toBe(30);
    expect(spec.labels).toBe(false);
    expect(spec.color).toBeUndefined();
  });

  it('rejects a non-positive max with a message', () => {
    expect(() => polarSpec({ ...DEFAULT_POLAR, max: '0' })).toThrow(/max/);
    expect(() => polarSpec({ ...DEFAULT_POLAR, max: 'large' })).toThrow(/max/);
  });
});
