// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportPng, serializeSvg, svgSize } from '../src/export/png.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg(attrs: Record<string, string> = { width: '200', height: '100' }): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, v);
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('width', '10');
  rect.setAttribute('height', '10');
  rect.setAttribute('fill', 'red');
  svg.appendChild(rect);
  document.body.appendChild(svg);
  return svg;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('svgSize', () => {
  it('reads width and height attributes first', () => {
    expect(svgSize(makeSvg({ width: '640', height: '480' }))).toEqual({ width: 640, height: 480 });
  });

  it('falls back to the viewBox', () => {
    expect(svgSize(makeSvg({ viewBox: '0 0 320 240' }))).toEqual({ width: 320, height: 240 });
  });

  it('falls back to 300x150 when nothing is set', () => {
    expect(svgSize(makeSvg({}))).toEqual({ width: 300, height: 150 });
  });
});

describe('serializeSvg', () => {
  it('produces a standalone SVG document with namespace and size', () => {
    const out = serializeSvg(makeSvg());
    expect(out).toContain(`xmlns="${SVG_NS}"`);
    expect(out).toContain('width="200"');
    expect(out).toContain('height="100"');
    expect(out).toContain('<rect');
  });

  it('inlines presentation styles on the clone', () => {
    const svg = makeSvg();
    // jsdom does not cascade presentation styles, so stub the computed style.
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      () =>
        ({
          getPropertyValue: (p: string) => (p === 'fill' ? 'rgb(255, 0, 0)' : ''),
        }) as unknown as CSSStyleDeclaration,
    );
    const out = serializeSvg(svg);
    expect(out).toMatch(/<rect[^>]*style="[^"]*fill: rgb\(255, 0, 0\)/);
  });

  it('does not modify the live element', () => {
    const svg = makeSvg();
    serializeSvg(svg);
    expect(svg.hasAttribute('xmlns')).toBe(false);
    expect(svg.querySelector('rect')?.getAttribute('style')).toBeNull();
  });
});

describe('exportPng', () => {
  function stubBrowser(fillCalls: string[]) {
    const drawImage = vi.fn();
    const fillRect = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage,
        fillRect,
        set fillStyle(v: string) {
          fillCalls.push(v);
        },
      }),
      toBlob: (cb: (b: Blob | null) => void) => {
        cb(new Blob(['png'], { type: 'image/png' }));
      },
    };
    vi.spyOn(document, 'createElement').mockImplementation(() => canvas as unknown as HTMLElement);
    vi.stubGlobal(
      'Image',
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_v: string) {
          queueMicrotask(() => {
            this.onload?.();
          });
        }
      },
    );
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });
    return { canvas, drawImage, fillRect };
  }

  it('returns a PNG blob at the requested scale', async () => {
    const fills: string[] = [];
    const { canvas, drawImage } = stubBrowser(fills);
    const blob = await exportPng(makeSvg(), { scale: 3 });
    expect(blob.type).toBe('image/png');
    expect(canvas.width).toBe(600);
    expect(canvas.height).toBe(300);
    expect(drawImage).toHaveBeenCalledOnce();
  });

  it('paints the default white background', async () => {
    const fills: string[] = [];
    stubBrowser(fills);
    await exportPng(makeSvg());
    expect(fills).toContain('#ffffff');
  });

  it('skips the background when transparent', async () => {
    const fills: string[] = [];
    const { fillRect } = stubBrowser(fills);
    await exportPng(makeSvg(), { background: 'transparent' });
    expect(fillRect).not.toHaveBeenCalled();
  });

  it('rejects when the SVG cannot be rasterized', async () => {
    vi.stubGlobal(
      'Image',
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_v: string) {
          queueMicrotask(() => {
            this.onerror?.();
          });
        }
      },
    );
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() });
    await expect(exportPng(makeSvg())).rejects.toThrow('failed to rasterize');
  });
});
