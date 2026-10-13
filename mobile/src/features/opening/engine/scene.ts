/**
 * Everything about the opening that is decided once: the sampled flight
 * path with its smoothed heading, the points on the fish outline, and
 * every particle's constants.
 *
 * `renderOpeningFrame` (./frame.ts) reads this and nothing else, which is
 * what keeps a frame a pure function of time.
 */
import { createCubicSampler, type Point } from './curve';
import {
  EMIT,
  FISH_A_STEPS,
  FISH_B_STEPS,
  FISH_START,
  FLIGHT_START,
  FLIGHT_STEPS,
  N_FISH,
  N_HAZE,
  N_RIBBON,
  N_WIND,
  NS_PTS,
  OPENING_SEED,
  T,
} from './constants';
import { lerp, monotoneCubic, mulberry32, span } from './math';

export interface FlightPose {
  x: number;
  y: number;
  /** Heading in degrees, nose along the direction of travel. */
  a: number;
}

export interface FlightTable {
  /** Path length in scene units. */
  length: number;
  /** The pose a fraction `p` (0..1) of the way along the path. */
  at(p: number, out: FlightPose): FlightPose;
}

export interface WindParticle {
  /** Time (animation s) it is shed from the fish. */
  b: number;
  /** Which ribbon strand it rides. */
  rib: number;
  jit: number;
  rise: number;
  life: number;
  amp: number;
  fr: number;
  ph: number;
  r: number;
  tb: number;
  gf: number;
  gp: number;
  /** The letter it later flows into. */
  li: number;
  /** Where on the flight path the fish was when this mote was shed. */
  relDist: number;
  relX: number;
  relY: number;
  relA: number;
}

export interface FishParticle {
  src: readonly [number, number];
  delay: number;
  tb: number;
  curl: number;
  r: number;
  jx: number;
  jy: number;
  li: number;
}

export interface HazeParticle {
  lag: number;
  r: number;
  op: number;
  amp: number;
  fr: number;
  ph: number;
}

export interface RibbonStrand {
  lag: number;
  len: number;
  lat: number;
  w: number;
  fr: number;
  ph: number;
  op: number;
}

export interface OpeningScene {
  flight: FlightTable;
  /** Speed along the flight: monotone, decelerating to rest. */
  progress: (u: number) => number;
  wind: WindParticle[];
  fish: FishParticle[];
  haze: HazeParticle[];
  ribbons: RibbonStrand[];
  /** Per-frame scratch, rewritten in full by every frame. */
  scratch: {
    px: Float64Array;
    py: Float64Array;
    op: Float64Array;
    sh: Float64Array;
  };
}

/**
 * Three symmetric box-filter passes over a sampled heading.
 *
 * THE FISH MUST NOT TUMBLE. The raw tangent of the approved flight swings
 * 93 degrees in 0.16 s and reverses twice inside the final bend, so a
 * fish that simply faces its tangent spins there. Low-passing the heading
 * itself -- symmetrically, so it does not lag the motion -- keeps the fish
 * pointing along its flight while making it impossible to snap or double
 * back.
 */
function smoothHeadings(
  source: Float64Array,
  n: number,
  halfWidth: number,
  passes: number
): Float64Array {
  let src = source;
  for (let k = 0; k < passes; k++) {
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      let cnt = 0;
      for (let a = i - halfWidth; a <= i + halfWidth; a++) {
        const b = a < 0 ? 0 : a >= n ? n - 1 : a; // replicate the edges
        sum += src[b];
        cnt++;
      }
      out[i] = sum / cnt;
    }
    src = out;
  }
  return src;
}

export function buildFlightTable(): FlightTable {
  const sampler = createCubicSampler(FLIGHT_START, FLIGHT_STEPS);
  const length = sampler.length;
  const sx = new Float64Array(NS_PTS);
  const sy = new Float64Array(NS_PTS);
  let sa: Float64Array = new Float64Array(NS_PTS);

  const a: Point = { x: 0, y: 0 };
  const b: Point = { x: 0, y: 0 };
  let prev = 0;
  for (let i = 0; i < NS_PTS; i++) {
    const d = (i / (NS_PTS - 1)) * length;
    sampler.at(d, a);
    // Heading from a FORWARD difference, except at the very end where
    // d + 1 clamps back onto d and atan2(0, 0) would snap the fish through
    // ~120 degrees in its final instant. Measure backwards there.
    let ang: number;
    if (d + 1.0 <= length) {
      sampler.at(d + 1.0, b);
      ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    } else {
      sampler.at(Math.max(0, d - 1.0), b);
      ang = (Math.atan2(a.y - b.y, a.x - b.x) * 180) / Math.PI;
    }
    sx[i] = a.x;
    sy[i] = a.y;
    if (i > 0) {
      while (ang - prev > 180) ang -= 360;
      while (ang - prev < -180) ang += 360;
    }
    sa[i] = ang;
    prev = ang;
  }
  sa = smoothHeadings(sa, NS_PTS, 46, 3);

  return {
    length,
    at(p: number, out: FlightPose): FlightPose {
      const f = (p < 0 ? 0 : p > 1 ? 1 : p) * (NS_PTS - 1);
      const i = f | 0;
      const r = f - i;
      if (i >= NS_PTS - 1) {
        out.x = sx[NS_PTS - 1];
        out.y = sy[NS_PTS - 1];
        out.a = sa[NS_PTS - 1];
        return out;
      }
      out.x = sx[i] + (sx[i + 1] - sx[i]) * r;
      out.y = sy[i] + (sy[i + 1] - sy[i]) * r;
      out.a = sa[i] + (sa[i + 1] - sa[i]) * r;
      return out;
    },
  };
}

