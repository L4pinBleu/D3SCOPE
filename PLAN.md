# D3SCOPE — Architecture Plan

> Status: **draft**, under review in the `docs/plan` PR. This document describes
> the target architecture. Decisions taken are recorded in §10.

## 1. Scope

D3SCOPE is a **library**: a TypeScript charting toolkit built on D3.js. This
repository contains only the library, its official framework bindings, and a
dev playground.

**Out of scope for this repository.** These live in their own repositories and
use D3SCOPE as a dependency:

| Project | Purpose |
|---|---|
| Portfolio | Personal finance and net-worth dashboards |
| Stats | A free, simpler alternative to R, MATLAB or Statistica |
| Company | Branded charts that follow company constraints (logo, palettes, formats) |
| Plugins | Extra chart types, themes and palettes. They may be closed source (see `LICENSE-EXCEPTION.md`) |

## 2. Repository layout (pnpm workspaces)

```
D3SCOPE/
├─ packages/
│  ├─ core/               @d3scope/core: charts, scales, axes, legends,
│  │                      interactions, export, Plugin API (framework-agnostic)
│  ├─ svelte/             @d3scope/svelte: thin Svelte 5 wrappers around core
│  └─ plugin-template/    starter kit copied into external plugin repos
├─ apps/
│  └─ playground/         Svelte + Vite web app: try the library online,
│                         no install needed (static build, see §8)
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
- Packages are ESM-only, written in strict TypeScript, and ship `.d.ts` files.

## 3. Core modules (`@d3scope/core`)

| Module | Responsibility |
|---|---|
| `scales/` | Thin wrappers over `d3-scale` with shared defaults (time, linear, band, log) |
| `axes/` | Axis rendering, tick formatting, locale support |
| `legends/` | Categorical and continuous legends |
| `charts/` | Built-in charts: **bar** first, then line, area, pie/donut, scatter |
| `interaction/` | Tooltip, hover, click, zoom/pan, data updates (`chart.update(data)`) |
| `theme/` | Design tokens (palette, fonts, spacing) applied via CSS variables |
| `export/` | PNG and SVG export (§5) |
| `plugins/` | Plugin registry and public Plugin API (§4) |

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
  apiVersion: '^1.0.0',      // Plugin API range the plugin supports
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

## 5. Export

| Format | Approach | Dependencies |
|---|---|---|
| **SVG** | Serialize the chart's SVG node and inline computed styles and fonts | none |
| **PNG (browser)** | Draw the serialized SVG on a `<canvas>`, then `canvas.toBlob()` | none |

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

| Layer | Library | Used for |
|---|---|---|
| **Data transitions** | `d3-transition` (ISC, part of D3) | enter/update/exit of bars, lines, points, axes; interpolating SVG attributes (`d`, `x`, `height`…) inside D3 data joins |
| **UI motion** | [`motion`](https://motion.dev) (MIT) | tooltips, legends, chart intro, springs, `inView`/scroll triggers, Svelte components, playground |

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

| Area | Tool | License |
|---|---|---|
| Package manager | pnpm workspaces | MIT |
| Build | `tsup` (library), Vite (playground) | MIT |
| TS unit tests | Vitest + v8 coverage | MIT |
| Svelte tests | Vitest + `@testing-library/svelte` (jsdom) | MIT |
| Rust tests (when `crates/` exists) | `cargo test`, coverage via `cargo-llvm-cov` | Apache-2.0 / MIT |
| Lint | ESLint (flat config) + `typescript-eslint` + `eslint-plugin-svelte` | MIT |
| Format | Prettier + `prettier-plugin-svelte` | MIT |
| Versioning | Changesets | MIT |
| UI (playground, docs) | `shadcn-svelte` + `bits-ui` (shadcn/ui is React-only) | MIT |
| Dependency audit | `pnpm audit`, `pnpm licenses list` (+ `cargo audit`, `cargo deny` with Rust) | — |

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

It is a static Vite build, deployed automatically from `main`, plus a
"Open in StackBlitz" link for a full editable project. A desktop (Tauri) app is
**not** planned: a web page needs no download, which suits a quick self-test
better.

### CI

CI (GitHub Actions) runs on every PR to `dev` and `main`. Its jobs are TS and
Svelte, plus Rust once `crates/` exists. Each job runs lint, test and coverage,
and fails if:
- any test fails, or
- coverage is **below 80%** for its package, or
- a dependency's license is not on the allowlist.

## 9. Roadmap (this repository)

1. **init**: license ✅, README ✅, PLAN (this doc), workspace scaffold, lint/format, CI.
2. **core**:
   1. sketchboards (3 iterations max per use case, validated before any UI code)
   2. scales, axes and legends
   3. bar chart
   4. tooltip and click interactions
   5. PNG/SVG export
   6. Plugin API v1 + `plugin-template`
   7. playground v1 (self-test) + deployment
3. **polish**: more chart types, `motion` animation driver (§6), WASM
   benchmarks (§7), `<d3scope-chart>` custom element, docs, first `v0.x`
   release.

Portfolio, Stats and Company follow their own roadmaps in their own
repositories.

## 10. Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Animation library | `d3-transition` for data transitions + `motion` (motion.dev) for UI motion. No GSAP (proprietary) |
| 2 | Tauri app? | **No.** The self-test is a web playground (no download). Rust only after a WASM ADR |
| 3 | Lint / format | ESLint + Prettier (mature Svelte support) |
| 4 | Framework bindings | **Svelte** first. React/Vue only on demand |
| 5 | `<d3scope-chart>` custom element | Deferred to the polish phase, after Plugin API v1 |

### Still open

| # | Question | Proposal |
|---|---|---|
| 6 | Playground hosting: GitHub Pages on a **private** repo needs a paid GitHub plan | Cloudflare Pages or Netlify (free) while private; GitHub Pages once the repo is public |
