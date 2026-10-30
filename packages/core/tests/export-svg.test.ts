// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadSvg, exportSvg } from '../src/export/svg.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '120');
  svg.setAttribute('height', '60');
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('width', '10');
  rect.setAttribute('height', '10');
  svg.appendChild(rect);
  document.body.appendChild(svg);
  return svg;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('exportSvg', () => {
  it('returns an SVG blob with the chart markup', async () => {
    const blob = exportSvg(makeSvg());
    expect(blob.type).toBe('image/svg+xml;charset=utf-8');
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(typeof reader.result === 'string' ? reader.result : '');
      };
      reader.readAsText(blob);
    });
    expect(text).toContain('<svg');
    expect(text).toContain('width="120"');
    expect(text).toContain('<rect');
  });
});

describe('downloadSvg', () => {
  it('creates an object URL, clicks a link with the filename, then revokes the URL', () => {
    const createObjectURL = vi.fn(() => 'blob:svg');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    downloadSvg(makeSvg(), 'portfolio.svg');

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:svg');
  });

  it('uses chart.svg as the default filename', () => {
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() });
    let download = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      download = this.download;
    });
    downloadSvg(makeSvg());
    expect(download).toBe('chart.svg');
  });
});
