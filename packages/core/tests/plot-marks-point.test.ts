// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { plot } from '../src/plot/plot.js';
import { dot } from '../src/plot/marks/point.js';
import { ruleX, ruleY } from '../src/plot/marks/rule.js';
import { text } from '../src/plot/marks/text.js';
import { LIGHT_THEME } from '../src/theme/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

interface Pt {
  x: number;
  y: number;
  label?: string;
}

const pts: Pt[] = [
  { x: 0, y: 0, label: 'a' },
  { x: 5, y: 5, label: 'b' },
  { x: 10, y: 10, label: 'c' },
];

/** Plot with a fixed domain 0..10 on both axes, nice off. */
function draw(marks: Parameters<typeof plot>[1]['marks']): SVGSVGElement {
  const svg = document.createElementNS<'svg'>(SVG_NS, 'svg');
  document.body.appendChild(svg);
  plot(svg, {
    width: 200,
    height: 100,
    x: { min: 0, max: 10, nice: false },
    y: { min: 0, max: 10, nice: false },
    marks,
  });
  return svg;
}

describe('dot', () => {
  it('draws one circle per datum at the right cx and cy', () => {
    const svg = draw([dot(pts, { x: 'x', y: 'y' })]);
    const circles = svg.querySelectorAll('circle.d3s-dot');
    expect(circles).toHaveLength(3);
    const first = circles[0] as SVGElement;
    expect(first.getAttribute('cx')).toBe('0');
    expect(first.getAttribute('cy')).toBe('56');
    const last = circles[2] as SVGElement;
    expect(last.getAttribute('cx')).toBe('144');
    expect(last.getAttribute('cy')).toBe('0');
  });

  it('gives a per-datum radius with an r accessor', () => {
    const svg = draw([dot(pts, { x: 'x', y: 'y', r: (d) => d.x / 2 })]);
    const radii = [...svg.querySelectorAll('circle.d3s-dot')].map((c) =>
      Number(c.getAttribute('r')),
    );
    expect(radii).toEqual([0, 2.5, 5]);
  });

  it('turns a negative radius into 0', () => {
    const svg = draw([dot(pts, { x: 'x', y: 'y', r: () => -4 })]);
    for (const c of svg.querySelectorAll('circle.d3s-dot')) {
      expect(c.getAttribute('r')).toBe('0');
    }
  });

  it('skips a datum whose y is NaN', () => {
    const data: Pt[] = [
      { x: 1, y: 2 },
      { x: 2, y: Number.NaN },
    ];
    const svg = draw([dot(data, { x: 'x', y: 'y' })]);
    expect(svg.querySelectorAll('circle.d3s-dot')).toHaveLength(1);
  });

  it('colours with an accessor through a stable colorScale on the mark', () => {
    const mark = dot(pts, { x: 'x', y: 'y', fill: 'label' });
    const scale = (mark as { colorScale?: (l: string) => string }).colorScale;
    expect(scale).toBeTypeOf('function');
    const a = scale?.('a');
    const b = scale?.('b');
    expect(a).toMatch(/^#/);
    expect(b).toMatch(/^#/);
    expect(a).not.toBe(b);
    expect(scale?.('a')).toBe(scale?.('a'));
    const svg = draw([mark]);
    const fills = [...svg.querySelectorAll('circle.d3s-dot')].map((c) => c.getAttribute('fill'));
    expect(new Set(fills).size).toBe(3);
  });

  it('uses one string fill for every dot, and the accent by default', () => {
    const s1 = draw([dot(pts, { x: 'x', y: 'y', fill: '#ff0000' })]);
    for (const c of s1.querySelectorAll('circle.d3s-dot')) {
      expect(c.getAttribute('fill')).toBe('#ff0000');
    }
    const s2 = draw([dot(pts, { x: 'x', y: 'y' })]);
    for (const c of s2.querySelectorAll('circle.d3s-dot')) {
      expect(c.getAttribute('fill')).toBe(`var(--d3s-accent, ${LIGHT_THEME.accent})`);
    }
  });
});

describe('ruleX', () => {
  it('draws a vertical line at the x position, full inner height', () => {
    const svg = draw([ruleX([{ x: 2.5 }], { x: 'x' })]);
    const lines = svg.querySelectorAll('line.d3s-rule');
    expect(lines).toHaveLength(1);
    const line = lines[0] as SVGLineElement;
    expect(line.getAttribute('x1')).toBe(line.getAttribute('x2'));
    expect(Number(line.getAttribute('x1'))).toBeCloseTo(36);
    expect(line.getAttribute('y1')).toBe('0');
    expect(line.getAttribute('y2')).toBe('56');
  });

  it('defaults the stroke to the muted text colour', () => {
    const svg = draw([ruleX([{ x: 5 }], { x: 'x' })]);
    expect(svg.querySelector('line.d3s-rule')?.getAttribute('stroke')).toBe(
      `var(--d3s-text-muted, ${LIGHT_THEME.textMuted})`,
    );
  });

  it('skips a non-finite position', () => {
    const svg = draw([ruleX([{ x: Number.NaN }], { x: 'x' })]);
    expect(svg.querySelectorAll('line.d3s-rule')).toHaveLength(0);
  });
});

describe('ruleY', () => {
  it('draws a horizontal line at the y position, full inner width', () => {
    const svg = draw([ruleY([{ y: 7.5 }], { y: 'y' })]);
    const lines = svg.querySelectorAll('line.d3s-rule');
    expect(lines).toHaveLength(1);
    const line = lines[0] as SVGLineElement;
    expect(Number(line.getAttribute('y1'))).toBe(Number(line.getAttribute('y2')));
    expect(Number(line.getAttribute('y1'))).toBeCloseTo(14);
    expect(line.getAttribute('x1')).toBe('0');
    expect(line.getAttribute('x2')).toBe('144');
  });
});

describe('text', () => {
  it('puts its content in textContent, not markup', () => {
    const svg = draw([text([{ x: 5, y: 5 }], { x: 'x', y: 'y', text: () => '<b>hi</b>' })]);

    const el = svg.querySelector('text.d3s-text');
    expect(el).not.toBeNull();
    expect(el?.textContent).toBe('<b>hi</b>');
    expect(el?.querySelector('b')).toBeNull();
  });

  it('applies the anchor and the dy offset', () => {
    const svg = draw([text(pts, { x: 'x', y: 'y', text: 'label', anchor: 'start', dy: -12 })]);

    const first = svg.querySelector('text.d3s-text');
    expect(first?.getAttribute('text-anchor')).toBe('start');
    expect(first?.getAttribute('dy')).toBe('-12');
  });

  it('defaults to middle anchor and dy -6', () => {
    const svg = draw([text(pts, { x: 'x', y: 'y', text: 'label' })]);

    const first = svg.querySelector('text.d3s-text');
    expect(first?.getAttribute('text-anchor')).toBe('middle');
    expect(first?.getAttribute('dy')).toBe('-6');
  });
});

describe('empty data', () => {
  it('draws nothing and does not throw', () => {
    const svg = draw([
      dot([], { x: 'x', y: 'y' }),
      ruleX([], { x: 'x' }),
      ruleY([], { y: 'y' }),
      text([], { x: 'x', y: 'y', text: 'label' }),
    ]);
    expect(svg.querySelectorAll('circle.d3s-dot')).toHaveLength(0);
    expect(svg.querySelectorAll('line.d3s-rule')).toHaveLength(0);
    expect(svg.querySelectorAll('text.d3s-text')).toHaveLength(0);
  });
});
