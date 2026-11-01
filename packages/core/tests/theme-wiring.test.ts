// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderAxis } from '../src/axes/index.js';
import { renderBarChart } from '../src/charts/bar.js';
import { renderLineChart } from '../src/charts/line.js';
import { PIE_PALETTE } from '../src/charts/pie.js';
import { renderCategoricalLegend } from '../src/legends/index.js';
import { linearScale } from '../src/scales/index.js';
import { LIGHT_THEME } from '../src/theme/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

describe('theme wiring', () => {
  it('reads the chart defaults from the light theme', () => {
    expect(PIE_PALETTE).toEqual(LIGHT_THEME.palette);
    const svg = makeSvg();
    renderBarChart(svg, [{ label: 'A', value: 1 }], { width: 100, height: 100 });
    expect(svg.querySelector('rect.bar')?.getAttribute('fill')).toBe(LIGHT_THEME.accent);
  });

  it('colours axes through the textMuted token', () => {
    const svg = makeSvg();
    const group = document.createElementNS(SVG_NS, 'g');
    svg.appendChild(group);
    renderAxis(group, linearScale([0, 10], [100, 0]), { orientation: 'left' });
    expect(group.style.color).toContain('var(--d3s-text-muted');
    expect(group.style.fontFamily).toContain('var(--d3s-font-family');
  });

  it('colours legend labels through the text token', () => {
    const svg = makeSvg();
    const group = document.createElementNS(SVG_NS, 'g');
    svg.appendChild(group);
    renderCategoricalLegend(group, [{ label: 'A', color: '#000' }], {});
    const text = group.querySelector<SVGTextElement>('text');
    expect(text?.style.fill).toContain('var(--d3s-text');
  });

  it('styles the crosshair through theme tokens', () => {
    const svg = makeSvg();
    renderLineChart(
      svg,
      [
        { date: new Date(2026, 0, 1), value: 1 },
        { date: new Date(2026, 0, 2), value: 2 },
      ],
      { width: 200, height: 100, tooltip: true },
    );
    expect(svg.querySelector<SVGLineElement>('g.crosshair line')?.style.stroke).toContain(
      'var(--d3s-text-muted',
    );
    expect(svg.querySelector<SVGCircleElement>('g.crosshair circle')?.style.fill).toContain(
      'var(--d3s-surface',
    );
  });
});
