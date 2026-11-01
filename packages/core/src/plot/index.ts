export { countOutside, plot } from './plot.js';
export { gridX, gridY } from './grid.js';
export {
  rectX,
  rectY,
  line,
  dot,
  ruleX,
  ruleY,
  text,
  area,
  stackedArea,
  histogram,
  cell,
} from './marks/index.js';
export type {
  RectOptions,
  LineOptions,
  DotOptions,
  RuleOptions,
  TextOptions,
  AreaOptions,
  StackedAreaOptions,
  HistogramOptions,
  CellOptions,
} from './marks/index.js';
export { stackY, normalizeStack, dodge, bin, niceBinWidth } from './transforms.js';
export type { StackAccessors, StackedRow, Slot, Bin } from './transforms.js';
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
