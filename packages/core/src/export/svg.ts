/**
 * SVG export (PLAN.md §5): the chart's SVG serialized with its computed
 * presentation styles, as a standalone document. Shares `serializeSvg` with the
 * PNG export, so both outputs match.
 */
import { serializeSvg } from './png.js';

/** The chart as an SVG `Blob`, ready to download or embed. */
export function exportSvg(svg: SVGSVGElement): Blob {
  return new Blob([serializeSvg(svg)], { type: 'image/svg+xml;charset=utf-8' });
}

/** Export and trigger a browser download of the SVG file. */
export function downloadSvg(svg: SVGSVGElement, filename = 'chart.svg'): void {
  const url = URL.createObjectURL(exportSvg(svg));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
