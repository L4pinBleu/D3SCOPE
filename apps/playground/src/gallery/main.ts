/**
 * DOM layer of the plot gallery: builds one page per chart family from a
 * declarative control list, redraws the chart when a control changes, and
 * shows the spec as JSON — or an error box when the spec builder throws.
 * The pure part lives in `config.ts`; this file only touches the DOM.
 */
import { plot, type PlotSpec } from '@d3scope/core';
import {
  areaSpec,
  axesSpec,
  barXSpec,
  barYSpec,
  bubbleSpec,
  cellSpec,
  dotSpec,
  groupedBarSpec,
  histogramSpec,
  legendSpec,
  lineSpec,
  ruleSpec,
  stackedBarSpec,
  type AxisControls,
} from './config.js';

// ---------------------------------------------------------------------------
// Control model
// ---------------------------------------------------------------------------

interface Control {
  /** Key in the flat control record. */
  key: string;
  label: string;
  kind: 'number' | 'text' | 'checkbox' | 'select';
  /** Options for `select`. */
  options?: readonly string[];
  /** Default text value (inputs) or checked state (checkboxes). */
  value?: string;
}

/** The axis controls, shared by every page. */
function axisControls(axis: 'x' | 'y'): readonly Control[] {
  const p = `${axis}.`;
  return [
    {
      key: `${p}type`,
      label: 'Type',
      kind: 'select',
      options: ['auto', 'linear', 'log', 'time', 'band'],
      value: 'auto',
    },
    { key: `${p}min`, label: 'Min', kind: 'text', value: '' },
    { key: `${p}max`, label: 'Max', kind: 'text', value: '' },
    { key: `${p}nice`, label: 'Nice', kind: 'checkbox', value: 'true' },
    { key: `${p}step`, label: 'Step', kind: 'number', value: '' },
    { key: `${p}ticks`, label: 'Ticks', kind: 'number', value: '' },
    { key: `${p}label`, label: 'Label', kind: 'text', value: '' },
    { key: `${p}grid`, label: 'Grille', kind: 'checkbox', value: 'false' },
    {
      key: `${p}position`,
      label: 'Position',
      kind: 'select',
      options: ['default', 'top', 'right', 'bottom', 'left'],
      value: 'default',
    },
    { key: `${p}reverse`, label: 'Inversé', kind: 'checkbox', value: 'false' },
  ];
}

/** One page: a builder and the controls it reads. */
interface Page {
  id: string;
  label: string;
  /** Page-specific controls (axis groups are added automatically). */
  controls: readonly Control[];
  withAxes: boolean;
  build(controls: Record<string, string | boolean>): PlotSpec;
}

/** Read one axis group of the flat record into AxisControls. */
function readAxis(v: Record<string, string | boolean>, axis: 'x' | 'y'): AxisControls {
  const get = (k: string): string => String(v[`${axis}.${k}`] ?? '');
  const flag = (k: string): boolean => v[`${axis}.${k}`] === true || v[`${axis}.${k}`] === 'true';
  return {
    type: get('type'),
    min: get('min'),
    max: get('max'),
    nice: flag('nice'),
    step: get('step'),
    ticks: get('ticks'),
    label: get('label'),
    grid: flag('grid'),
    position: get('position'),
    reverse: flag('reverse'),
  };
}

const B: Control = {
  key: 'barWidth',
  label: 'barWidth (axe linéaire)',
  kind: 'number',
  value: '20',
};

