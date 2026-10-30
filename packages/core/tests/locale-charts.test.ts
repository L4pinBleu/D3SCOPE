// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderBarChart } from '../src/charts/bar.js';
import { renderLineChart } from '../src/charts/line.js';
import { renderPieChart } from '../src/charts/pie.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

function tooltipText(svg: SVGSVGElement): string {
  return svg.querySelector('g.d3scope-tooltip')?.textContent ?? '';
}

describe('chart locale option', () => {
  it('formats the bar tooltip value in the chart locale', () => {
    const svg = makeSvg();
    renderBarChart(svg, [{ label: 'A', value: 1234.5 }], {
      width: 200,
      height: 100,
      tooltip: true,
      locale: 'en-US',
    });
    svg.querySelector('rect.bar')?.dispatchEvent(new MouseEvent('mouseenter'));
    expect(tooltipText(svg)).toContain('1,234.5');
  });

  it('formats the pie tooltip share in the chart locale', () => {
    const svg = makeSvg();
    renderPieChart(
      svg,
      [
        { label: 'A', value: 1 },
        { label: 'B', value: 1 },
      ],
      {
        width: 200,
        height: 200,
        tooltip: true,
        locale: 'en-US',
      },
    );
    svg.querySelector('path.slice')?.dispatchEvent(new MouseEvent('mouseenter'));
    expect(tooltipText(svg)).toContain('(50.0%)');
  });

  it('formats the line tooltip date in the chart locale', () => {
    const svg = makeSvg();
    renderLineChart(svg, [{ date: new Date(2026, 0, 3), value: 2 }], {
      width: 200,
      height: 100,
      tooltip: true,
      locale: 'en-US',
    });
    svg.querySelector('rect.overlay')?.dispatchEvent(new MouseEvent('mousemove'));
    expect(tooltipText(svg)).toContain('1/3/2026');
  });
});
