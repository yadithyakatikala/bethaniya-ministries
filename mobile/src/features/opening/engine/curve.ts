/**
 * Arc-length sampling of a chain of cubic Béziers.
 *
 * The approved animation measured its flight path with the browser's
 * `getTotalLength()` / `getPointAtLength()`. React Native has no such
 * call, so this is the same thing done directly: flatten each curve into
 * short chords, keep the running length, and interpolate along them. The
 * chords are short enough (~0.4 scene units) that the polyline is within
 * a few thousandths of a unit of the true curve.
 */

export interface Point {
  x: number;
  y: number;
}

/** A cubic's three control points after the chain's current point. */
export type CubicStep = readonly [number, number, number, number, number, number];

export interface PathSampler {
  /** Total length of the chain, in scene units. */
  readonly length: number;
  /** The point `distance` units along the chain (clamped to its ends). */
  at(distance: number, out: Point): Point;
}

const STEPS_PER_CUBIC = 256;

export function createCubicSampler(
  start: readonly [number, number],
  steps: readonly CubicStep[]
): PathSampler {
  const xs: number[] = [start[0]];
  const ys: number[] = [start[1]];
  const cum: number[] = [0];

  let x0 = start[0];
  let y0 = start[1];
  for (const [x1, y1, x2, y2, x3, y3] of steps) {
    for (let i = 1; i <= STEPS_PER_CUBIC; i++) {
      const t = i / STEPS_PER_CUBIC;
      const m = 1 - t;
      const a = m * m * m;
      const b = 3 * m * m * t;
      const c = 3 * m * t * t;
      const d = t * t * t;
      const x = a * x0 + b * x1 + c * x2 + d * x3;
      const y = a * y0 + b * y1 + c * y2 + d * y3;
      const last = xs.length - 1;
      cum.push(cum[last] + Math.hypot(x - xs[last], y - ys[last]));
      xs.push(x);
      ys.push(y);
    }
    x0 = x3;
    y0 = y3;
  }

  const length = cum[cum.length - 1];

  return {
    length,
    at(distance: number, out: Point): Point {
      const d = distance < 0 ? 0 : distance > length ? length : distance;
      // Binary search for the chord containing `d`.
      let lo = 0;
      let hi = cum.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] <= d) lo = mid;
        else hi = mid;
      }
      const span = cum[hi] - cum[lo];
      const r = span > 0 ? (d - cum[lo]) / span : 0;
      out.x = xs[lo] + (xs[hi] - xs[lo]) * r;
      out.y = ys[lo] + (ys[hi] - ys[lo]) * r;
      return out;
    },
  };
}