export const PAGES: readonly Page[] = [
  {
    id: 'bar-y',
    label: 'Barres verticales',
    withAxes: true,
    controls: [
      { key: 'linearPosition', label: 'Axe x linéaire (numérique)', kind: 'checkbox' },
      { key: 'fillByCategory', label: 'Remplir par catégorie', kind: 'checkbox', value: 'true' },
      { key: 'opacity', label: 'Opacity', kind: 'number', value: '0.9' },
      B,
    ],
    build: (v) =>
      barYSpec({
        linearPosition: v.linearPosition === true,
        fillByCategory: v.fillByCategory === true,
        opacity: String(v.opacity ?? ''),
        barWidth: String(v.barWidth ?? ''),
        x: readAxis(v, 'x'),
        y: readAxis(v, 'y'),
      }),
  },
  {
    id: 'bar-x',
    label: 'Barres horizontales',
    withAxes: true,
    controls: [
      { key: 'linearPosition', label: 'Axe y linéaire (numérique)', kind: 'checkbox' },
      { key: 'fillByCategory', label: 'Remplir par catégorie', kind: 'checkbox', value: 'true' },
      { key: 'opacity', label: 'Opacity', kind: 'number', value: '0.9' },
      B,
    ],
    build: (v) =>
      barXSpec({
        linearPosition: v.linearPosition === true,
        fillByCategory: v.fillByCategory === true,
        opacity: String(v.opacity ?? ''),
        barWidth: String(v.barWidth ?? ''),
        x: readAxis(v, 'x'),
        y: readAxis(v, 'y'),
      }),
  },
  {
    id: 'line',
    label: 'Courbes',
    withAxes: true,
    controls: [
      {
        key: 'series',
        label: 'Series',
        kind: 'select',
        options: ['series', 'none'],
        value: 'series',
      },
      { key: 'stroke', label: 'Stroke (couleur fixe)', kind: 'text', value: '' },
      { key: 'strokeWidth', label: 'StrokeWidth', kind: 'number', value: '2' },
    ],
    build: (v) =>
      lineSpec({
        series: String(v.series ?? 'series'),
        stroke: String(v.stroke ?? ''),
        strokeWidth: String(v.strokeWidth ?? ''),
        x: readAxis(v, 'x'),
        y: readAxis(v, 'y'),
      }),
  },
  {
    id: 'dot',
    label: 'Points',
    withAxes: true,
    controls: [
      { key: 'r', label: 'R (rayon)', kind: 'number', value: '4' },
      { key: 'fillByCategory', label: 'Remplir par catégorie', kind: 'checkbox', value: 'true' },
      { key: 'opacity', label: 'Opacity', kind: 'number', value: '0.85' },
    ],
    build: (v) =>
      dotSpec({
        r: String(v.r ?? ''),
        fillByCategory: v.fillByCategory === true,
        opacity: String(v.opacity ?? ''),
        x: readAxis(v, 'x'),
        y: readAxis(v, 'y'),
      }),
  },
  {
    id: 'rules',
    label: 'Repères et texte',
    withAxes: true,
    controls: [
      { key: 'ruleYValues', label: 'ruleY (valeurs y)', kind: 'text', value: '100, 140' },
      { key: 'ruleXValues', label: 'ruleX (valeurs x)', kind: 'text', value: 'Juin' },
      { key: 'dash', label: 'Dash', kind: 'text', value: '4 4' },
      { key: 'opacity', label: 'Opacity', kind: 'number', value: '0.8' },
      {
        key: 'anchor',
        label: 'Anchor',
        kind: 'select',
        options: ['start', 'middle', 'end'],
        value: 'middle',
      },
      { key: 'dx', label: 'dx', kind: 'number', value: '0' },
      { key: 'dy', label: 'dy', kind: 'number', value: '-8' },
      { key: 'fontSize', label: 'FontSize', kind: 'number', value: '12' },
    ],
    build: (v) =>
      ruleSpec({
        ruleYValues: String(v.ruleYValues ?? ''),
        ruleXValues: String(v.ruleXValues ?? ''),
        dash: String(v.dash ?? ''),
        opacity: String(v.opacity ?? ''),
        anchor: String(v.anchor ?? 'middle'),
        dx: String(v.dx ?? ''),
        dy: String(v.dy ?? ''),
        fontSize: String(v.fontSize ?? ''),
        x: readAxis(v, 'x'),
        y: readAxis(v, 'y'),
      }),
  },
  {
    id: 'axes',
    label: 'Axes',
    withAxes: true,
    controls: [],
    build: (v) => axesSpec({ x: readAxis(v, 'x'), y: readAxis(v, 'y') }),
  },
  {
    id: 'legend',
    label: 'Légende de couleur',
    withAxes: false,
    controls: [
      { key: 'legend', label: 'Légende', kind: 'checkbox', value: 'true' },
      { key: 'domain', label: 'color.domain (ordre)', kind: 'text', value: 'Nord, Sud' },
      { key: 'range', label: 'color.range (couleurs)', kind: 'text', value: '#2f6fed, #e5642f' },
    ],
    build: (v) =>
      legendSpec({
        legend: v.legend === true,
        domain: String(v.domain ?? ''),
        range: String(v.range ?? ''),
      }),
  },
  {
    id: 'bar-stack',
    label: 'Barres empilées',
    withAxes: true,
    controls: [
      { key: 'stack', label: 'Empiler', kind: 'checkbox', value: 'true' },
      { key: 'normalize', label: 'Normaliser (100 %)', kind: 'checkbox', value: 'false' },
      { key: 'legend', label: 'Légende', kind: 'checkbox', value: 'true' },
      { key: 'range', label: 'Couleurs des séries', kind: 'text', value: '' },
      { key: 'opacity', label: 'Opacity', kind: 'number', value: '0.9' },
    ],
    build: (v) =>
      stackedBarSpec({
        stack: v.stack === true,
        normalize: v.normalize === true,
        legend: v.legend === true,
        range: String(v.range ?? ''),
        opacity: String(v.opacity ?? ''),
        x: readAxis(v, 'x'),
        y: readAxis(v, 'y'),
      }),
  },
  {
    id: 'bar-group',
    label: 'Barres groupées',
    withAxes: true,
    controls: [
      { key: 'group', label: 'Grouper', kind: 'checkbox', value: 'true' },
      { key: 'horizontal', label: 'Horizontal (rectX)', kind: 'checkbox', value: 'false' },
      { key: 'legend', label: 'Légende', kind: 'checkbox', value: 'true' },
      { key: 'opacity', label: 'Opacity', kind: 'number', value: '0.9' },
    ],
    build: (v) =>
      groupedBarSpec({
        group: v.group === true,
        horizontal: v.horizontal === true,
        legend: v.legend === true,
        opacity: String(v.opacity ?? ''),
        x: readAxis(v, 'x'),
        y: readAxis(v, 'y'),
      }),
  },
  {
    id: 'area',
    label: 'Aires',
    withAxes: true,
    controls: [
      {
        key: 'mode',
        label: 'Mode',
        kind: 'select',
        options: ['aires', 'empilée'],
        value: 'aires',
      },
      {
        key: 'series',
        label: 'Series',
        kind: 'select',
        options: ['series', 'none'],
        value: 'series',
      },
      { key: 'normalize', label: 'Normaliser (100 %)', kind: 'checkbox', value: 'false' },
      { key: 'opacity', label: 'Opacity', kind: 'number', value: '0.6' },
    ],
    build: (v) =>
      areaSpec({
        mode: String(v.mode ?? 'aires'),
        series: String(v.series ?? 'series'),
        normalize: v.normalize === true,
        opacity: String(v.opacity ?? ''),
        x: readAxis(v, 'x'),
        y: readAxis(v, 'y'),
      }),
  },
  {
    id: 'histogram',
    label: 'Histogramme',
    withAxes: true,
    controls: [
      { key: 'count', label: 'Count (approx. bins)', kind: 'number', value: '' },
      { key: 'fill', label: 'Fill (couleur fixe)', kind: 'text', value: '' },
      { key: 'opacity', label: 'Opacity', kind: 'number', value: '0.9' },
    ],
    build: (v) =>
      histogramSpec({
        count: String(v.count ?? ''),
        fill: String(v.fill ?? ''),
        opacity: String(v.opacity ?? ''),
        x: readAxis(v, 'x'),
        y: readAxis(v, 'y'),
      }),
  },
  {
    id: 'bubble',
    label: 'Bulles',
    withAxes: true,
    controls: [
      { key: 'sizeMin', label: 'sizeRange.min', kind: 'number', value: '4' },
      { key: 'sizeMax', label: 'sizeRange.max', kind: 'number', value: '24' },
      { key: 'fillByCategory', label: 'Remplir par région', kind: 'checkbox', value: 'true' },
      { key: 'opacity', label: 'Opacity', kind: 'number', value: '0.7' },
    ],
    build: (v) =>
      bubbleSpec({
        sizeMin: String(v.sizeMin ?? ''),
        sizeMax: String(v.sizeMax ?? ''),
        fillByCategory: v.fillByCategory === true,
        opacity: String(v.opacity ?? ''),
        x: readAxis(v, 'x'),
        y: readAxis(v, 'y'),
      }),
  },
  {
    id: 'heatmap',
    label: 'Carte de chaleur',
    withAxes: true,
    controls: [{ key: 'opacity', label: 'Opacity', kind: 'number', value: '0.9' }],
    build: (v) =>
      cellSpec({
        opacity: String(v.opacity ?? ''),
        x: readAxis(v, 'x'),
        y: readAxis(v, 'y'),
      }),
  },
];

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag: string, className?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className !== undefined) e.className = className;
  return e;
}

