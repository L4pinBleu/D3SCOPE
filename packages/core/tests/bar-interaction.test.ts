// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderBarChart, type BarDatum } from '../src/charts/bar.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DATA: BarDatum[] = [
  { label: 'Jan', value: 10 },
  { label: 'Feb', value: 20 },
];
const OPTS = { width: 300, height: 200 };

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

function bar(svg: SVGSVGElement, i: number): SVGRectElement {
  const bars = svg.querySelectorAll<SVGRectElement>('rect.bar');
  const el: SVGRectElement | undefined = bars[i];
  if (!el) throw new Error(`no bar ${String(i)}`);
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('renderBarChart interactions', () => {
  it('has no tooltip and no click handler by default', () => {
    const svg = makeSvg();
    renderBarChart(svg, DATA, OPTS);
    bar(svg, 0).dispatchEvent(new MouseEvent('mouseenter'));
    expect(svg.querySelector('g.d3scope-tooltip')).toBeNull();
  });

  it('shows the SVG tooltip with the label and value on hover, and hides on leave', () => {
    const svg = makeSvg();
    renderBarChart(svg, DATA, { ...OPTS, tooltip: true });
    const group = svg.querySelector<SVGGElement>('g.d3scope-tooltip');

    bar(svg, 1).dispatchEvent(new MouseEvent('mouseenter', { clientX: 10, clientY: 10 }));
    expect(group?.style.display).toBe('');
    const texts = Array.from(group?.querySelectorAll('tspan') ?? []).map((t) => t.textContent);
    expect(texts).toEqual(['Feb', '20']);

    bar(svg, 1).dispatchEvent(new MouseEvent('mouseleave'));
    expect(group?.style.display).toBe('none');
  });

  it('uses a custom format callback', () => {
    const svg = makeSvg();
    renderBarChart(svg, DATA, {
      ...OPTS,
      tooltip: { format: (d) => ({ lines: [`${d.label}: ${d.value.toFixed(1)} €`] }) },
    });
    bar(svg, 0).dispatchEvent(new MouseEvent('mouseenter'));
    const text = svg.querySelector('g.d3scope-tooltip text')?.textContent;
    expect(text).toContain('Jan: 10.0 €');
  });

  it('reuses one tooltip group across redraws', () => {
    const svg = makeSvg();
    renderBarChart(svg, DATA, { ...OPTS, tooltip: true });
    renderBarChart(svg, DATA, { ...OPTS, tooltip: true });
    expect(svg.querySelectorAll('g.d3scope-tooltip')).toHaveLength(1);
  });

  it('removes the tooltip when it is turned off', () => {
    const svg = makeSvg();
    renderBarChart(svg, DATA, { ...OPTS, tooltip: true });
    renderBarChart(svg, DATA, OPTS);
    expect(svg.querySelector('g.d3scope-tooltip')).toBeNull();
  });

  it('calls onBarClick with the datum and the event', () => {
    const svg = makeSvg();
    const onBarClick = vi.fn();
    renderBarChart(svg, DATA, { ...OPTS, onBarClick });
    bar(svg, 0).dispatchEvent(new MouseEvent('click'));
    expect(onBarClick).toHaveBeenCalledOnce();
    const [datum, event] = onBarClick.mock.calls[0] as [BarDatum, MouseEvent];
    expect(datum).toEqual({ label: 'Jan', value: 10, color: '#4a9eed' });
    expect(event.type).toBe('click');
  });
});
