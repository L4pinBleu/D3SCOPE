# D3SCOPE — Architecture Plan

> Status: **living document**. It describes the target architecture and is
> updated by PR whenever a decision changes. Decisions taken are recorded in §10.

## 1. Scope

D3SCOPE is a **library**: a TypeScript charting toolkit built on D3.js. This
repository contains only the library (charts + structure), its official
framework bindings, its official core plugins, and a dev playground.

**Out of scope for this repository.** These live in their own repositories and
use D3SCOPE as a dependency. The apps are **examples**: their sketchboards
(`docs/sketchboards/`) only decide what the library must provide, and
D3SCOPE does not build the apps themselves.

| Project                 | Purpose                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| Portfolio (example app) | Personal finance dashboards. Sketchboard **validated** (iteration 2)                                   |
| Stats (example app)     | A free, simpler alternative to R, MATLAB or Statistica                                                 |
| Company (plugin test)   | Branding (logo, palettes, formats). Used only as a **test case for writing a plugin** (no sketchboard) |
| Domain plugins          | Finance (candlestick, OHLC), stats (box plot, QQ plot…). Built by others on top of D3SCOPE (§4)        |
| Third-party plugins     | Extra chart types, themes and palettes. They may be closed source (see `LICENSE-EXCEPTION.md`)         |

## 2. Repository layout (pnpm workspaces)

```
D3SCOPE/
├─ packages/
│  ├─ core/               @d3scope/core: charts, scales, axes, legends,
│  │                      interactions, export, Plugin API (framework-agnostic)
│  ├─ svelte/             @d3scope/svelte: thin Svelte 5 wrappers around core
│  └─ plugin-template/    starter kit copied into external plugin repos
├─ plugins/               official core plugins, built ONLY on the Plugin API
│  ├─ treemap/            @d3scope/plugin-treemap (with drill-down)
│  └─ brush/              @d3scope/plugin-brush (time range linked to other charts)
├─ apps/
│  └─ playground/         Svelte + Vite web app: try the library in the
│                         browser before installing it (see §8)
├─ crates/                Rust/WASM crates, only after an ADR (§7). Absent at start
├─ docs/                  sketchboards, ADRs (architecture decisions), guides
├─ .github/workflows/     CI (§8)
├─ pnpm-workspace.yaml
├─ package.json           root scripts only (no runtime deps)
└─ Cargo.toml             Rust workspace, created only with the first crate
```

Rules:

- `@d3scope/core` has **no UI-framework dependency**. Its only runtime
  dependencies are `d3-*` modules (ISC).
- Framework bindings (`@d3scope/svelte`, and possibly others later) depend on
  core, never the other way round.
- Core plugins (`plugins/*`) import only `@d3scope/core/plugin`, never core
  internals. This tests the Plugin API on real plugins (see §4).
- Packages are ESM-only, written in strict TypeScript, and ship `.d.ts` files.

## 3. Core modules (`@d3scope/core`)

| Module         | Responsibility                                                                    |
| -------------- | --------------------------------------------------------------------------------- |
| `scales/`      | Thin wrappers over `d3-scale` with shared defaults (time, linear, band, log)      |
| `axes/`        | Axis rendering, tick formatting, locale support                                   |
| `legends/`     | Categorical and continuous legends                                                |
| `charts/`      | Built-in charts: **bar** first, then line, area, pie/donut, scatter, sparkline    |
| `interaction/` | Tooltip, crosshair, hover, click, zoom/pan, data updates (`chart.update(data)`)   |
| `format/`      | Locale-aware number, currency, percent and date formatting (see below)            |
| `theme/`       | Design tokens (palette, fonts, spacing) applied via CSS variables. v1: light only |
| `export/`      | PNG and SVG export (§5)                                                           |
| `plugins/`     | Plugin registry and public Plugin API (§4)                                        |

