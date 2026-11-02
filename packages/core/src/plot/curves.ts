/**
 * Curve interpolation for the line and area marks, written by hand (no
 * dependency). `curvePath` turns a list of pixel points into an open SVG path
 * `d` string; `curveAreaPath` turns a top and a bottom line into a closed
 * area path (top forward, bottom backward, `Z`).
 *
 * `linear` is the default and reproduces the plain `M`/`L` polyline exactly.
 * `step`, `stepBefore` and `stepAfter` hold values horizontally and step
 * vertically (at the segment midpoint, or at one of the endpoints).
 * `monotone` is a Fritsch–Carlson limited Hermite cubic that never overshoots
 * monotone data. `natural` is a natural cubic spline solved with the Thomas
 * algorithm, which passes through every data point.
 */

/** The supported interpolation modes. Default: `linear`. */
export type CurveType = 'linear' | 'step' | 'stepBefore' | 'stepAfter' | 'monotone' | 'natural';

/** A point in pixel coordinates. */
export interface CurvePoint {
  readonly x: number;
  readonly y: number;
}

/**
 * An open path `d` string through the points, in the given order (the marks
 * sort before calling). Empty for no points, a lone `M` for one point.
 */
export function curvePath(points: readonly CurvePoint[], curve: CurveType = 'linear'): string {
  return `M${segments(points, curve).join('')}`;
}

/**
 * A closed area path: the top line forward with the curve, a straight drop to
 * the bottom line at the last top x, the bottom line backward with the curve,
 * then `Z`. With fewer than two top points there is no area.
 */
export function curveAreaPath(
  top: readonly CurvePoint[],
  bottom: readonly CurvePoint[],
  curve: CurveType = 'linear',
): string {
  if (top.length < 2) {
    const first = top[0];
    return first === undefined ? '' : `M${String(first.x)},${String(first.y)}Z`;
  }
  const reversed = [...bottom];
  reversed.reverse();
  // Drop the leading `M x,y` of the reversed bottom line: the path is already
  // at that point after the straight drop, and the segments continue from it.
  const afterM = `M${segments(reversed, curve).join('')}`.replace(/^M[^CLHVQZ]*/, '');
  const lastTop = top[top.length - 1];
  const lastBottom = reversed[0];
  if (lastTop === undefined || lastBottom === undefined) return curvePath(top, curve) + 'Z';
  return curvePath(top, curve) + `L${String(lastBottom.x)},${String(lastBottom.y)}` + afterM + 'Z';
}

/** The segments after the initial `M` for the given points and curve. */
function segments(points: readonly CurvePoint[], curve: CurveType): string[] {
  const n = points.length;
  if (n === 0) return [];
  if (n === 1) {
    const p = points[0];
    return p === undefined ? [] : [`${String(p.x)},${String(p.y)}`];
  }
  if (curve === 'linear') {
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      const p = points[i];
      if (p === undefined) continue;
      out.push(`${i === 0 ? '' : 'L'}${String(p.x)},${String(p.y)}`);
    }
    return out;
  }
  if (curve === 'step') return stepSegments(points, 'mid');
  if (curve === 'stepBefore') return stepSegments(points, 'before');
  if (curve === 'stepAfter') return stepSegments(points, 'after');
  if (curve === 'monotone') return hermiteSegments(points, monotoneTangents(points));
  // The spline needs strictly increasing x: a repeated x keeps its last point.
  const unique = dropRepeatedX(points);
  if (unique.length < 2) return segments(unique, 'linear');
  return hermiteSegments(unique, naturalSecondDerivatives(unique));
}

/** Keep one point per x value: the last one given for each x. Order is kept. */
function dropRepeatedX(points: readonly CurvePoint[]): CurvePoint[] {
  const lastIndex = new Map<number, number>();
  points.forEach((p, i) => lastIndex.set(p.x, i));
  return points.filter((p, i) => lastIndex.get(p.x) === i);
}

/**
 * Step segments. `mid`: horizontal to the midpoint of the x gap, vertical
 * there, then on; the path reaches the last point with a final `L`.
 * `before`: vertical at the current point first, then horizontal.
 * `after`: horizontal first, then vertical at the next point.
 */
function stepSegments(points: readonly CurvePoint[], at: 'mid' | 'before' | 'after'): string[] {
  const n = points.length;
  const first = points[0];
  if (first === undefined) return [];
  const out: string[] = [`${String(first.x)},${String(first.y)}`];
  if (n === 2) {
    const second = points[1];
    if (second === undefined) return out;
    if (at === 'before') {
      out.push(`V${String(second.y)}H${String(second.x)}`);
    } else if (at === 'after') {
      out.push(`H${String(second.x)}V${String(second.y)}`);
    } else {
      const midX = (first.x + second.x) / 2;
      out.push(`H${String(midX)}V${String(second.y)}L${String(second.x)},${String(second.y)}`);
    }
    return out;
  }
  for (let i = 1; i < n; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    if (prev === undefined || cur === undefined) continue;
    if (at === 'before') {
      out.push(`V${String(cur.y)}H${String(cur.x)}`);
    } else if (at === 'after') {
      out.push(`H${String(cur.x)}V${String(cur.y)}`);
    } else {
      const midX = (prev.x + cur.x) / 2;
      const isLast = i === n - 1;
      out.push(
        `H${String(midX)}V${String(cur.y)}${isLast ? `L${String(cur.x)},${String(cur.y)}` : ''}`,
      );
    }
  }
  return out;
}

/**
 * Cubic Bézier segments from Hermite tangents: control points one third of
 * the horizontal gap along the tangent at each end. `tangents[i]` is the
 * slope of the curve at `points[i]`. A zero or degenerate gap falls back to
 * a straight `L` for that segment.
 */
