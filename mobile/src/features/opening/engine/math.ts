/**
 * The small numeric helpers the opening and onboarding choreography are
 * written in. Pure and allocation-free; every frame calls them hundreds
 * of times.
 */

export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

/** Hermite smoothstep: 0 below 0, 1 above 1, flat at both ends. */
export function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/** How far `t` has travelled from `a` to `b`, clamped to 0..1. */
export function span(t: number, a: number, b: number): number {
  return clamp((t - a) / (b - a), 0, 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * A fixed-seed PRNG.
 *
 * Every particle's constants are decided once, from a seed, so a frame
 * is a pure function of its time: scrubbing to 2.4 s shows exactly what
 * playing through 2.4 s shows, on every device, every launch. That is
 * also what makes the choreography testable.
 */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A monotone cubic (Fritsch-Carlson) through keyframes, as a function of
 * u in 0..1. Both end tangents are configurable: the fish starts a
 * journey at rest in one film and arrives at rest in the other, which is
 * a different property than "ends at some speed".
 */
export function monotoneCubic(
  ku: readonly number[],
  kp: readonly number[],
  endTangents: 'natural' | 'rest'
): (u: number) => number {
  const n = ku.length;
  const d: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((kp[i + 1] - kp[i]) / (ku[i + 1] - ku[i]));
  m.push(endTangents === 'rest' ? 0 : d[0]);
  for (let i = 1; i < n - 1; i++) m.push((d[i - 1] + d[i]) / 2);
  m.push(endTangents === 'rest' ? 0 : d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      m[i] = tau * a * d[i];
      m[i + 1] = tau * b * d[i];
    }
  }
  return function progress(uIn: number): number {
    const u = clamp(uIn, 0, 1);
    let i = 0;
    while (i < n - 2 && u > ku[i + 1]) i++;
    const h = ku[i + 1] - ku[i];
    const s = (u - ku[i]) / h;
    const s2 = s * s;
    const s3 = s2 * s;
    return (
      (2 * s3 - 3 * s2 + 1) * kp[i] +
      (s3 - 2 * s2 + s) * h * m[i] +
      (-2 * s3 + 3 * s2) * kp[i + 1] +
      (s3 - s2) * h * m[i + 1]
    );
  };
}