**Locale.** The default is **`fr-FR`** (`128 430 €`, `+2,4 %`, `12 mars`). It can
be changed globally with `configure({ locale: 'en-US' })` or per chart with a
`locale` option, so apps can expose it in their settings. It is built on
`d3-format` (`formatLocale`) and `d3-time-format` (`timeFormatLocale`), both ISC.
Core ships `fr-FR` and `en-US`, and other locales can be registered.

**Theme.** v1 ships a **light** theme only. Tokens are named by role
(`--d3s-surface`, `--d3s-text`, `--d3s-positive`, …) rather than by color, so a
**dark theme in v2** is just a second token set, with no chart code changes.

Public API sketch (not final):

```ts
import { createChart } from '@d3scope/core';

const chart = createChart('#el', {
  type: 'bar',
  data,
  x: 'month',
  y: 'revenue',
  theme: 'default',
});
chart.update(newData);
await chart.export('png', { scale: 2 });
chart.destroy();
```

## 4. Plugin system

The Plugin API is **the license boundary** defined in `LICENSE-EXCEPTION.md`.
A plugin may use only the public, documented API, so the API must be explicit,
versioned and stable.

```ts
import { definePlugin } from '@d3scope/core/plugin';

export default definePlugin({
  name: 'd3scope-plugin-candlestick',
  version: '1.0.0',
  apiVersion: '^1.0.0', // Plugin API range the plugin supports
  charts: { candlestick: CandlestickChart },
  themes: { midnight: midnightTheme },
  palettes: {},
});
```

Loading modes:

1. **npm / bundler:** `import plugin from '…'; registerPlugin(plugin)`.
2. **Folder (final app builds):** `loadPlugins('/plugins/')` reads a
   `plugins/manifest.json` and `import()`s each entry at runtime.
3. **JS element:** `<script type="module" src="…/plugin.js">`. The plugin
   registers itself on load, and an optional `<d3scope-chart>` custom element
   renders charts declaratively.

Guarantees:

- The Plugin API follows **semver**. Breaking changes require a major version
  bump and a migration note.
- Core checks `apiVersion` and refuses incompatible plugins with a clear error.
- Plugins cannot touch core internals. Only symbols exported from
  `@d3scope/core/plugin` count as the API.

Plugin tiers:

| Tier                        | Where                                                          | In D3SCOPE's scope?                          | Examples                                                |
| --------------------------- | -------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------- |
| **Core plugins** (official) | `plugins/` in this repo, released with core, AGPL-3.0-or-later | ✅ yes                                       | treemap, brush                                          |
| **Domain plugins**          | separate repos, any license (`LICENSE-EXCEPTION.md`)           | ❌ no, built by others **on top of** D3SCOPE | finance (candlestick, OHLC), stats (box plot, QQ plot…) |
| **Third-party plugins**     | anywhere, any license                                          | ❌ no                                        | custom charts, themes, palettes, branding               |

Where a chart belongs:

- **Core:** every "simple", general-purpose chart (bar, line, area, pie/donut,
  scatter, sparkline, …).
- **Core plugin:** generic utilities that not every app needs (treemap, brush).
- **Domain plugin:** charts that only make sense in one field (finance,
  statistics, …). They are **not** developed in D3SCOPE.

**What D3SCOPE owes domain plugins.** Its job is to provide the **tools and
building blocks** for writing them: the Plugin API, `plugin-template`, and
reusable primitives (scales, axes, legends, tooltip, theme tokens, `format/`,
export, interactions). A finance or stats plugin is then a thin layer on top.
The example-app sketchboards (`docs/sketchboards/`) are used to find which
primitives are missing.

## 5. Export

| Format            | Approach                                                            | Dependencies |
| ----------------- | ------------------------------------------------------------------- | ------------ |
| **SVG**           | Serialize the chart's SVG node and inline computed styles and fonts | none         |
| **PNG (browser)** | Draw the serialized SVG on a `<canvas>`, then `canvas.toBlob()`     | none         |

There is no native (Tauri/Rust) export: everything runs in the browser.
Server-side rendering can be added later as a plugin if a project needs it.