function hermiteSegments(points: readonly CurvePoint[], tangents: readonly number[]): string[] {
  const n = points.length;
  const first = points[0];
  if (first === undefined) return [];
  const out: string[] = [`${String(first.x)},${String(first.y)}`];
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const t0 = tangents[i];
    const t1 = tangents[i + 1];
    if (p0 === undefined || p1 === undefined || t0 === undefined || t1 === undefined) continue;
    const h = p1.x - p0.x;
    if (h <= 0) {
      out.push(`L${String(p1.x)},${String(p1.y)}`);
      continue;
    }
    const dx = h / 3;
    const c1x = p0.x + dx;
    const c1y = p0.y + t0 * dx;
    const c2x = p1.x - dx;
    const c2y = p1.y - t1 * dx;
    out.push(
      `C${String(round(c1x))},${String(round(c1y))} ${String(round(c2x))},${String(round(c2y))} ${String(round(p1.x))},${String(round(p1.y))}`,
    );
  }
  return out;
}

/** Round to 12 significant decimals so float noise does not bloat the path. */
function round(v: number): number {
  return Number(v.toPrecision(12));
}

/**
 * Fritsch–Carlson monotone tangents (monotone in x). Interior tangents are the
 * mean of the neighbouring secants, zeroed where the data changes direction.
 * Each segment is then limited (both of its end tangents scaled by the same
 * factor) so that α² + β² ≤ 9, which keeps the cubic inside its end values.
 */
function monotoneTangents(points: readonly CurvePoint[]): number[] {
  const n = points.length;
  const secants: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    if (p0 === undefined || p1 === undefined) {
      secants.push(0);
      continue;
    }
    const h = p1.x - p0.x;
    secants.push(h > 0 ? (p1.y - p0.y) / h : 0);
  }
  const m: number[] = new Array(n).fill(0) as number[];
  if (n < 2) return m;

  // End tangents: the secant of the first and last segment.
  m[0] = secants[0] ?? 0;
  m[n - 1] = secants[n - 2] ?? 0;
  for (let i = 1; i < n - 1; i++) {
    const sPrev = secants[i - 1] ?? 0;
    const sNext = secants[i] ?? 0;
    // A change of direction (or a flat secant) is an extremum: stay flat.
    m[i] = sPrev * sNext <= 0 ? 0 : (sPrev + sNext) / 2;
  }

  // Limit each segment: α = m_k / s_k and β = m_{k+1} / s_k must satisfy α² + β² ≤ 9.
  for (let k = 0; k < n - 1; k++) {
    const s = secants[k] ?? 0;
    if (s === 0) {
      m[k] = 0;
      m[k + 1] = 0;
      continue;
    }
    // The tangents must share the segment's direction, otherwise the segment is flat.
    if ((m[k] ?? 0) / s < 0) m[k] = 0;
    if ((m[k + 1] ?? 0) / s < 0) m[k + 1] = 0;
    const a = (m[k] ?? 0) / s;
    const b = (m[k + 1] ?? 0) / s;
    const sq = a * a + b * b;
    if (sq > 9) {
      const tau = 3 / Math.sqrt(sq);
      m[k] = tau * a * s;
      m[k + 1] = tau * b * s;
    }
  }
  return m;
}

/**
 * Second derivatives of the natural cubic spline (M_0 = M_n-1 = 0), from the
 * standard tridiagonal system, solved with the Thomas algorithm.
 */
function naturalSecondDerivatives(points: readonly CurvePoint[]): number[] {
  const n = points.length;
  const m: number[] = new Array(n).fill(0) as number[];
  if (n < 3) return m;
  const h: number[] = [];
  const dy: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    if (p0 === undefined || p1 === undefined) return m;
    h.push(p1.x - p0.x);
    dy.push(p1.y - p0.y);
  }
  // Interior equations: h[i-1] M[i-1] + 2(h[i-1]+h[i]) M[i] + h[i] M[i+1] = rhs.
  const size = n - 2;
  const a: number[] = []; // sub-diagonal
  const b: number[] = []; // diagonal
  const c: number[] = []; // super-diagonal
  const r: number[] = []; // right-hand side
  for (let i = 0; i < size; i++) {
    const hi = h[i];
    const hi1 = h[i + 1];
    const dyi = dy[i];
    const dyi1 = dy[i + 1];
    if (hi === undefined || hi1 === undefined || dyi === undefined || dyi1 === undefined) return m;
    a.push(hi);
    b.push(2 * (hi + hi1));
    c.push(hi1);
    r.push(6 * (dyi1 / hi1 - dyi / hi));
  }
  // Thomas algorithm, forward sweep then back substitution.
  for (let i = 1; i < size; i++) {
    const ai = a[i];
    const biPrev = b[i - 1];
    const ciPrev = c[i - 1];
    const bi = b[i];
    const ri = r[i];
    const riPrev = r[i - 1];
    if (
      ai === undefined ||
      biPrev === undefined ||
      biPrev === 0 ||
      ciPrev === undefined ||
      bi === undefined ||
      ri === undefined ||
      riPrev === undefined
    ) {
      continue;
    }
    const w = ai / biPrev;
    b[i] = bi - w * ciPrev;
    r[i] = ri - w * riPrev;
  }
  for (let k = size - 1; k >= 0; k--) {
    const bi = b[k];
    const ri = r[k];
    const ci = c[k];
    const mNext = m[k + 2];
    if (bi === undefined || ri === undefined) continue;
    m[k + 1] = ci === undefined || mNext === undefined ? ri / bi : (ri - ci * mNext) / bi;
  }
  return m;
}
