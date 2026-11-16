# Changelog

All notable changes to `@d3scope/core` are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow
[semver](https://semver.org/) for the public API.

## [Unreleased]

### Added

- Zoom and pan of the plot area: the `zoom` option of `plot()` (off by default)
  enables the mouse wheel, left-button drag to pan, right-button drag to zoom
  to a rectangle, and double-click reset. Zoom runs per axis (`axes`) and per
  link (`link`: `independent` or `joint`). Helpers `getZoomView` and `resetZoom`.
- `plot()` option `onRender`: called after every draw, including zoom redraws,
  for decorations that `plot()` does not draw.
- Zoom on a trackpad: Shift or Ctrl with the left button draws the selection, a
  pinch (wheel with ctrlKey) zooms faster, and the axes draw only the ticks in the
  visible plot, with the axis line stopped at its edges.
- Plugin API 1.3.0: the range marks `rangeX` and `rangeY` (specification bands)
  are re-exported by `@d3scope/core/plugin`.
- Plugin API 1.2.0: `plot()`, the built-in marks and the plot types are
  re-exported by `@d3scope/core/plugin`, so a plugin draws charts without
  importing `@d3scope/core/plot`.

- Plugin API 1.1.0: plugins can provide marks, scales and transforms
  (`marks`, `scales`, `transforms` in `definePlugin`). Plugins written for 1.0
  still register. Helpers: `defineMark`, `defineTransform`, `createMark`,
  `applyTransform`, `listMarks`, `listScales`, `listTransforms`.
- Composable plot model (`@d3scope/core/plot`): marks for bars (stacked,
  grouped, normalised), lines, areas (stacked), dots (with bubble sizes),
  rules, text, histograms, heatmaps; box plot; radar and polar area charts
  (in progress: see the PRs).

## [0.1.0] - 2026-11-01

First release. Charts, export, theming, plugins, a custom element and the
animation driver. Plugins are versioned separately (see below).

### Added

- Charts: bar, line and area (time scale, crosshair), pie and donut,
  sparkline. Each has a `layout…` function (pure geometry) and a `render…`
  function (DOM).
- Interactions: SVG tooltip by default, HTML mode optional; click handlers.
- Axes with localized tick labels; categorical and continuous legends
  (gradient).
- Formatting: `fr-FR` (default) and `en-US` for numbers, percentages,
  currencies and dates; `configure({ locale })` sets the library locale.
- Theme tokens (`LIGHT_THEME`) exposed as `--d3s-*` CSS variables;
  `registerTheme`, `getTheme`, `applyTheme`.
- Export: PNG (`exportPng`, `downloadPng`) and SVG (`exportSvg`,
  `downloadSvg`). The SVG export keeps computed styles so it renders outside
  the page.
- Plugin API v1 (`@d3scope/core/plugin`): `definePlugin`, `defineChart`,
  `registerPlugin`, `renderChart`, `loadPlugins` (manifest), with an explicit
  error on an incompatible `apiVersion`.
- `<d3scope-chart>` custom element (`@d3scope/core/element`).
- Script-tag build (`d3scope.global.js`) that exposes `window.D3SCOPE`
  (frozen) for plugins loaded with a plain `<script>` tag.
- Animation driver (`@d3scope/core/animation`): default Web Animations driver,
  `fadeIn` that respects `prefers-reduced-motion`; `motion` driver under
  `@d3scope/core/animation/motion` (`motion` is an optional peer dependency).

### Plugins (released with core, in `plugins/`)

- `@d3scope/plugin-treemap` 0.1.0 (AGPL-3.0-or-later): treemap with drill-down.
- `@d3scope/plugin-brush` 0.1.0 (AGPL-3.0-or-later): time-range brush linked to
  other charts through `createTimeRangeLink()`.
- `@d3scope/plugin-template` 0.1.0 (MIT): starting point for your own plugin.

### Decisions

- Rust/WASM was benchmarked for LTTB downsampling and rejected: 1.57× at
  100 000 points, below the 2× gate. See
  [`docs/adr/0001-wasm-lttb-downsampling.md`](./docs/adr/0001-wasm-lttb-downsampling.md).

### Known limitations

- Not yet published to npm.
- Charts do not play an intro animation on their own; call `fadeIn`.
- Data transitions (`d3-transition`) are not wired yet.
- The `<d3scope-chart>` element has no documented events yet.
