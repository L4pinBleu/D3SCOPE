# D3SCOPE

> A modern, extensible charting library built on [D3.js](https://d3js.org/).

**Status:** 🚧 pre-alpha. Project setup is in progress and there is no usable
API yet.

## What it is

D3SCOPE is a **library**, not an application. It provides:

- **Core charts**: bar, line, area, pie, scatter, built on shared axes,
  scales and legends.
- **Interactivity**: tooltips, hover, zoom, click handlers, and data updates.
- **Export**: PNG first, with SVG planned.
- **A plugin system**: extra chart types, themes and palettes ship as separate
  packages and load at runtime, from a `plugins/` directory or as an external
  JavaScript module.

Stack: TypeScript by default. Rust/WASM is used only where a benchmark shows
a real gain, and each such choice is documented.

### Related projects

These projects are built on top of D3SCOPE. Each has its own interface:

| Project | Use case | Repository |
|---|---|---|
| **Portfolio** | Personal finance and net-worth tracking (Finary / CoinGecko style) | separate (coming soon) |
| **Stats** | A free, simpler alternative to R, MATLAB or Statistica | separate (coming soon) |
| **Company** | Charts that follow company constraints: logo, palettes, formats | separate (coming soon) |

## Repository layout

This is a pnpm monorepo. The layout will grow over time and is described in
[`PLAN.md`](./PLAN.md).

## Contributing

- Never commit to `main`. Work happens on task branches that are merged into
  `dev` through a pull request, and `dev` is merged into `main` at milestones.
- Keep each PR to one atomic change, ideally under 500 lines.
- Include tests. CI blocks merges when coverage is below 80%.

## License

D3SCOPE is licensed under the **GNU Affero General Public License v3.0 or
later** (SPDX: `AGPL-3.0-or-later`, see [`LICENSE`](./LICENSE)), with an additional
**[Plugin Exception](./LICENSE-EXCEPTION.md)**.

In practice:

| You want to… | Allowed? | Conditions |
|---|---|---|
| Use D3SCOPE in a commercial or non-commercial project | ✅ | AGPL-3.0 |
| Modify or fork the D3SCOPE core | ✅ | Your version must stay open source under AGPL-3.0, including when it is served over a network |
| Write a **plugin** (chart type, theme, palette, connector) that uses only the public Plugin API | ✅ | Any license, **including closed source** |
| Ship a closed-source build of the core or its main features | ❌ | — |

This summary is informational. If it differs from `LICENSE` or
`LICENSE-EXCEPTION.md`, those files are what count.

### Dependency policy

The core and its main features must not depend on any closed-source code.
Only open-source dependencies whose licenses are compatible with the
AGPL-3.0 are allowed, for example MIT, ISC, BSD-2-Clause, BSD-3-Clause,
Apache-2.0, MPL-2.0, LGPL-3.0 and GPL-3.0. Plugins are exempt.

Dependency checks (they run once `package.json` exists):

```bash
pnpm audit            # known vulnerabilities
pnpm licenses list    # license of every dependency
cargo audit           # Rust advisories (cargo install cargo-audit)
cargo deny check licenses   # Rust license allowlist (cargo install cargo-deny)
```

These checks will also run in CI.
