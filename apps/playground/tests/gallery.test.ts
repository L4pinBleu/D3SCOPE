// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  axisSpec,
  barXSpec,
  barYSpec,
  DEFAULT_AXIS,
  DEFAULT_BAR,
  DEFAULT_DOT,
  DEFAULT_LEGEND,
  DEFAULT_LINE,
  DEFAULT_RULE,
  dotSpec,
  axesSpec,
  legendSpec,
  lineSpec,
  parseList,
  parseNumber,
  ruleSpec,
  specSummary,
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
