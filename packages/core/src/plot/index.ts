export { countOutside, plot } from './plot.js';
export { gridX, gridY } from './grid.js';
export { rectX, rectY, line, dot, ruleX, ruleY, text } from './marks/index.js';
export type {
  RectOptions,
  LineOptions,
  DotOptions,
  RuleOptions,
  TextOptions,
} from './marks/index.js';
export { createColorScale } from './color.js';
export { createPlotScale, inferKind, continuousDomain, stepTicks, tickValues } from './scales.js';
export type {
  AxisPosition,
  AxisSpec,
  ColorScale,
  ColorSpec,
  GridStyle,
  Mark,
  PlotContext,
  PlotMargin,
  PlotScale,
  PlotSpec,
  Primitive,
  ScaleKind,
} from './types.js';
