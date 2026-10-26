# D3SCOPE — Architecture Plan

> Status: **draft**, under review in the `docs/plan` PR. This document describes
> the target architecture. Items marked **❓** are open decisions.

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
│  └─ playground/         Svelte + Vite dev app for visual checks and demos
│     └─ src-tauri/       ❓ Tauri shell (Rust): native export, file access
├─ crates/                ❓ Rust crates (WASM or Tauri), only when justified (§7)
├─ docs/                  sketchboards, ADRs (architecture decisions), guides
├─ .github/workflows/     CI (§8)
├─ pnpm-workspace.yaml
├─ package.json           root scripts only (no runtime deps)
└─ Cargo.toml             ❓ Rust workspace, created with the first crate
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
| **PNG/PDF (native)** | ❓ Tauri command rendering SVG in Rust (e.g. `resvg`, license to verify) | Rust crate |

`.task` mentioned `html2canvas` (MIT). It is designed to capture HTML, not SVG.
Because charts are pure SVG, the native canvas path is smaller and more
faithful. `html2canvas` stays a fallback only if HTML overlays (for example
tooltips) must appear in the export.

## 6. Animation

`CLAUDE.md` lists **GSAP** as optional, but GSAP is **proprietary** (Webflow
"Standard No Charge" license, not OSI-approved). Under the dependency policy it
**cannot be a dependency of the core**.

Proposal:
- The core uses **`d3-transition`** (ISC), which already ships with D3 and
  covers chart enter, update and exit transitions.
- If richer animation is wanted later, it goes into a **separate plugin**
  (closed-source dependencies are allowed there), e.g. `d3scope-plugin-gsap`,
  or uses an MIT alternative such as `motion`.
- ❓ Your decision is needed. Once you choose, `CLAUDE.md` will be updated.

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
error handling, and tests next to the code.

## 8. Tooling, tests and CI

| Area | Tool | License |
|---|---|---|
| Package manager | pnpm workspaces | MIT |
| Build | `tsup` (library), Vite (playground) | MIT |
| TS unit tests | Vitest + v8 coverage | MIT |
| Svelte tests | Vitest + `@testing-library/svelte` (jsdom) | MIT |
| Rust tests | `cargo test`, coverage via `cargo-llvm-cov` | Apache-2.0 / MIT |
| Lint / format | ❓ Biome *or* ESLint + Prettier | MIT |
| Versioning | Changesets | MIT |
| UI (playground, docs) | `shadcn-svelte` + `bits-ui` (shadcn/ui is React-only) | MIT |
| Dependency audit | `pnpm audit`, `pnpm licenses list`, `cargo audit`, `cargo deny` | — |

CI (GitHub Actions) runs on every PR to `dev` and `main`. It has three jobs
(TS, Svelte, Rust), each running lint, test and coverage. A job fails if:
- any test fails, or
- coverage is **below 80%** for its package, or
- a dependency's license is not on the allowlist.

## 9. Roadmap (this repository)

1. **init**: license ✅, README ✅, PLAN (this doc), workspace scaffold, CI.
2. **core**:
   1. sketchboards (3 iterations max per use case, validated before any UI code)
   2. scales, axes and legends
   3. bar chart
   4. tooltip and click interactions
   5. PNG/SVG export
   6. Plugin API v1 + `plugin-template`
3. **polish**: more chart types, animations (per the §6 decision), WASM
   benchmarks (§7), docs, first `v0.x` release.

Portfolio, Stats and Company follow their own roadmaps in their own
repositories.

## 10. Open decisions

| # | Question | Proposal |
|---|---|---|
| 1 | GSAP vs open-source animation | `d3-transition` in core, animation plugin later |
| 2 | Is a Tauri shell in this repository needed? | Yes, inside `apps/playground` only, for native export + Rust tests |
| 3 | Biome or ESLint + Prettier | Biome (one tool, fast) |
| 4 | Svelte-only bindings, or also React/Vue later? | Svelte first, others on demand |
| 5 | Custom element `<d3scope-chart>` in v1? | Defer to after Plugin API v1 |
