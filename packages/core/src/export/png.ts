/**
 * PNG export (PLAN.md §5): serialize the chart's SVG, draw it on a `<canvas>`,
 * then `canvas.toBlob()`. No dependency: the browser does the rasterization.
 *
 * `serializeSvg` is pure DOM work and is unit-tested directly. `exportPng` needs
 * `Image`, `canvas` and object URLs, which only exist in a browser.
 */

export interface PngExportOptions {
  /** Pixel ratio of the output image. Default: 2. */
  scale?: number;
  /** Background fill behind the chart. Default: `#ffffff`. Use `'transparent'` to skip it. */
  background?: string;
}

/**
 * Presentation properties copied from computed style onto each element, so the
 * serialized SVG renders the same outside the page (no page CSS, no web fonts).
 */
const INLINED_PROPERTIES = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-dasharray',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
  'dominant-baseline',
  'visibility',
] as const;

/** Size in px of an SVG root: `width`/`height` attributes, then `viewBox`, then 300×150. */
export function svgSize(svg: SVGSVGElement): { width: number; height: number } {
  const width = Number.parseFloat(svg.getAttribute('width') ?? '');
  const height = Number.parseFloat(svg.getAttribute('height') ?? '');
  if (width > 0 && height > 0) return { width, height };

  const viewBox = (svg.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
  const [, , vbWidth, vbHeight] = viewBox;
  if (vbWidth !== undefined && vbHeight !== undefined && vbWidth > 0 && vbHeight > 0) {
    return { width: vbWidth, height: vbHeight };
  }
  return { width: 300, height: 150 };
}

/**
 * Serialize an SVG element to a standalone SVG document string.
 *
 * The clone gets the SVG namespace, explicit `width`/`height`, and the computed
 * presentation properties listed in `INLINED_PROPERTIES` written to its `style`.
 * The live element is not modified.
 */
export function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const { width, height } = svgSize(svg);

  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));

  const sourceNodes = [svg, ...Array.from(svg.querySelectorAll<SVGElement>('*'))];
  const cloneNodes = [clone, ...Array.from(clone.querySelectorAll<SVGElement>('*'))];
  const view = svg.ownerDocument.defaultView;

  if (view) {
    sourceNodes.forEach((source, i) => {
      const target = cloneNodes[i];
      if (!target) return;
      const computed = view.getComputedStyle(source);
      for (const prop of INLINED_PROPERTIES) {
        const value = computed.getPropertyValue(prop);
        if (value) target.style.setProperty(prop, value);
      }
    });
  }

  return new XMLSerializer().serializeToString(clone);
}

/** Render an SVG element to a PNG `Blob` in the browser. */
export async function exportPng(svg: SVGSVGElement, options: PngExportOptions = {}): Promise<Blob> {
  const scale = options.scale ?? 2;
  const background = options.background ?? '#ffffff';
  const { width, height } = svgSize(svg);

  const svgBlob = new Blob([serializeSvg(svg)], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = await loadImage(url);

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('D3SCOPE export: 2D canvas context is not available');

    if (background !== 'transparent') {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await canvasToPng(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Export and trigger a browser download of the PNG. */
export async function downloadPng(
  svg: SVGSVGElement,
  filename = 'chart.png',
  options: PngExportOptions = {},
): Promise<void> {
  const blob = await exportPng(svg, options);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error('D3SCOPE export: failed to rasterize the SVG'));
    };
    image.src = url;
  });
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('D3SCOPE export: canvas produced no PNG data'));
    }, 'image/png');
  });
}