/** Build the whole gallery into `root`. */
export function mountGallery(root: HTMLElement): void {
  const nav = el('nav', 'gallery-nav');
  const main = el('main', 'gallery-main');
  const panel = el('aside', 'gallery-panel');
  const chart = el('div', 'gallery-chart');
  const svg = document.createElementNS(SVG_NS, 'svg');
  chart.appendChild(svg);
  const errorBox = el('pre', 'gallery-error');
  errorBox.hidden = true;
  const json = el('pre', 'gallery-json');
  chart.appendChild(errorBox);
  main.appendChild(panel);
  main.appendChild(chart);
  root.appendChild(nav);
  root.appendChild(main);
  root.appendChild(json);

  const state: Record<string, string | boolean> = {};

  /** Collect the current control values of `page` from the state. */
  const values = (): Record<string, string | boolean> => ({ ...state });

  /** Rebuild the chart, the JSON panel and the error box. */
  const redraw = (): void => {
    errorBox.hidden = true;
    try {
      const page = PAGES.find((p) => p.id === currentId);
      if (page === undefined) throw new Error(`page inconnue : ${currentId}`);
      const spec = page.build(values());
      plot(svg, spec);
      const marks = spec.marks.map((m) => m.name).join(', ');
      json.textContent = JSON.stringify({ ...spec, marks }, null, 2);
    } catch (e) {
      errorBox.hidden = false;
      errorBox.textContent = e instanceof Error ? e.message : String(e);
      svg.replaceChildren();
      json.textContent = '';
    }
  };

  let currentId = PAGES[0]?.id ?? '';

  /** Show `page`: rebuild the control panel and redraw. */
  const show = (page: Page): void => {
    currentId = page.id;
    for (const button of nav.querySelectorAll('button')) {
      button.classList.toggle('active', button.dataset.page === page.id);
    }
    panel.replaceChildren();
    const groups: { title: string; controls: readonly Control[] }[] = [
      { title: 'Options', controls: page.controls },
    ];
    if (page.withAxes) {
      groups.push({ title: 'Axe x', controls: axisControls('x') });
      groups.push({ title: 'Axe y', controls: axisControls('y') });
    }
    for (const group of groups) {
      const fieldset = el('fieldset', 'gallery-group');
      const legend = el('legend');
      legend.textContent = group.title;
      fieldset.appendChild(legend);
      for (const control of group.controls) {
        fieldset.appendChild(makeControl(control));
      }
      panel.appendChild(fieldset);
    }
    redraw();
  };

  /** Build one input and wire it to the state and the redraw. */
  const makeControl = (control: Control): HTMLElement => {
    const row = el('label', 'gallery-control');
    const caption = document.createElement('span');
    caption.textContent = control.label;
    row.appendChild(caption);
    if (control.kind === 'select') {
      const wrap = el('span');
      const select = document.createElement('select');
      for (const option of control.options ?? []) {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option;
        select.appendChild(opt);
      }
      select.value = control.value ?? '';
      state[control.key] = select.value;
      select.addEventListener('change', () => {
        state[control.key] = select.value;
        redraw();
      });
      wrap.appendChild(select);
      row.appendChild(wrap);
      return row;
    }
    const input = document.createElement('input');
    if (control.kind === 'checkbox') {
      input.type = 'checkbox';
      input.checked = control.value === 'true';
      state[control.key] = input.checked;
    } else {
      input.type = control.kind === 'number' ? 'number' : 'text';
      if (control.kind === 'number') input.step = 'any';
      input.value = control.value ?? '';
      state[control.key] = input.value;
    }
    input.addEventListener('input', () => {
      state[control.key] = control.kind === 'checkbox' ? input.checked : input.value;
      redraw();
    });
    row.appendChild(input);
    return row;
  };

  for (const page of PAGES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = page.label;
    button.dataset.page = page.id;
    button.addEventListener('click', () => {
      show(page);
    });
    nav.appendChild(button);
  }
  const first = PAGES[0];
  if (first !== undefined) show(first);
}

/** Entry point: mount into #gallery. */
export function init(): void {
  const root = document.getElementById('gallery');
  if (root === null) throw new Error('gallery: élément #gallery introuvable');
  mountGallery(root);
}
