# Stats sketchboard

> Stats is an **example app**: a free, simpler alternative to R, MATLAB or Statistica, built later
> in its own repository **on top of** D3SCOPE. D3SCOPE builds only the **simple charts and the
> building blocks**. Domain charts (box plot, QQ plot, regression, …) belong to a **stats plugin**,
> which is **out of D3SCOPE's scope**. This sketchboard finds which building blocks such a plugin
> needs from the core.

## Iteration 1 / 3 (current)

![Stats sketchboard, iteration 1](./stats-v1.svg)

Source: [`stats-v1.excalidraw`](./stats-v1.excalidraw). Drag and drop it onto
[excalidraw.com](https://excalidraw.com) to edit it. Sample data is fake (iris-like) and numbers
use the fr-FR format.

### The three directions

|                  | A: Workbench (RStudio / JASP-like)                                    | B: Notebook / report (Jupyter / Quarto-like)                      | C: Analysis wizard + linked views (Statistica-like)                  |
| ---------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Idea**         | Data and options on the left, a 2×2 chart grid, results console below | Cells: code → table or chart output, ready to export for a report | Menu → variable dialog → linked charts + result sheet                |
| **Charts shown** | histogram, scatter + regression/CI, box plot, QQ plot                 | faceted scatter (small multiples), correlation heatmap            | 5 000-point scatter with brush, histogram highlighting the selection |
| **Strength**     | Everything for one analysis on one screen                             | Reproducible, easy to export to papers                            | Familiar to Statistica users, exploratory                            |
| **Risk**         | Dense; many panels to build                                           | Needs a code/formula layer in the app                             | Large datasets push SVG to its limits                                |

### Who provides what

| Colour       | Provider                        | Pieces                                                                                                                                                              |
| ------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Blue         | `@d3scope/core`                 | histogram, scatter, heatmap (?), facet grid / small multiples with shared scales, continuous colour legend, zoom/pan, linked selection, export (high-DPI PNG + SVG) |
| Purple       | Core plugin                     | brush                                                                                                                                                               |
| Orange       | Stats plugin (**out of scope**) | box plot, QQ plot, regression line + CI band (computation)                                                                                                          |
| Grey, dashed | The app (not D3SCOPE)           | data table, variable list, options, dialogs, console, result tables                                                                                                 |

### Building blocks a stats plugin needs from core

These are the actual outputs of this sketchboard. A stats plugin must be able to draw box plots,
QQ plots or regression bands **using only the Plugin API**, so the core has to expose:

1. **Scales and axes:** linear, log and band scales; axes with fine tick control (count, format, grid lines).
2. **Layout:** a facet grid / small-multiples helper with shared or independent scales.
3. **Primitives:** points, line, area band between `y0` and `y1` (CI bands), binned rectangles, reference lines (e.g. y = x in a QQ plot), text annotations.
4. **Legends:** categorical and **continuous** (colour scale).
5. **Interactions:** zoom/pan, **linked selection** across charts (select in one, highlight in others), with brush as a core plugin.
6. **Formatting:** significant digits and scientific notation, in fr-FR by default.
7. **Export:** high-DPI PNG (e.g. 300 dpi) and SVG for publications.
8. **Large N:** thousands of points without freezing (see question 3).

### Questions for review

1. **Direction:** A, B, C, or sub-views as for Portfolio? My proposal is **A as the main layout**, with C's linked views as the interaction model inside A's grid. B is out of scope for the charts (it's an app feature).
2. **Histogram and heatmap:** both are "simple" charts, so I propose **core**. Do you agree?
3. **Large datasets:** SVG gets slow above roughly 10 000 points. Should the core get a **Canvas renderer** for scatter and line (same API, `renderer: 'canvas'`), or should that be a core plugin? WASM would still need a benchmark first (PLAN §7).
4. **Linked selection:** should it be a core interaction (my proposal), or part of the brush core plugin?
5. **Statistical helpers** (binning, quantiles, KDE): binning (`d3-array` `bin`) is needed for the core histogram. Should anything else be exposed by core, or does all of it belong to the stats plugin?
