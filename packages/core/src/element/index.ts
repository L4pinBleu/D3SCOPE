/**
 * `<d3scope-chart>` custom element (PLAN.md §4, polish). A chart you can write in HTML:
 *
 *   <d3scope-chart type="bar" width="480" height="280" tooltip locale="fr-FR"
 *     data='[{"label":"Jan","value":12}]'></d3scope-chart>
 *
 * Data can also be set as a property: `el.data = [...]`. Built-in types are bar,
 * line, area, pie, donut and sparkline. Any other `type` is looked up among the
 * charts registered with the Plugin API.
 *
 * Errors are shown inside the element, not thrown, so one bad chart does not
 * break the page. The element lives in its own entry (`@d3scope/core/element`):
 * importing the core never registers it by itself.
 */
import { renderAreaOrLine } from './element-charts.js';
import { renderBarChart, type BarDatum } from '../charts/bar.js';
import { renderPieChart, type PieDatum } from '../charts/pie.js';
import { renderSparkline } from '../charts/sparkline.js';
import { getChart, renderChart } from '../plugin/index.js';
import { getTheme, applyTheme } from '../theme/index.js';
import type { LocaleName } from '../format/index.js';

export const CHART_ELEMENT_NAME = 'd3scope-chart';

const SVG_NS = 'http://www.w3.org/2000/svg';
const LOCALES: readonly LocaleName[] = ['fr-FR', 'en-US'];

export class D3ScopeChartElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['type', 'width', 'height', 'tooltip', 'locale', 'theme', 'data'];
  }

  #data: unknown = undefined;
  #root: ShadowRoot;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent =
      ':host { display: block; } svg { display: block; max-width: 100%; height: auto; }';
    this.#root.appendChild(style);
  }

  connectedCallback(): void {
    this.#render();
  }

  attributeChangedCallback(): void {
    this.#render();
  }

  /** Data as a property. Takes precedence over the `data` attribute. */
  get data(): unknown {
    return this.#data;
  }

  set data(value: unknown) {
    this.#data = value;
    this.#render();
  }

  #render(): void {
    if (!this.isConnected) return;
    const theme = this.getAttribute('theme');
    if (theme) {
      try {
        applyTheme(this, getTheme(theme));
      } catch (e) {
        this.#showError(e);
        return;
      }
    }

    const kind = this.getAttribute('type') ?? 'bar';
    const width = Number(this.getAttribute('width') ?? 480);
    const height = Number(this.getAttribute('height') ?? 280);
    const tooltip = this.hasAttribute('tooltip') && this.getAttribute('tooltip') !== 'false';
    const localeAttr = this.getAttribute('locale');
    const locale = LOCALES.find((l) => l === localeAttr);

    let data: unknown;
    try {
      data = this.#data ?? parseDataAttribute(this.getAttribute('data'));
    } catch (e) {
      this.#showError(e);
      return;
    }
    if (data === undefined) {
      this.#clear();
      return;
    }

    const svg = document.createElementNS(SVG_NS, 'svg');
    try {
      draw(svg, kind, data, { width, height, tooltip, locale });
    } catch (e) {
      this.#showError(e);
      return;
    }
    this.#root.replaceChildren(this.#root.querySelector('style') ?? '', svg);
  }

  #clear(): void {
    this.#root.querySelectorAll('svg, .error').forEach((n) => {
      n.remove();
    });
  }

  #showError(e: unknown): void {
    this.#clear();
    const p = document.createElement('p');
    p.className = 'error';
    p.setAttribute('role', 'alert');
    p.style.color = '#cf222e';
    p.style.font = '13px system-ui, sans-serif';
    p.textContent = `d3scope-chart : ${e instanceof Error ? e.message : String(e)}`;
    this.#root.appendChild(p);
  }
}

function parseDataAttribute(text: string | null): unknown {
  if (text === null) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch (e) {
    throw new Error(
      `data attribute is not valid JSON (${e instanceof Error ? e.message : String(e)})`,
      { cause: e },
    );
  }
}

interface DrawOptions {
  width: number;
  height: number;
  tooltip: boolean;
  locale: LocaleName | undefined;
}

function asArray(data: unknown, kind: string): unknown[] {
  if (!Array.isArray(data)) throw new Error(`${kind}: data must be an array`);
  return data;
}

/** Draw `data` as `kind` into `svg`. Built-in kinds are typed here; other kinds go to the plugin registry. */
export function draw(svg: SVGSVGElement, kind: string, data: unknown, options: DrawOptions): void {
  const { width, height, tooltip, locale } = options;
  switch (kind) {
    case 'bar':
      renderBarChart(svg, asArray(data, kind) as BarDatum[], { width, height, tooltip, locale });
      return;
    case 'line':
    case 'area':
      renderAreaOrLine(svg, asArray(data, kind), {
        width,
        height,
        tooltip,
        locale,
        area: kind === 'area',
      });
      return;
    case 'pie':
    case 'donut':
      renderPieChart(svg, asArray(data, kind) as PieDatum[], {
        width,
        height,
        tooltip,
        locale,
        innerRadius: kind === 'donut' ? Math.min(width, height) / 4 : 0,
      });
      return;
    case 'sparkline':
      renderSparkline(
        svg,
        asArray(data, kind).map((d) =>
          typeof d === 'number' ? d : (d as { value: number }).value,
        ),
        { width, height },
      );
      return;
    default:
      if (!getChart(kind)) throw new Error(`unknown chart type "${kind}"`);
      renderChart(kind, svg, data, { width, height, tooltip, locale });
  }
}

/** Register `<d3scope-chart>` once. Safe to call again. */
export function defineChartElement(
  registry: CustomElementRegistry = globalThis.customElements,
): void {
  if (!registry.get(CHART_ELEMENT_NAME)) {
    registry.define(CHART_ELEMENT_NAME, D3ScopeChartElement);
  }
}
