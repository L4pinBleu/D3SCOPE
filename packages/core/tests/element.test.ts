// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import {
  defineChartElement,
  D3ScopeChartElement,
  CHART_ELEMENT_NAME,
} from '../src/element/index.js';
import { registerPlugin, unregisterPlugin } from '../src/plugin/index.js';

beforeAll(() => {
  defineChartElement();
});

function make(attrs: Record<string, string>, data?: unknown): D3ScopeChartElement {
  const el = document.createElement(CHART_ELEMENT_NAME) as D3ScopeChartElement;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (data !== undefined) el.data = data;
  document.body.appendChild(el);
  return el;
}

function shadow(el: D3ScopeChartElement): ShadowRoot {
  if (!el.shadowRoot) throw new Error('no shadow root');
  return el.shadowRoot;
}

describe('defineChartElement', () => {
  it('registers the element once and is safe to call again', () => {
    expect(customElements.get(CHART_ELEMENT_NAME)).toBe(D3ScopeChartElement);
    expect(() => {
      defineChartElement();
    }).not.toThrow();
  });
});

describe('<d3scope-chart>', () => {
  it('draws a bar chart from the data attribute', () => {
    const el = make({ type: 'bar', data: '[{"label":"Jan","value":3},{"label":"Fév","value":5}]' });
    expect(shadow(el).querySelectorAll('rect.bar')).toHaveLength(2);
    el.remove();
  });

  it('prefers the data property over the attribute and redraws on set', () => {
    const el = make({ type: 'bar', data: '[{"label":"A","value":1}]' });
    el.data = [
      { label: 'X', value: 1 },
      { label: 'Y', value: 2 },
      { label: 'Z', value: 3 },
    ];
    expect(shadow(el).querySelectorAll('rect.bar')).toHaveLength(3);
    el.remove();
  });

  it('turns date strings into dates for a line chart', () => {
    const el = make({ type: 'line', width: '300', height: '150' }, [
      { date: '2026-01-01', value: 1 },
      { date: '2026-01-05', value: 4 },
    ]);
    expect(shadow(el).querySelector('path.line')).not.toBeNull();
    el.remove();
  });

  it('adds an area for type="area"', () => {
    const el = make({ type: 'area' }, [
      { date: '2026-01-01', value: 1 },
      { date: '2026-01-02', value: 2 },
    ]);
    expect(shadow(el).querySelector('path.area')).not.toBeNull();
    el.remove();
  });

  it('draws a donut (annular slices) for type="donut"', () => {
    const el = make({ type: 'donut' }, [
      { label: 'A', value: 1 },
      { label: 'B', value: 1 },
    ]);
    expect(shadow(el).querySelector('path.slice')?.getAttribute('d')).not.toMatch(/^M0,0/);
    el.remove();
  });

  it('draws a sparkline from numbers or {value} objects', () => {
    const el = make({ type: 'sparkline' }, [1, { value: 3 }, 2]);
    expect(shadow(el).querySelector('path.line')).not.toBeNull();
    el.remove();
  });

  it('redraws when an attribute changes', () => {
    const el = make({ type: 'bar' }, [{ label: 'A', value: 1 }]);
    expect(shadow(el).querySelector('rect.bar')).not.toBeNull();
    el.setAttribute('type', 'pie');
    expect(shadow(el).querySelector('rect.bar')).toBeNull();
    expect(shadow(el).querySelector('path.slice')).not.toBeNull();
    el.remove();
  });

  it('shows an error inside the element for invalid JSON, not a throw', () => {
    const el = make({ type: 'bar', data: '[{' });
    const alert = shadow(el).querySelector('[role="alert"]');
    expect(alert?.textContent).toMatch(/not valid JSON/);
    el.remove();
  });

  it('shows an error for an unknown chart type', () => {
    const el = make({ type: 'nope' }, [{ label: 'A', value: 1 }]);
    expect(shadow(el).querySelector('[role="alert"]')?.textContent).toMatch(
      /unknown chart type "nope"/,
    );
    el.remove();
  });

  it('shows an error for a bad date or non-array data', () => {
    const bad = make({ type: 'line' }, [{ date: 'not a date', value: 1 }]);
    expect(shadow(bad).querySelector('[role="alert"]')?.textContent).toMatch(/invalid date/);
    bad.remove();
    const notArray = make({ type: 'bar' }, { label: 'A' });
    expect(shadow(notArray).querySelector('[role="alert"]')?.textContent).toMatch(
      /must be an array/,
    );
    notArray.remove();
  });

  it('draws nothing when there is no data', () => {
    const el = make({ type: 'bar' });
    expect(shadow(el).querySelector('svg')).toBeNull();
    expect(shadow(el).querySelector('[role="alert"]')).toBeNull();
    el.remove();
  });

  it('does not draw before it is connected', () => {
    const el = document.createElement(CHART_ELEMENT_NAME) as D3ScopeChartElement;
    el.setAttribute('type', 'bar');
    el.data = [{ label: 'A', value: 1 }];
    expect(el.shadowRoot?.querySelector('svg')).toBeNull();
    document.body.appendChild(el);
    expect(el.shadowRoot?.querySelector('rect.bar')).not.toBeNull();
    el.remove();
  });

  it('applies a registered theme to the host', () => {
    const el = make({ type: 'bar', theme: 'default' }, [{ label: 'A', value: 1 }]);
    expect(el.style.getPropertyValue('--d3s-surface')).toBe('#ffffff');
    el.remove();
  });

  it('shows an error for an unknown theme', () => {
    const el = make({ type: 'bar', theme: 'missing' }, [{ label: 'A', value: 1 }]);
    expect(shadow(el).querySelector('[role="alert"]')?.textContent).toMatch(/unknown theme/);
    el.remove();
  });

  it('draws a chart type registered by a plugin', () => {
    registerPlugin({
      name: 'element-demo-plugin',
      version: '1.0.0',
      apiVersion: '^1.0.0',
      charts: {
        'element-dots': {
          render(svg, data) {
            const rows = data as { x: number }[];
            svg.replaceChildren(
              ...rows.map((r) => {
                const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                c.setAttribute('cx', String(r.x));
                return c;
              }),
            );
          },
        },
      },
    });
    try {
      const el = make({ type: 'element-dots' }, [{ x: 1 }, { x: 2 }]);
      expect(shadow(el).querySelectorAll('circle')).toHaveLength(2);
      el.remove();
    } finally {
      unregisterPlugin('element-demo-plugin');
    }
  });
});
