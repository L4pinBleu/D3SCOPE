/**
 * Point marks. `dot` draws one circle per datum, positioned by the x and y
 * scales and optionally sized or coloured by the data.
 */
import type { Accessor } from '../channel.js';
import { valueOf, valuesOf } from '../channel.js';
import type { LabelColorScale } from '../color.js';
import { labelColorScale } from '../color.js';
import type { Mark, Primitive } from '../types.js';
import { cssVar, LIGHT_THEME } from '../../theme/index.js';

export interface DotOptions<T> {
  x: Accessor<T>;
  y: Accessor<T>;
  /** Radius in pixels, or a per-datum accessor. Default: 3. */
  r?: number | Accessor<T>;
  /** Fill colour, or an accessor coloured through a label colour scale. */
  fill?: string | Accessor<T>;
  stroke?: string;
  opacity?: number;
}

/** One circle per datum, at the (x, y) position. */
export function dot<T>(data: readonly T[], options: DotOptions<T>): Mark {
  const { x, y } = options;
  const xs = valuesOf(data, x);
  const ys = valuesOf(data, y);

  let colorScale: LabelColorScale | undefined;
  let fillOf: (datum: T) => string;
  const isField = (s: string): boolean => data.length > 0 && Object.hasOwn(data[0] as object, s);
  if (options.fill !== undefined && (typeof options.fill === 'function' || isField(options.fill))) {
    const scale = labelColorScale(data.map((d) => String(valueOf(d, options.fill as Accessor<T>))));
    colorScale = scale;
    fillOf = (datum) => scale(String(valueOf(datum, options.fill as Accessor<T>)));
  } else {
    const color = options.fill ?? cssVar('accent', LIGHT_THEME.accent);
    fillOf = () => color;
  }

  const mark: Mark & { colorScale?: LabelColorScale } = {
    name: 'dot',
    xValues(): readonly Primitive[] {
      return xs;
    },
    yValues(): readonly Primitive[] {
      return ys;
    },
    render(ctx): void {
      const layer = ctx.layer('dot');
      const svgNs = 'http://www.w3.org/2000/svg';
      data.forEach((datum) => {
        const px = ctx.x.position(valueOf(datum, x));
        const py = ctx.y.position(valueOf(datum, y));
        if (!Number.isFinite(px) || !Number.isFinite(py)) return;
        const rValue = options.r === undefined ? 3 : valueOf(datum, options.r as Accessor<T>);
        const r = typeof rValue === 'number' && Number.isFinite(rValue) && rValue >= 0 ? rValue : 0;
        const circle = document.createElementNS(svgNs, 'circle');
        circle.setAttribute('class', 'd3s-dot');
        circle.setAttribute('cx', String(px));
        circle.setAttribute('cy', String(py));
        circle.setAttribute('r', String(r));
        circle.setAttribute('fill', fillOf(datum));
        if (options.stroke) circle.setAttribute('stroke', options.stroke);
        if (options.opacity !== undefined)
          circle.setAttribute('fill-opacity', String(options.opacity));
        layer.appendChild(circle);
      });
    },
  };
  if (colorScale) mark.colorScale = colorScale;
  return mark;
}
