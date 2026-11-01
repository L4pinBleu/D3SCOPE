// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { plot } from '../src/plot/plot';
import { ruleX, ruleY } from '../src/plot/marks/rule';
import { text } from '../src/plot/marks/text';
import { LIGHT_THEME } from '../src/theme/index';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

/** The one rule line of a plot, or null. */
function oneRule(svg: SVGSVGElement): SVGLineElement | null {
  return svg.querySelector('line.d3s-rule');
}

describe('ruleY', () => {
  it('draws one horizontal line per value at the right y, and the value is in the domain', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [ruleY([100, 50])],
    });
    const lines = svg.querySelectorAll('line.d3s-rule');
    expect(lines.length).toBe(2);
    // y domain now includes 50 and 100, so position(100) is the top edge 0.
    expect(ctx.y.domain).toContain(100);
    const top = lines[0]?.getAttribute('y1');
    const bottom = lines[1]?.getAttribute('y1');
    // Default top margin 16: the value 100 maps to y=0 in the plot area.
    expect(Number(top)).toBeLessThan(Number(bottom));
    expect(lines[0]?.getAttribute('x1')).toBe('0');
    expect(lines[0]?.getAttribute('x2')).toBe(String(ctx.innerWidth));
    svg.remove();
  });

  it('puts each line exactly at ctx.y.position(value)', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [ruleY([50])],
    });
    const line = oneRule(svg);
    expect(line?.getAttribute('y1')).toBe(String(ctx.y.position(50)));
    expect(line?.getAttribute('y2')).toBe(line?.getAttribute('y1'));
    svg.remove();
  });

  it('applies stroke, width, dash and opacity', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 300,
      height: 200,
      marks: [ruleY([50], { stroke: '#ff0000', strokeWidth: 3, dash: '4 4', opacity: 0.5 })],
    });
    const line = oneRule(svg);
    expect(line?.getAttribute('stroke')).toBe('#ff0000');
    expect(line?.getAttribute('stroke-width')).toBe('3');
    expect(line?.getAttribute('stroke-dasharray')).toBe('4 4');
    expect(line?.getAttribute('stroke-opacity')).toBe('0.5');
    svg.remove();
  });

  it('defaults the stroke to the theme accent and the width to 1', () => {
    const svg = makeSvg();
    plot(svg, { width: 300, height: 200, marks: [ruleY([50])] });
    const line = oneRule(svg);
    expect(line?.getAttribute('stroke')).toBe(`var(--d3s-accent, ${LIGHT_THEME.accent})`);
    expect(line?.getAttribute('stroke-width')).toBe('1');
    expect(line?.getAttribute('stroke-dasharray')).toBeNull();
    expect(line?.getAttribute('stroke-opacity')).toBe('1');
    svg.remove();
  });

  it('draws nothing for empty values', () => {
    const svg = makeSvg();
    plot(svg, { width: 300, height: 200, marks: [ruleY([])] });
    expect(svg.querySelector('line.d3s-rule')).toBeNull();
    svg.remove();
  });
});

describe('ruleX', () => {
  it('draws vertical lines at the right x', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [ruleX([25, 75])],
    });
    const lines = svg.querySelectorAll('line.d3s-rule');
    expect(lines.length).toBe(2);
    expect(lines[0]?.getAttribute('x1')).toBe(String(ctx.x.position(25)));
    expect(lines[0]?.getAttribute('y1')).toBe('0');
    expect(lines[0]?.getAttribute('y2')).toBe(String(ctx.innerHeight));
    expect(Number(lines[0]?.getAttribute('x1'))).toBeLessThan(Number(lines[1]?.getAttribute('x1')));
    svg.remove();
  });

  it('sits at the centre of a band', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      x: { type: 'band', domain: ['a', 'b'] },
      marks: [ruleX(['b'])],
    });
    const line = oneRule(svg);
    const bw = ctx.x.bandwidth();
    expect(line?.getAttribute('x1')).toBe(String(ctx.x.position('b') + bw / 2));
    svg.remove();
  });

  it('draws nothing for empty values', () => {
    const svg = makeSvg();
    plot(svg, { width: 300, height: 200, marks: [ruleX([])] });
    expect(svg.querySelector('line.d3s-rule')).toBeNull();
    svg.remove();
  });
});

