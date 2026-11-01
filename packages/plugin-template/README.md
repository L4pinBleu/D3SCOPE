# D3SCOPE plugin template

A starting point for a D3SCOPE plugin: one chart, one theme and one palette,
built only on the public Plugin API (`@d3scope/core/plugin`).

This template is **MIT**, so a plugin built from it can use any license. This
follows the Plugin Exception in `LICENSE-EXCEPTION.md` (AGPL-3.0-or-later for the
core, with a permission for plugins that use only the public API).

## Use it

1. Copy `packages/plugin-template` into a new repository.
2. Rename the package and the plugin `name` in `src/index.ts`
   (lowercase; for example `d3scope-plugin-candlestick`).
3. Replace the chart, theme and palette with your own.
4. Install `@d3scope/core` as a dependency and keep `apiVersion` to the range you support.

## Rules that keep it a plugin

- Import only from `@d3scope/core/plugin`. The test `imports only from the public
Plugin API` checks this.
- Do not copy code from the core. Type declarations are fine.
- Keep `apiVersion` aligned with the core you support (`^1.0.0` for Plugin API v1).

## Scripts

| Command              | What it does             |
| -------------------- | ------------------------ |
| `pnpm build`         | Builds `dist/` with tsup |
| `pnpm test`          | Runs the tests (jsdom)   |
| `pnpm test:coverage` | Same, with the 80 % gate |
| `pnpm typecheck`     | `tsc --noEmit`           |

## Loading

```ts
import { registerPlugin, renderChart } from '@d3scope/core/plugin';
import plugin from 'your-plugin';

registerPlugin(plugin);
renderChart('template-dots', svgElement, [{ x: 10, y: 20 }], { color: '#c2410c' });
```

Loading from a folder manifest or as a JS element is planned (PLAN §4) but not
part of Plugin API v1 yet.