/** Points ON the fish outline, so it dissolves into its own shape. */
export function sampleFishOutline(count: number): [number, number][] {
  const points: [number, number][] = [];
  const m = count / 2;
  const q: Point = { x: 0, y: 0 };
  for (const steps of [FISH_A_STEPS, FISH_B_STEPS]) {
    const sampler = createCubicSampler(FISH_START, steps);
    for (let k = 0; k < m; k++) {
      sampler.at((sampler.length * (k + 0.5)) / m, q);
      points.push([q.x, q.y]);
    }
  }
  return points;
}

/** The order letters receive gold: centre outward, so the word forms from the middle. */
const LETTER_ORDER = [4, 3, 5, 2, 6, 1, 7, 0, 8];

export function createOpeningScene(): OpeningScene {
  const flight = buildFlightTable();
  const fishPoints = sampleFishOutline(N_FISH);
  const rnd = mulberry32(OPENING_SEED);

  // NOTE: the order of every rnd() call below is part of the approved
  // film. Reordering them would change which mote is where.
  const wind: WindParticle[] = [];
  for (let i = 0; i < N_WIND; i++) {
    const f = (i + rnd() * 0.8) / N_WIND;
    const b = lerp(EMIT[0], EMIT[1], f);
    wind.push({
      b,
      rib: i % N_RIBBON,
      jit: (rnd() - 0.5) * 3.4,
      rise: -4 - rnd() * 10,
      life: 0.54 + rnd() * 0.46,
      amp: 1.2 + rnd() * 3.4,
      fr: 2.0 + rnd() * 3.2,
      ph: rnd() * 6.28,
      r: 0.26 + rnd() * 0.66,
      tb: rnd(),
      gf: 2.4 + rnd() * 3.6,
      gp: rnd() * 6.28,
      li: 0,
      relDist: 0,
      relX: 0,
      relY: 0,
      relA: 0,
    });
  }

  const fish: FishParticle[] = [];
  for (let i = 0; i < N_FISH; i++) {
    fish.push({
      src: fishPoints[i] ?? [0, 0],
      delay: rnd() * 0.1,
      tb: rnd(),
      curl: (rnd() - 0.5) * 44,
      r: 0.34 + rnd() * 0.74,
      jx: (rnd() - 0.5) * 7,
      jy: (rnd() - 0.5) * 5.5,
      li: 0,
    });
  }

  const ribbons: RibbonStrand[] = [];
  for (let i = 0; i < N_RIBBON; i++) {
    ribbons.push({
      lag: 5 + i * 6 + rnd() * 6,
      len: 104 + rnd() * 82,
      // Fanned apart, or five ribbons on one line merge into a solid band.
      lat: (i % 2 ? 1 : -1) * (3.4 + i * 2.4 + rnd() * 4.0),
      w: 0.38 + rnd() * 0.62,
      fr: 1.4 + rnd() * 1.6,
      ph: rnd() * 6.28,
      op: 0.34 + rnd() * 0.28,
    });
  }

  const haze: HazeParticle[] = [];
  for (let i = 0; i < N_HAZE; i++) {
    haze.push({
      lag: 0.006 + (i / N_HAZE) * 0.075,
      r: 4 + rnd() * 7.5,
      op: 0.038 + rnd() * 0.04,
      amp: 2 + rnd() * 5,
      fr: 1.4 + rnd() * 2.0,
      ph: rnd() * 6.28,
    });
  }

  for (let i = 0; i < wind.length; i++) wind[i].li = LETTER_ORDER[i % 9];
  for (let i = 0; i < fish.length; i++) fish[i].li = LETTER_ORDER[i % 9];

  // Speed along the flight: monotone cubic, decelerating to rest.
  const progress = monotoneCubic(
    [0, 0.12, 0.3, 0.48, 0.62, 0.76, 0.88, 0.96, 1.0],
    [0, 0.2, 0.34, 0.47, 0.56, 0.74, 0.9, 0.96, 1.0],
    'natural'
  );

  // A mote's station on the path is where the fish was when it shed it.
  // That never changes, so it is worked out once rather than every frame.
  const pose: FlightPose = { x: 0, y: 0, a: 0 };
  for (const w of wind) {
    const p = progress(span(w.b, T.flight[0], T.flight[1]));
    flight.at(p, pose);
    w.relDist = p * flight.length;
    w.relX = pose.x;
    w.relY = pose.y;
    w.relA = pose.a;
  }

  return {
    flight,
    progress,
    wind,
    fish,
    haze,
    ribbons,
    scratch: {
      px: new Float64Array(N_WIND),
      py: new Float64Array(N_WIND),
      op: new Float64Array(N_WIND),
      sh: new Float64Array(N_WIND),
    },
  };
}

let shared: OpeningScene | null = null;

/** The one scene, built on first use. */
export function getOpeningScene(): OpeningScene {
  if (!shared) shared = createOpeningScene();
  return shared;
}
