// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyTransform,
  createMark,
  defineMark,
  defineTransform,
  listMarks,
  listPlugins,
  listScales,
  listTransforms,
  PLUGIN_API_VERSION,
  PluginError,
  registerPlugin,
  unregisterPlugin,
} from '../src/plugin/index.js';
import { plot } from '../src/plot/plot.js';
import type { Mark, PlotScale } from '../src/plot/types.js';
import { scaleLinear } from 'd3-scale';

const SVG_NS = 'http://www.w3.org/2000/svg';
const makeSvg = (): SVGSVGElement => {
  const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
};

/** A mark that draws one circle per row at the x and y values. */
const dotMark = defineMark<{ x: number; y: number }, { r?: number }>((rows, options) => {
  const mark: Mark = {
    name: 'plugin-dots',
    xValues: () => rows.map((r) => r.x),
    yValues: () => rows.map((r) => r.y),
    render(ctx) {
      const layer = ctx.layer('plugin-dots');
      for (const r of rows) {
        const c = document.createElementNS(SVG_NS, 'circle');
        c.setAttribute('cx', String(ctx.x.position(r.x)));
        c.setAttribute('cy', String(ctx.y.position(r.y)));
        c.setAttribute('r', String(options.r ?? 3));
        c.setAttribute('class', 'd3s-plugin-dot');
        layer.appendChild(c);
      }
    },
  };
  return mark;
});

/** A linear scale with its direction reversed: larger values sit on the left. */
const reversedScale = (
  values: readonly (number | Date | string)[],
  range: readonly [number, number],
): PlotScale => {
  const nums = values.map(Number);
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const d3 = scaleLinear().domain([lo, hi]).range([range[1], range[0]]);
  return {
    kind: 'linear',
    d3,
    position: (v) => d3(Number(v)),
    bandwidth: () => 0,
    ticks: () => [lo, hi],
    domain: [lo, hi],
    range,
  };
};

const registered: string[] = [];
const register = (plugin: Parameters<typeof registerPlugin>[0]): void => {
  registerPlugin(plugin);
  registered.push(plugin.name);
};

afterEach(() => {
  for (const name of registered.splice(0)) unregisterPlugin(name);
  document.body.replaceChildren();
});

describe('Plugin API 1.1: marks', () => {
  it('reports API 1.2.0', () => {
    expect(PLUGIN_API_VERSION).toBe('1.2.0');
  });

  it('a plugin mark is created by name and drawn by plot()', () => {
    register({
      name: 'ext-marks',
      version: '1.0.0',
      apiVersion: '^1.0.0',
      marks: { 'plugin-dots': dotMark },
    });
    expect(listMarks()).toContain('plugin-dots');
    const mark = createMark(
      'plugin-dots',
      [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
      { r: 5 },
    );
    const svg = makeSvg();
    plot(svg, { width: 300, height: 200, marks: [mark] });
    const dots = svg.querySelectorAll('circle.d3s-plugin-dot');
    expect(dots).toHaveLength(2);
    expect(dots[0]?.getAttribute('r')).toBe('5');
  });

  it('createMark throws for an unknown name', () => {
    expect(() => createMark('no-such-mark', [], {})).toThrow(PluginError);
  });
});

describe('Plugin API 1.1: scales', () => {
  it('a registered scale name can be used as an axis type', () => {
    register({
      name: 'ext-scales',
      version: '1.0.0',
      apiVersion: '^1.0.0',
      scales: { reversed: (values, range) => reversedScale(values, range) },
    });
    expect(listScales()).toContain('reversed');
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      x: { type: 'reversed' },
      marks: [
        dotMark(
          [
            { x: 0, y: 1 },
            { x: 10, y: 1 },
          ],
          {},
        ),
      ],
    });
    expect(ctx.x.position(0)).toBeGreaterThan(ctx.x.position(10));
  });

  it('an unknown scale type is a clear error', () => {
    const svg = makeSvg();
    expect(() =>
      plot(svg, {
        width: 300,
        height: 200,
        x: { type: 'nope' },
        marks: [dotMark([{ x: 1, y: 1 }], {})],
      }),
    ).toThrow(RangeError);
  });

  it('built-in scale names cannot be taken by a plugin', () => {
    expect(() => {
      registerPlugin({
        name: 'ext-bad-scale',
        version: '1.0.0',
        apiVersion: '^1.0.0',
        scales: { linear: (values, range) => reversedScale(values, range) },
      });
    }).toThrow(/built-in scale type/);
    expect(listScales()).not.toContain('linear');
  });
});

describe('Plugin API 1.1: transforms', () => {
  it('a registered transform is applied by name', () => {
    register({
      name: 'ext-transforms',
      version: '1.0.0',
      apiVersion: '^1.0.0',
      transforms: {
        double: defineTransform<{ v: number }, { factor?: number }, { v: number }>(
          (rows, options) => rows.map((r) => ({ v: r.v * (options.factor ?? 2) })),
        ),
      },
    });
    expect(listTransforms()).toContain('double');
    expect(applyTransform('double', [{ v: 3 }], {})).toEqual([{ v: 6 }]);
    expect(applyTransform('double', [{ v: 3 }], { factor: 10 })).toEqual([{ v: 30 }]);
  });

  it('applyTransform throws for an unknown name', () => {
    expect(() => applyTransform('no-such-transform', [], {})).toThrow(PluginError);
  });
});

describe('Plugin API 1.1: registration rules', () => {
  it('a name taken by another plugin is refused, and nothing is registered', () => {
    register({
      name: 'ext-first',
      version: '1.0.0',
      apiVersion: '^1.0.0',
      marks: { shared: dotMark },
    });
    expect(() => {
      registerPlugin({
        name: 'ext-second',
        version: '1.0.0',
        apiVersion: '^1.0.0',
        marks: { 'second-only': dotMark, shared: dotMark },
      });
    }).toThrow(/already provided by "ext-first"/);
    // Atomic: the second plugin's other mark was not registered either.
    expect(listMarks()).not.toContain('second-only');
    expect(listMarks()).toContain('shared');
  });

  it('a non-function factory is refused', () => {
    expect(() => {
      registerPlugin({
        name: 'ext-not-fn',
        version: '1.0.0',
        apiVersion: '^1.0.0',
        transforms: {
          bad: 42 as unknown as (rows: readonly unknown[], options: unknown) => unknown[],
        },
      });
    }).toThrow(/must be a function/);
  });

  it('an invalid extension name is refused', () => {
    expect(() => {
      registerPlugin({
        name: 'ext-bad-name',
        version: '1.0.0',
        apiVersion: '^1.0.0',
        marks: { 'Bad Name': dotMark },
      });
    }).toThrow(/invalid mark name/);
  });

  it('unregisterPlugin removes its marks, scales and transforms', () => {
    register({
      name: 'ext-removable',
      version: '1.0.0',
      apiVersion: '^1.0.0',
      marks: { 'removable-mark': dotMark },
      scales: { 'removable-scale': (values, range) => reversedScale(values, range) },
      transforms: { 'removable-transform': (rows) => [...rows] },
    });
    unregisterPlugin('ext-removable');
    registered.splice(registered.indexOf('ext-removable'), 1);
    expect(listMarks()).not.toContain('removable-mark');
    expect(listScales()).not.toContain('removable-scale');
    expect(listTransforms()).not.toContain('removable-transform');
  });

  it('a plugin built for API 1.0 (^1.0.0) still registers', () => {
    register({ name: 'ext-old', version: '1.0.0', apiVersion: '^1.0.0' });
    expect(listPlugins()).toContain('ext-old');
  });
});
