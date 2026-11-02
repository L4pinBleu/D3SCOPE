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
  boxPlot,
  rangeX,
  rangeY,
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
  BoxPlotOptions,
  RangeOptions,
} from './marks/index.js';
export {
  radarChart,
  polarArea,
  polarPoint,
  polygonPoints,
  sectorPath,
  niceMax,
  layoutRadar,
  layoutPolarArea,
} from './polar.js';
export type { RadarSpec, RadarSeries, PolarAreaSpec, PolarAreaDatum, PolarPoint } from './polar.js';
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