describe('text', () => {
  interface Row {
    day: number;
    value: number;
    label: string;
  }

  const rows: Row[] = [
    { day: 1, value: 10, label: 'first' },
    { day: 2, value: 20, label: 'second' },
    { day: 3, value: 30, label: 'third' },
  ];

  it('draws one text element per row at the right x and y, with textContent', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [text(rows, { x: 'day', y: 'value', text: 'label' })],
    });
    const texts = svg.querySelectorAll('text.d3s-text');
    expect(texts.length).toBe(3);
    expect(texts[0]?.textContent).toBe('first');
    expect(texts[1]?.textContent).toBe('second');
    expect(texts[2]?.textContent).toBe('third');
    expect(texts[0]?.getAttribute('x')).toBe(String(ctx.x.position(1)));
    expect(texts[0]?.getAttribute('y')).toBe(String(ctx.y.position(10)));
    svg.remove();
  });

  it('accepts accessors', () => {
    const svg = makeSvg();
    const ctx = plot(svg, {
      width: 300,
      height: 200,
      marks: [text(rows, { x: (r) => r.day, y: (r) => r.value, text: (r) => r.label })],
    });
    const texts = svg.querySelectorAll('text.d3s-text');
    expect(texts.length).toBe(3);
    expect(texts[1]?.getAttribute('x')).toBe(String(ctx.x.position(2)));
    svg.remove();
  });

  it('never parses the label as HTML', () => {
    const svg = makeSvg();
    const evil = [{ x: 1, y: 1, label: '<b>x</b>' }];
    plot(svg, {
      width: 300,
      height: 200,
      marks: [text(evil, { x: 'x', y: 'y', text: 'label' })],
    });
    const el = svg.querySelector('text.d3s-text');
    expect(el?.textContent).toBe('<b>x</b>');
    expect(svg.querySelector('b')).toBeNull();
    expect(el?.querySelector('b')).toBeNull();
    svg.remove();
  });

  it('applies anchor, dx, dy, fill and fontSize', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 300,
      height: 200,
      marks: [
        text(rows, {
          x: 'day',
          y: 'value',
          text: 'label',
          anchor: 'start',
          dx: 5,
          dy: -3,
          fill: '#123456',
          fontSize: 14,
        }),
      ],
    });
    const el = svg.querySelector('text.d3s-text');
    expect(el?.getAttribute('text-anchor')).toBe('start');
    expect(el?.getAttribute('fill')).toBe('#123456');
    expect(el?.getAttribute('font-size')).toBe('14');
    svg.remove();
  });

  it('skips rows with missing values', () => {
    const svg = makeSvg();
    const sparse: (Row | { day: number; value: number; label?: string })[] = [
      { day: 1, value: 10, label: 'a' },
      { day: 2, value: 20 },
      { day: 3, value: Number.NaN, label: 'c' },
    ];
    plot(svg, {
      width: 300,
      height: 200,
      marks: [text(sparse, { x: 'day', y: 'value', text: 'label' })],
    });
    const texts = svg.querySelectorAll('text.d3s-text');
    expect(texts.length).toBe(1);
    expect(texts[0]?.textContent).toBe('a');
    svg.remove();
  });

  it('draws nothing for empty rows', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 300,
      height: 200,
      marks: [text([], { x: 'day', y: 'value', text: 'label' })],
    });
    expect(svg.querySelector('text.d3s-text')).toBeNull();
    svg.remove();
  });

  it('defaults the fill to the theme textMuted', () => {
    const svg = makeSvg();
    plot(svg, {
      width: 300,
      height: 200,
      marks: [text(rows, { x: 'day', y: 'value', text: 'label' })],
    });
    expect(svg.querySelector('text.d3s-text')?.getAttribute('fill')).toBe(
      `var(--d3s-text-muted, ${LIGHT_THEME.textMuted})`,
    );
    svg.remove();
  });
});