`.task` mentioned `html2canvas` (MIT). It is designed to capture HTML, not SVG.
Because charts are pure SVG, the native canvas path is smaller and more
faithful. `html2canvas` stays a fallback only if HTML overlays (for example
tooltips) must appear in the export.

## 6. Animation

GSAP is **proprietary** (Webflow "Standard No Charge" license, not
OSI-approved), so it is excluded. Animation uses two MIT/ISC layers, each with
its own job:

| Layer                | Library                              | Used for                                                                                                                |
| -------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| **Data transitions** | `d3-transition` (ISC, part of D3)    | enter/update/exit of bars, lines, points, axes; interpolating SVG attributes (`d`, `x`, `height`…) inside D3 data joins |
| **UI motion**        | [`motion`](https://motion.dev) (MIT) | tooltips, legends, chart intro, springs, `inView`/scroll triggers, Svelte components, playground                        |

**Why `motion` over `anime.js`** (both MIT):

- It uses the Web Animations API when it can, so transform and opacity
  animations stay smooth even when the main thread is busy.
- It has spring physics, `inView`/`scroll` helpers, and a tree-shakable mini
  build (`motion/mini`).
- It is actively maintained by a large community.
- anime.js is strongest at SVG morphing and line drawing, but D3
  (`d3-interpolate`) already covers that inside charts.

Note: motion's hardware acceleration does not apply to SVG geometry attributes,
which is why data transitions stay on `d3-transition`.

How the layers fit:

- `@d3scope/core` defines a small `AnimationDriver` interface. The default
  driver is `d3-transition`, so the core needs no extra dependency.
- A `motion` driver ships as an opt-in subpath (`@d3scope/core/animation/motion`)
  with `motion` as an **optional peer dependency**. Users who don't import it
  don't pay for it.
- `@d3scope/svelte` and the playground depend on `motion` directly.
- Every animation respects `prefers-reduced-motion`.

## 7. TypeScript vs Rust/WASM

TypeScript is the default. Rust/WASM is adopted for a module **only** if an
ADR in `docs/adr/` shows that all of these hold:

1. A benchmark on realistic data (≥ 100k points) gives a **≥ 2× speed-up**
   end to end, including JS↔WASM data transfer.
2. The bundle size cost is acceptable (target: < 100 kB gzip per WASM module).
3. A pure-TS fallback exists, or the feature is optional.

Likely candidates, to benchmark in the polish phase: downsampling of large
series (LTTB), binning and density estimates for histograms, and large-scale
hit-testing for hover.

Rust code is written to be **educational**: commented choices, idiomatic
error handling, and tests next to the code. Until the first ADR is accepted,
the repository contains **no Rust** and the CI Rust job is skipped.

## 8. Tooling, tests and CI

| Area                               | Tool                                                                         | License          |
| ---------------------------------- | ---------------------------------------------------------------------------- | ---------------- |
| Package manager                    | pnpm workspaces                                                              | MIT              |
| Build                              | `tsup` (library), Vite (playground)                                          | MIT              |
| TS unit tests                      | Vitest + v8 coverage                                                         | MIT              |
| Svelte tests                       | Vitest + `@testing-library/svelte` (jsdom)                                   | MIT              |
| Rust tests (when `crates/` exists) | `cargo test`, coverage via `cargo-llvm-cov`                                  | Apache-2.0 / MIT |
| Lint                               | ESLint (flat config) + `typescript-eslint` + `eslint-plugin-svelte`          | MIT              |
| Format                             | Prettier + `prettier-plugin-svelte`                                          | MIT              |
| Versioning                         | Changesets                                                                   | MIT              |
| UI (playground, docs)              | `shadcn-svelte` + `bits-ui` (shadcn/ui is React-only)                        | MIT              |
| Dependency audit                   | `pnpm audit`, `pnpm licenses list` (+ `cargo audit`, `cargo deny` with Rust) | —                |

**Why ESLint + Prettier rather than Biome.** Biome is faster and is a single
tool, but its Svelte support is still partial: it doesn't fully lint or format
`.svelte` templates. The ESLint and Prettier Svelte plugins are the
officially supported path. Since Svelte is our UI layer, we choose the mature
tooling and can revisit once Biome fully supports Svelte.

### Self-test playground

`apps/playground` lets anyone **try D3SCOPE in the browser before installing
it**. Users can:

- pick a chart and edit its data (paste CSV/JSON) and options live
- switch themes and palettes
- export to PNG/SVG
- copy the generated code snippet

It is a static Vite build that runs locally with `pnpm --filter playground dev`.
Online hosting (GitHub Pages, Cloudflare Pages…) and an "Open in StackBlitz"
link are **optional** and can be added later, for example when the repository
becomes public. A desktop (Tauri) app is **not** planned: a web page needs no
download, which suits a quick self-test better.

### CI

CI (GitHub Actions) runs on every PR to `dev` and `main`. Its jobs are TS and
Svelte, plus Rust once `crates/` exists. Each job runs lint, test and coverage,
and fails if:

- any test fails, or
- coverage is **below 80%** for its package, or
- a dependency's license is not on the allowlist.

## 9. Roadmap (this repository)

1. **init** ✅: license, README, PLAN, workspace scaffold, lint/format, CI.
2. **core**:
   1. sketchboards: Portfolio ✅ (iteration 2), Stats; Company is a plugin test case only (3 iterations max, validated before any UI code)
   2. `format/` (locale, fr-FR default) and light theme tokens
   3. scales, axes and legends
   4. bar chart
   5. tooltip, crosshair and click interactions
   6. line/area (time scale), pie/donut, sparkline
   7. PNG/SVG export
   8. Plugin API v1 + `plugin-template`
   9. core plugins: treemap, brush
   10. playground v1 (self-test, runs locally)
3. **polish**: more chart types, `motion` animation driver (§6), WASM
   benchmarks (§7), `<d3scope-chart>` custom element, optional online
   playground hosting, docs, first `v0.x` release.
4. **v2**: dark theme (second token set).

Portfolio, Stats and Company follow their own roadmaps in their own
repositories. Domain plugins (finance, stats…) are out of scope: D3SCOPE only
provides the Plugin API, `plugin-template` and the building blocks they need.

## 10. Decisions

| #   | Question                                 | Decision                                                                                                                                                   |
| --- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Animation library                        | `d3-transition` for data transitions + `motion` (motion.dev) for UI motion. No GSAP (proprietary)                                                          |
| 2   | Tauri app?                               | **No.** The self-test is a web playground (no download). Rust only after a WASM ADR                                                                        |
| 3   | Lint / format                            | ESLint + Prettier (mature Svelte support)                                                                                                                  |
| 4   | Framework bindings                       | **Svelte** first. React/Vue only on demand                                                                                                                 |
| 5   | `<d3scope-chart>` custom element         | Deferred to the polish phase, after Plugin API v1                                                                                                          |
| 6   | Playground hosting                       | Not needed for now; the playground runs locally. Online hosting is optional, later                                                                         |
| 7   | Scope of the example apps                | Portfolio / Stats / Company are examples. D3SCOPE builds charts + structure, not the apps                                                                  |
| 8   | Treemap, brush                           | **Core plugins** in `plugins/`, built only on the Plugin API                                                                                               |
| 9   | Domain-specific charts (finance, stats…) | **Out of D3SCOPE scope.** Built by others as domain plugins; D3SCOPE provides the Plugin API, template and building blocks. KPIs belong to the app         |
| 10  | Locale                                   | `fr-FR` by default, configurable globally (`configure({ locale })`) or per chart                                                                           |
| 11  | Theme                                    | Light only in v1, dark in v2 (role-based tokens)                                                                                                           |
| 12  | Simple vs specific charts                | All "simple", general-purpose charts live in **core** (sparkline included). Only generic utilities go to core plugins, and domain charts to domain plugins |
| 13  | Company                                  | No sketchboard. It is used as a test case for writing a plugin                                                                                             |
