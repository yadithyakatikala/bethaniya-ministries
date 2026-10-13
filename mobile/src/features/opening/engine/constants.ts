/**
 * The approved opening, as numbers.
 *
 *   "The fish is carrying golden wind to Maranatha,
 *    and that golden wind becomes Maranatha."
 *
 * Everything here is carried over unchanged from the approved film: the
 * scene space, the flight path, the fish outline, the timeline. The
 * film's exported video is 5.4 s long -- 4.02 "animation seconds" played
 * at SPEED 1.34 -- and that is the timing the owner approved, so it is
 * the timing shipped. `SPEED` is the one number to change to make the
 * whole sequence faster or slower; every beat scales with it.
 */
import type { CubicStep } from './curve';

/** The film's own coordinate space. Placed on screen with `slice` (cover). */
export const SCENE = { w: 320, h: 660 } as const;

/** The portrait: centre and radius, in scene units. */
export const LOGO = { x: 160, y: 282, r: 58 } as const;

/** The wordmark: baseline centre, size and tracking, in scene units. */
export const WORD = { x: 160, y: 396, size: 16, track: 3.0 } as const;
export const WORD_TEXT = 'MARANATHA';

/**
 * Where each letter's centre sits, measured from the approved render
 * (Noto Serif SemiBold at 16 units, tracking 3.0, laid out by the
 * browser). Letter k is drawn with its advance box centred on LETTER_X[k].
 */
export const LETTER_X: readonly number[] = [
  101.65, 118.096, 132.496, 146.902, 162.004, 176.623, 190.125, 204.696, 220.042,
];

/** The centre line the gold flows to as it forms the word. */
export const WORD_MID_Y = WORD.y - WORD.size * 0.34;

/** The approved flight: in from the lower right, round the mark, to rest below it. */
export const FLIGHT_START = [400, 470] as const;
export const FLIGHT_STEPS: readonly CubicStep[] = [
  [330, 452, 262, 420, 214, 372],
  [186, 344, 150, 330, 118, 320],
  [86, 310, 66, 276, 74, 240],
  [82, 204, 116, 178, 152, 176],
  [188, 174, 218, 196, 226, 228],
  [234, 260, 224, 296, 200, 320],
  [192, 336, 180, 358, 172, 376],
  [168, 384, 164, 388, 160, 390],
];

/**
 * The Christian fish: two arcs from the nose, nose toward +x, drawn at
 * 0.58 scale. This is the one outline used everywhere the fish appears.
 */
export const FISH_START = [40, 0] as const;
export const FISH_A_STEPS: readonly CubicStep[] = [
  [22, -18, -2, -18, -22, 0],
  [-30, 8, -36, 12, -40, 15],
];
export const FISH_B_STEPS: readonly CubicStep[] = [
  [22, 18, -2, 18, -22, 0],
  [-30, -8, -36, -12, -40, -15],
];
export const FISH_SCALE = 0.58;
/** The fish's stroke width in its own (unscaled) units. */
export const FISH_STROKE = 3.2 / FISH_SCALE;

function pathOf(start: readonly [number, number], steps: readonly CubicStep[]): string {
  return `M ${start[0]} ${start[1]} ` + steps.map((s) => `C ${s.join(' ')}`).join(' ');
}

export const FISH_A_D = pathOf(FISH_START, FISH_A_STEPS);
export const FISH_B_D = pathOf(FISH_START, FISH_B_STEPS);

/** Particle budget. Unchanged from the approved film. */
export const N_WIND = 96;
export const N_FISH = 120;
export const N_HAZE = 14;
export const N_RIBBON = 5;
export const N_BLOOM = 14;
/** Brightness tiers: each is ONE path holding every mote at that brightness. */
export const TIERS = 8;
export const RIB_PTS = 26;
export const NS_PTS = 800;

/** Wall-clock seconds per animation second. */
export const SPEED = 1.34;

/** The timeline, in animation seconds. */
export const T = {
  logoIn: [0.0, 0.55],
  flight: [0.7, 2.55],
  gather: [1.92, 2.42],
  dissolve: [2.35, 3.15],
  letters: [3.05, 3.68],
  hold: [3.68, 4.02],
  total: 4.02,
} as const;

/** When the fish starts and stops shedding gold. */
export const EMIT = [0.7, 2.44] as const;

/** The wall-clock length of the whole opening, in seconds. */
export const OPENING_DURATION = T.total * SPEED;

/** Seed for the particle field -- fixed so every launch is identical. */
export const OPENING_SEED = 20260925;
