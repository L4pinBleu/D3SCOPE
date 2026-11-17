// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
// A plugin imports only from the plugin entry (LICENSE-EXCEPTION.md section 1).
import { plot, rangeY, rectY, type PlotSpec } from '../src/plugin/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

describe('plugin entry re-exports the plot model', () => {
  it('draws a bar chart with plot() and rectY, importing only from the plugin entry', () => {
    const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
    document.body.appendChild(svg);
    const rows = [
      { c: 'a', v: 2 },
      { c: 'b', v: 5 },
      { c: 'c', v: 3 },
    ];
    const spec: PlotSpec = {
      width: 300,
      height: 200,
      marks: [rectY(rows, { x: 'c', y: 'v' })],
    };
    plot(svg, spec);
    expect(svg.querySelectorAll('rect.d3s-bar')).toHaveLength(3);
    svg.remove();
  });
});

describe('plugin entry re-exports the range marks', () => {
  it('draws a specification band with rangeY, importing only from the plugin entry', () => {
    const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
    document.body.appendChild(svg);
    plot(svg, {
      width: 300,
      height: 200,
      marks: [
        rangeY([{ lo: 2, hi: 4, label: 'gabarit' }], {
          from: 'lo',
          to: 'hi',
          label: 'label',
        }),
      ],
    });
    expect(svg.querySelectorAll('rect.d3s-range')).toHaveLength(1);
    expect(svg.querySelector('text.d3s-range-label')?.textContent).toBe('gabarit');
    svg.remove();
  });
});
