/**
 * The next chapter of the story, drawn when a new member begins onboarding.
 *
 * The opening ends on the portrait and the gold wordmark. This begins on
 * the same picture and ends on the first question:
 *
 *   1  the word turns back into the fish   (the same gold that made it)
 *   2  the fish leaves, carrying the wind
 *   3  a school of the same fish comes out of the paper
 *   4  the fish joins them, and the gold passes through the school
 *   5  the school settles into a slim band; the first question rises
 *
 * It reuses, unchanged, what the opening drew with: the fish outline, the
 * gold, the tapered ribbons, the motes that ride them, the specular band,
 * the wordmark and its sheen. Like the opening it is a port of the
 * approved film, and like the opening every frame is a pure function of
 * time -- scrubbing equals playing.
 *
 * COORDINATES. The chapter lives in the REFERENCE PHONE's pixels,
 * 390 x 844, with the opening's 320 x 660 scene placed in it exactly as
 * the opening places itself on that phone (cover): frame 0 is the
 * opening's last frame. The screen maps these onto the real device with
 * one uniform scale anchored to the school's band -- see
 * ../OnboardingStage.tsx -- so a device that is not 390 wide sees the same
 * composition, not a cropped one.
 */
import {
  FISH_SCALE,
  LETTER_X,
  N_BLOOM,
  N_FISH,
  N_HAZE,
  N_RIBBON,
  N_WIND,
  RIB_PTS,
  TIERS,
  WORD_MID_Y,
  WORD_TEXT,
} from './constants';
import { clamp, lerp, monotoneCubic, mulberry32, smoothstep as ss, span } from './math';
import type { Dot } from './frame';
import { sampleFishOutline } from './scene';

/** The reference phone. */
export const STAGE = { w: 390, h: 844 } as const;
/** How the opening's 320 x 660 scene is placed on it (cover). */
export const K = Math.max(STAGE.w / 320, STAGE.h / 660);
export const OX = (STAGE.w - 320 * K) / 2;

/** Where the word's centre line was, in stage px: the fish re-forms here. */
export const F0 = { x: 160 * K + OX, y: WORD_MID_Y * K };
/** The fish's size in the opening, in stage px per fish unit. */
export const HERO = FISH_SCALE * K;

/** The timeline, in wall-clock seconds. */
export const CHAPTER_T = {
  hold: [0.0, 0.3], // the opening's last frame; the gold wakes
  release: [0.25, 1.55], // letters give their gold back, outer first
  formed: [1.35, 1.7], // the fish is whole, and rests a moment
  swim: [1.65, 3.55], // the journey
  logoOut: [1.6, 2.7], // the mark recedes
  resolve: [1.95, 3.35], // the school comes out of the paper
  join: [3.05, 4.3], // the fish slows into its place
  gold: [3.45, 4.6], // the gold passes through the school
  form: [3.55, 4.55], // the first question rises; tappable by ~4.0
  settle: [4.3, 5.0],
  total: 5.0,
} as const;

/** The 2 s version, for a member who has already seen the chapter. */
export const RESUME_START = 2.95;

/** Where the school lives on the settled screen, in stage px. */
export const BAND = { y0: 96, h: 150 } as const;

const PATH = { n: 700, L: 420, H0: -165, H1: -35, a: 1.15 } as const;

/** The heading the fish has as the word turns back into it: nose to the left, a little up. */
export const START_ANGLE = PATH.H0;

/** The three depths of the school, front to back. */
const MID_S = 0.48;
const MID_OP = 0.8;
const LAYER = {
  front: { s: 0.62, op: 1.0 },
  mid: { s: MID_S, op: MID_OP },
  back: { s: 0.34, op: 0.46 },
} as const;

/** dx, dy (from the landing point), depth, resting heading, arriving fish? */
const SCHOOL_DEF: readonly (readonly [
  number,
  number,
  keyof typeof LAYER,
  number,
  boolean?,
])[] = [
  [0, 0, 'mid', -8, true], // the fish that just arrived: the tail
  // near row (front): larger, darker, lower on the screen
  [36, 30, 'front', -6],
  [101, 17, 'front', -11],
  [163, 27, 'front', -5],
  [216, 6, 'front', -9],
  // middle
  [74, -11, 'mid', -8],
  [128, -31, 'mid', -4],
  [188, -21, 'mid', -10],
  [226, -42, 'mid', -6],
  // far row (back): small and pale
  [-28, -34, 'back', -6],
  [30, -47, 'back', -9],
  [92, -60, 'back', -5],
  [154, -66, 'back', -8],
  [206, -62, 'back', -4],
];
export const N_SCHOOL = SCHOOL_DEF.length;

const SRIB_PTS = 11;
const EMIT = [CHAPTER_T.swim[0], CHAPTER_T.join[0] + 0.35] as const;
const SEED = 20261011;
const DEG = Math.PI / 180;

interface Wind {
  b: number;
  /** Where on the journey the fish was when it shed this mote. */
  relP: number;
  relX: number;
  relY: number;
  relA: number;
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
}
interface Strand {
  lag: number;
  len: number;
  lat: number;
  w: number;
  fr: number;
  ph: number;
  op: number;
}
interface Haze {
  lag: number;
  r: number;
  op: number;
  amp: number;
  fr: number;
  ph: number;
}
interface FishMote {
  src: readonly [number, number];
  li: number;
  delay: number;
  tb: number;
  curl: number;
  r: number;
  jx: number;
  jy: number;
}
interface SchoolRibbon {
  len: number;
  lat: number;
  w: number;
  fr: number;
  ph: number;
  op: number;
}
export interface SchoolSeed {
  bx: number;
  by: number;
  s: number;
  op: number;
  a0: number;
  user: boolean;
  ax: number;
  ay: number;
  wx: number;
  wy: number;
  px: number;
  py: number;
  ah: number;
  wh: number;
  ph: number;
  rib: [SchoolRibbon, SchoolRibbon];
  delay: number;
}

export interface ChapterScene {
  /** Where the journey ends, and the school's anchor. */
  J: { x: number; y: number };
  pathAt(p: number, out: Pose): Pose;
  progress(u: number): number;
  fishScale(t: number): number;
  wind: Wind[];
  strands: Strand[];
  haze: Haze[];
  fishMotes: FishMote[];
  school: SchoolSeed[];
  /** Heading of the fish as the word re-forms into it (the journey's first heading). */
  startAngle: number;
  scratch: { px: Float64Array; py: Float64Array; op: Float64Array; sh: Float64Array };
}

export interface Pose {
  x: number;
  y: number;
  a: number;
}

export function createChapterScene(): ChapterScene {
  // ---- the journey path: built from a HEADING PROFILE, not a drawn curve.
  // The heading changes steadily from one value to another and never turns
  // back, so the fish cannot wobble, snap or double back. It leaves heading
  // left, sweeps clockwise round the logo -- the same sense of rotation as
  // the opening's orbit -- and levels out heading right at the top.
  const n = PATH.n;
  const px = new Float64Array(n);
  const py = new Float64Array(n);
  const pa = new Float64Array(n);
  const theta = (u: number): number => {
    const a = PATH.a;
    const g =
      u <= 0 ? 0 : u >= 1 ? 1 : Math.pow(u, a) / (Math.pow(u, a) + Math.pow(1 - u, a));
    return PATH.H0 + (PATH.H1 - PATH.H0) * g;
  };
  const ds = PATH.L / (n - 1);
  px[0] = F0.x;
  py[0] = F0.y;
  pa[0] = theta(0);
  for (let i = 1; i < n; i++) {
    const th = theta((i - 0.5) / (n - 1)) * DEG;
    px[i] = px[i - 1] + Math.cos(th) * ds;
    py[i] = py[i - 1] + Math.sin(th) * ds;
    pa[i] = theta(i / (n - 1));
  }
  const J = { x: px[n - 1], y: py[n - 1] };
  const pathAt = (p: number, out: Pose): Pose => {
    const f = clamp(p, 0, 1) * (n - 1);
    const i = f | 0;
    const r = f - i;
    if (i >= n - 1) {
      out.x = px[n - 1];
      out.y = py[n - 1];
      out.a = pa[n - 1];
      return out;
    }
    out.x = px[i] + (px[i + 1] - px[i]) * r;
    out.y = py[i] + (py[i + 1] - py[i]) * r;
    out.a = pa[i] + (pa[i + 1] - pa[i]) * r;
    return out;
  };

  // Speed along the journey: from rest to rest. Both end tangents are
  // zero (the fish starts and arrives at rest) and every interior keyframe
  // has a positive slope, so it never stops in the middle.
  const progress = monotoneCubic(
    [0, 0.14, 0.34, 0.58, 0.8, 1.0],
    [0, 0.07, 0.3, 0.66, 0.93, 1.0],
    'rest'
  );
  // The fish shrinks as it recedes toward the school: depth, not a cut.
  const fishScale = (t: number): number => lerp(HERO, MID_S, ss(span(t, 2.0, 3.55)));

  // ---- the particles, decided once. The ORDER of every rnd() call is part
  // of the approved film.
  const fishPoints = sampleFishOutline(N_FISH);
  const rnd = mulberry32(SEED);

  const wind: Wind[] = [];
  for (let i = 0; i < N_WIND; i++) {
    const f = (i + rnd() * 0.8) / N_WIND;
    wind.push({
      b: lerp(EMIT[0], EMIT[1], f),
      relP: 0,
      relX: 0,
      relY: 0,
      relA: 0,
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
    });
  }
  // A mote's station is where the fish was when it shed it. That never
  // changes, so it is worked out once.
  const rel: Pose = { x: 0, y: 0, a: 0 };
  for (const w of wind) {
    w.relP = progress(span(w.b, CHAPTER_T.swim[0], CHAPTER_T.swim[1]));
    pathAt(w.relP, rel);
    w.relX = rel.x;
    w.relY = rel.y;
    w.relA = rel.a;
  }
  const strands: Strand[] = [];
  for (let i = 0; i < N_RIBBON; i++) {
    strands.push({
      lag: 5 + i * 6 + rnd() * 6,
      len: 104 + rnd() * 82,
      lat: (i % 2 ? 1 : -1) * (3.4 + i * 2.4 + rnd() * 4.0),
      w: 0.38 + rnd() * 0.62,
      fr: 1.4 + rnd() * 1.6,
      ph: rnd() * 6.28,
      op: 0.34 + rnd() * 0.28,
    });
  }
  const haze: Haze[] = [];
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

  // The word's letters give their gold back to the fish. Each point on the
  // fish outline is fed by the letter that sits at the same screen
  // position, so the streams run side by side and never cross: the left of
  // the word becomes the left of the fish.
  const startRot = pa[0] * DEG;
  const ca = Math.cos(startRot);
  const sa = Math.sin(startRot);
  const targets = fishPoints
    .map((p, i) => ({
      i,
      sx: F0.x + (p[0] * ca - p[1] * sa) * HERO,
    }))
    .sort((a, b) => a.sx - b.sx);
  const per = N_FISH / 9;
  const letterOf = new Array<number>(N_FISH).fill(0);
  for (let i = 0; i < N_FISH; i++) letterOf[targets[i].i] = Math.min(8, (i / per) | 0);
  const fishMotes: FishMote[] = [];
  for (let i = 0; i < N_FISH; i++) {
    fishMotes.push({
      src: fishPoints[i] ?? [0, 0],
      li: letterOf[i],
      delay: rnd() * 0.1,
      tb: rnd(),
      curl: -(16 + rnd() * 22),
      r: 0.34 + rnd() * 0.74,
      jx: (rnd() - 0.5) * 7,
      jy: (rnd() - 0.5) * 5.5,
    });
  }

  const school: SchoolSeed[] = [];
  for (let i = 0; i < N_SCHOOL; i++) {
    const [dx, dy, depth, heading, user] = SCHOOL_DEF[i];
    const layer = LAYER[depth];
    school.push({
      bx: J.x + dx,
      by: J.y + dy,
      s: layer.s,
      op: layer.op,
      a0: heading,
      user: Boolean(user),
      ax: 2.2 + rnd() * 2.4,
      ay: 1.6 + rnd() * 2.0,
      wx: 0.45 + rnd() * 0.5,
      wy: 0.5 + rnd() * 0.5,
      px: rnd() * 6.28,
      py: rnd() * 6.28,
      ah: 1.4 + rnd() * 1.8,
      wh: 0.4 + rnd() * 0.4,
      ph: rnd() * 6.28,
      rib: [
        {
          len: 40 + rnd() * 28,
          lat: 1.2 + rnd() * 1.6,
          w: 0.3 + rnd() * 0.3,
          fr: 1.2 + rnd() * 1.4,
          ph: rnd() * 6.28,
          op: 0.1 + rnd() * 0.07,
        },
        {
          len: 30 + rnd() * 24,
          lat: -(1.0 + rnd() * 1.4),
          w: 0.24 + rnd() * 0.26,
          fr: 1.0 + rnd() * 1.4,
          ph: rnd() * 6.28,
          op: 0.08 + rnd() * 0.06,
        },
      ],
      delay: i * 0.012,
    });
  }

  return {
    J,
    pathAt,
    progress,
    fishScale,
    wind,
    strands,
    haze,
    fishMotes,
    school,
    startAngle: pa[0],
    scratch: {
      px: new Float64Array(N_WIND),
      py: new Float64Array(N_WIND),
      op: new Float64Array(N_WIND),
      sh: new Float64Array(N_WIND),
    },
  };
}

let shared: ChapterScene | null = null;
export function getChapterScene(): ChapterScene {
  if (!shared) shared = createChapterScene();
  return shared;
}

// ---------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------

export interface RibbonPath {
  d: string;
  opacity: number;
}

/** One fish of the school: where it is, how it is drawn, its two small ribbons. */
export interface SchoolFish {
  x: number;
  y: number;
  angle: number;
  scale: number;
  opacity: number;
  /** The lit gold rim along the fish's upper edge. */
  rimOpacity: number;
  ribbons: [RibbonPath, RibbonPath];
}

export interface ChapterFrame {
  seconds: number;
  /** The opening's last frame: portrait and wordmark, in opening space. */
  open: {
    portrait: { opacity: number; offsetY: number; scale: number };
    letters: { opacity: number; dy: number }[];
    sheen: number;
  };
  hazeOpacity: number;
  haze: Dot[];
  ribbonsOpacity: number;
  ribbons: RibbonPath[];
  /** The fish while it is still gold, at the word's centre. */
  goldFish: { opacity: number };
  school: SchoolFish[];
  glow: Dot;
  blooms: Dot[];
  tiers: RibbonPath[];
  streaks: RibbonPath[];
}

const f1 = (v: number): string => v.toFixed(1);
const f2 = (v: number): string => v.toFixed(2);

function emptySchool(): SchoolFish[] {
  return Array.from({ length: N_SCHOOL }, () => ({
    x: 0,
    y: 0,
    angle: 0,
    scale: 0,
    opacity: 0,
    rimOpacity: 0,
    ribbons: [
      { d: '', opacity: 0 },
      { d: '', opacity: 0 },
    ],
  }));
}

export function emptyChapterFrame(): ChapterFrame {
  const dot = (): Dot => ({ cx: -50, cy: -50, r: 6, opacity: 0 });
  return {
    seconds: 0,
    open: {
      portrait: { opacity: 1, offsetY: 0, scale: 1 },
      letters: Array.from({ length: WORD_TEXT.length }, () => ({ opacity: 1, dy: 0 })),
      sheen: 0,
    },
    hazeOpacity: 0,
    haze: Array.from({ length: N_HAZE }, dot),
    ribbonsOpacity: 0,
    ribbons: Array.from({ length: N_RIBBON }, () => ({ d: '', opacity: 0 })),
    goldFish: { opacity: 0 },
    school: emptySchool(),
    glow: { cx: -99, cy: -99, r: 26, opacity: 0 },
    blooms: Array.from({ length: N_BLOOM }, dot),
    tiers: Array.from({ length: TIERS }, () => ({ d: '', opacity: 0 })),
    streaks: Array.from({ length: 4 }, () => ({ d: '', opacity: 0 })),
  };
}

/** A small tapered ribbon in a fish's own frame: it trails along -x. */
function localRibbon(R: SchoolRibbon, t: number, s: number, boost: number): string {
  const len = R.len / s;
  let fwd = '';
  let back = '';
  for (let k = 0; k < SRIB_PTS; k++) {
    const age = k / (SRIB_PTS - 1);
    const x = -34 - age * len;
    const y =
      (R.lat / s) * Math.sin(R.ph + age * 3.4 + t * R.fr * 1.6) * (0.3 + age * 0.9);
    const half = (R.w / s) * Math.pow(1 - age, 1.3) * Math.min(1, 0.3 + age * 7) * boost;
    fwd += `${k ? 'L' : 'M'}${f2(x)} ${f2(y + half)} `;
    back = `L${f2(x)} ${f2(y - half)} ${back}`;
  }
  return `${fwd}${back}Z`;
}

/** One school member's pose at time `t`. */
function memberPose(
  M: SchoolSeed,
  t: number,
  ambient: number,
  resolveE: number,
  exitK: number
): Pose {
  const sw = ambient; // 0 while the school has not yet found its feet
  let x = M.bx + sw * M.ax * Math.sin(t * M.wx + M.px) + (1 - resolveE) * -26;
  let y = M.by + sw * M.ay * Math.sin(t * M.wy + M.py);
  let a = M.a0 + sw * M.ah * Math.sin(t * M.wh + M.ph);
  if (exitK > 0) {
    const e = exitK * exitK * (3 - 2 * exitK);
    x += e * (STAGE.w + 110);
    y -= e * 26;
    a -= e * 6;
  }
  return { x, y, a };
}

/**
 * The compact state, for when the keyboard is open: the school tucks into
 * one even row at the band's centre. Seven fish stay (the newcomer first,
 * at the tail); the rest fade. Nothing is ever cut in half.
 */
export const COMPACT_KEEP = 7;

function compactOf(
  M: SchoolSeed,
  i: number,
  P: Pose,
  c: number,
  compactY: number
): { P: Pose; s: number; op: number; rf: number } {
  const e = ss(c);
  const keep = i < COMPACT_KEEP;
  if (!keep) return { P, s: M.s, op: M.op * (1 - e), rf: 1 - e };
  const tx = 52 + i * 48;
  const ty = compactY + (i % 2 ? 3 : -3);
  return {
    P: { x: lerp(P.x, tx, e), y: lerp(P.y, ty, e), a: lerp(P.a, -6, e) },
    s: lerp(M.s, 0.5, e),
    op: lerp(M.op, 0.92, e),
    rf: 1 - e,
  };
}

export interface BandOptions {
  /** The clock the school sways by. Defaults to `t`. */
  ambientT?: number;
  /** 0..1: the school swims out to the right (leaving for Home). */
  exit?: number;
  /** 0..1: tuck into one row (keyboard open). */
  compact?: number;
  /** Where the compact row sits, in stage px. */
  compactY?: number;
}

/**
 * The school at rest, swaying. Used for every question screen after the
 * chapter: the settled state is simply this at t = CHAPTER_T.total.
 */
export function renderBandFrame(
  scene: ChapterScene,
  t: number,
  options: BandOptions = {}
): SchoolFish[] {
  const out = emptySchool();
  writeBand(scene, t, options, out);
  return out;
}

function writeBand(
  scene: ChapterScene,
  t: number,
  options: BandOptions,
  out: SchoolFish[]
): void {
  const compactY = options.compactY ?? BAND.y0 + BAND.h / 2;
  const amb = options.ambientT ?? t;
  const exit = options.exit ?? 0;
  const c = options.compact ?? 0;
  for (let i = 0; i < N_SCHOOL; i++) {
    const M = scene.school[i];
    const F = out[i];
    const ek = exit > 0 ? clamp((exit - M.delay * 3) / (1 - M.delay * 3), 0, 1) : 0;
    let P = memberPose(M, amb, 1, 1, ek);
    let sc = M.s;
    let op = M.op;
    let rf = 1;
    if (c > 0) {
      const cb = compactOf(M, i, P, c, compactY);
      P = cb.P;
      sc = cb.s;
      op = cb.op;
      rf = cb.rf;
    }
    F.x = P.x;
    F.y = P.y;
    F.angle = P.a;
    F.scale = sc;
    F.opacity = op;
    F.rimOpacity = clamp(0.12 + (exit > 0 ? 0.35 * ek * (1 - ek) * 4 : 0), 0, 1);
    const boost = 1 + (exit > 0 ? 1.4 * ek : 0);
    for (let r = 0; r < 2; r++) {
      const R = M.rib[r];
      F.ribbons[r].d = localRibbon(R, amb, sc, boost);
      F.ribbons[r].opacity = clamp(R.op + (exit > 0 ? 0.3 * ek : 0), 0, 0.7) * rf;
    }
  }
}

/** How far each part of the form has risen at time `t`, 0..1. */
export function formProgress(t: number): {
  header: number;
  title: number;
  support: number;
  input: number;
  cta: number;
} {
  const f = (a: number): number => ss(span(t, a, a + 0.55));
  const a = CHAPTER_T.form[0];
  return {
    header: f(a - 0.1),
    title: f(a),
    support: f(a + 0.07),
    input: f(a + 0.14),
    cta: f(a + 0.21),
  };
}

/**
 * The whole chapter at time `t` (seconds, 0..5), for the full-screen layer.
 * The school is drawn here too, so the fish that arrives and the school
 * that receives it are one set of elements from first sight to last.
 */
export function renderChapterFrame(scene: ChapterScene, seconds: number): ChapterFrame {
  const T = CHAPTER_T;
  const t = clamp(seconds, 0, T.total + 60);
  const tc = Math.min(t, T.total); // the choreography clock stops at the end
  const frame = emptyChapterFrame();
  frame.seconds = t;

  const { J, wind, strands, haze, fishMotes, school, scratch } = scene;
  const q: Pose = { x: 0, y: 0, a: 0 };
  const r: Pose = { x: 0, y: 0, a: 0 };
  const midYpx = WORD_MID_Y * K;
  const BAND_C = ((t * 168) % 760) - 120;
  const buckets: string[] = Array.from({ length: TIERS }, () => '');
  const threads: string[] = ['', '', '', ''];

  function thread(p0: Pose, pm: Pose, p2: Pose, bright: number): void {
    if (bright <= 0.05) return;
    const ti = Math.min(3, Math.max(0, Math.round(bright * 3)));
    // a quadratic that passes through the middle sample
    const qx = 2 * pm.x - 0.5 * (p0.x + p2.x);
    const qy = 2 * pm.y - 0.5 * (p0.y + p2.y);
    threads[ti] += `M${f1(p0.x)} ${f1(p0.y)}Q${f1(qx)} ${f1(qy)} ${f1(p2.x)} ${f1(p2.y)}`;
  }
  function dust(x: number, y: number, bright: number, rad: number): void {
    if (bright <= 0.05) return;
    const ti = Math.min(
      TIERS - 1,
      Math.max(0, Math.round((bright * 0.86 + rad * 0.2) * (TIERS - 1)))
    );
    buckets[ti] += `M${f1(x)} ${f1(y)}l.01 0`;
  }

  // ---- the mark and the word (opening space) ----
  const lo = ss(span(tc, T.logoOut[0], T.logoOut[1]));
  frame.open.portrait = { opacity: 1 - lo, offsetY: 18 * lo, scale: 1 - 0.05 * lo };
  frame.open.sheen = lerp(0, 118, ss(span(tc, T.release[0], T.release[1] - 0.1)));
  for (let L = 0; L < 9; L++) {
    const rank = Math.abs(L - 4);
    const d0 = T.release[0] + (4 - rank) * 0.07;
    const lp = 1 - ss(span(tc, d0, d0 + 0.34));
    frame.open.letters[L] = { opacity: lp, dy: lp < 0.999 ? -2.6 * (1 - lp) : 0 };
  }

  // ---- where the fish is, and how big ----
  const p = scene.progress(span(tc, T.swim[0], T.swim[1]));
  const dist = p * PATH.L;
  scene.pathAt(p, q);
  const sc = scene.fishScale(tc);
  const depthK = sc / HERO;
  const gather = ss(span(tc, T.join[0], T.join[0] + 0.6));
  const formOp = ss(span(tc, 1.12, 1.52));
  const joinE = ss(span(tc, 2.9, 3.55));
  const fishOp = formOp * lerp(1, MID_OP, joinE);
  const resolveE = ss(span(tc, T.resolve[0], T.resolve[1]));
  const settled = ss(span(tc, T.settle[0], T.settle[1]));
  const goldEnv =
    ss(span(tc, T.gold[0], T.gold[0] + 0.18)) *
    (1 - ss(span(tc, T.gold[1] - 0.22, T.gold[1])));
  const AXC = Math.cos(-10 * DEG);
  const AXS = Math.sin(-10 * DEG);
  const bandS = lerp(-40, 300, ss(span(tc, T.gold[0], T.gold[1])));
  const shineAt = (x: number, y: number): number => {
    const sp = (x - J.x) * AXC + (y - J.y) * AXS;
    const d = (sp - bandS) / 74;
    return goldEnv * Math.exp(-0.5 * d * d);
  };

  // ---- the school (the arriving fish is one of them) ----
  for (let m = 0; m < N_SCHOOL; m++) {
    const M = school[m];
    const F = frame.school[m];
    if (M.user) {
      // The arriving fish: path pose until it lands, then it sways like the rest.
      const wS = ss(span(tc, 3.3, 3.95));
      const sx = M.ax * Math.sin(tc * M.wx + M.px) * wS;
      const sy = M.ay * Math.sin(tc * M.wy + M.py) * wS;
      const ang = q.a + (M.a0 + M.ah * Math.sin(tc * M.wh + M.ph) - q.a) * wS;
      F.x = q.x + sx;
      F.y = q.y + sy;
      F.angle = ang;
      F.scale = sc;
      F.opacity = fishOp;
      F.rimOpacity = clamp(0.12 * joinE + 0.55 * shineAt(q.x, q.y), 0, 1);
      continue;
    }
    const vis = resolveE * clamp(resolveE * 1.25 - M.delay * 2, 0, 1);
    const ambK = ss(span(tc, T.resolve[0] + 0.2, T.resolve[1]));
    const P = memberPose(M, t, ambK, resolveE, 0);
    // make room: the nearest neighbours ease aside as the fish arrives
    const dxJ = M.bx - J.x;
    const dyJ = M.by - J.y;
    const dJ = Math.hypot(dxJ, dyJ);
    let room = Math.sin(Math.PI * span(tc, 3.2, 4.5));
    room = room * room;
    const push = (room * 9) / (1 + dJ / 55);
    P.x += (dxJ / (dJ || 1)) * push;
    P.y += (dyJ / (dJ || 1)) * push;
    F.x = P.x;
    F.y = P.y;
    F.angle = P.a;
    F.scale = M.s;
    F.opacity = M.op * vis;
    const shine = shineAt(P.x, P.y);
    const restRim = 0.12 * settled + 0.04;
    F.rimOpacity = clamp(restRim + 0.95 * shine, 0, 1);
    const boost = 1 + shine * 1.5;
    for (let k = 0; k < 2; k++) {
      const R = M.rib[k];
      F.ribbons[k].d = localRibbon(R, t, M.s, boost);
      F.ribbons[k].opacity = clamp(
        R.op * (0.6 + 0.4 * settled) * (1 + 4.2 * shine),
        0,
        0.85
      );
    }
    if (shine > 0.22) {
      const gl2 = shine * (0.65 + 0.35 * Math.sin(tc * 11 + M.px * 4));
      dust(P.x - 11 * M.s, P.y - 12 * M.s, Math.min(1, gl2 * 1.15), 0.9);
      if (shine > 0.5) dust(P.x + 9 * M.s, P.y + 8 * M.s, Math.min(1, gl2 * 0.9), 0.7);
    }
  }

  // ---- the fish is gold when it forms, then cools into ink ----
  frame.goldFish.opacity = ss(span(tc, 0.78, 1.12)) * (1 - ss(span(tc, 1.22, 1.6)));

  // ---- glow under the arriving fish ----
  const glowOp =
    fishOp *
    (0.3 + 0.16 * Math.sin(tc * 2.3)) *
    (1 - gather * 0.6) *
    (1 - ss(span(tc, 3.9, 4.4)));
  frame.glow = {
    cx: q.x,
    cy: q.y,
    r: (20 + 4 * Math.sin(tc * 1.7)) * depthK,
    opacity: Math.max(0, glowOp),
  };

  // ---- haze around the fish while it flies ----
  const hazeOn =
    ss(span(tc, T.swim[0], T.swim[0] + 0.25)) *
    (1 - ss(span(tc, T.join[0] + 0.2, T.join[0] + 0.9)));
  frame.hazeOpacity = hazeOn;
  if (hazeOn > 0.004) {
    for (let h = 0; h < N_HAZE; h++) {
      const H = haze[h];
      scene.pathAt(Math.max(0, p - H.lag), r);
      const hw = Math.sin(tc * H.fr + H.ph) * H.amp * depthK;
      const hr = (r.a + 90) * DEG;
      const dot = frame.haze[h];
      dot.cx = r.x + Math.cos(hr) * hw;
      dot.cy = r.y + Math.sin(hr) * hw;
      dot.r = H.r * depthK;
      dot.opacity = H.op;
    }
  }

  // ---- the flowing gold: five tapered ribbons behind the fish ----
  const ribOn =
    ss(span(tc, T.swim[0] + 0.05, T.swim[0] + 0.4)) *
    (1 - ss(span(tc, T.join[0] + 0.3, T.join[0] + 0.95)));
  frame.ribbonsOpacity = ribOn;
  if (ribOn > 0.004) {
    for (let ri = 0; ri < N_RIBBON; ri++) {
      const RB = strands[ri];
      const ribLen = RB.len * (1 - gather * 0.72);
      const latAmp = RB.lat * (1 - gather * 0.55);
      let fwd = '';
      let back = '';
      let any = false;
      let mid = 0;
      for (let rk = 0; rk < RIB_PTS; rk++) {
        const age = rk / (RIB_PTS - 1);
        const dd = dist - RB.lag - age * ribLen;
        if (dd < 0) break;
        scene.pathAt(dd / PATH.L, r);
        const wob = Math.sin(RB.ph + age * 3.4 + tc * RB.fr * 2.0);
        const off = latAmp * wob * (0.3 + age * 0.95) * depthK;
        const half =
          RB.w *
          Math.pow(1 - age, 1.3) *
          Math.min(1, 0.3 + age * 7) *
          (1 - gather * 0.28) *
          depthK *
          1.15;
        const rr = (r.a + 90) * DEG;
        const cxr = Math.cos(rr);
        const cyr = Math.sin(rr);
        const bx = r.x + cxr * off;
        const by = r.y + cyr * off;
        fwd += `${any ? 'L' : 'M'}${f2(bx + cxr * half)} ${f2(by + cyr * half)} `;
        back = `L${f2(bx - cxr * half)} ${f2(by - cyr * half)} ${back}`;
        if (rk === RIB_PTS >> 1) mid = bx * 0.55 + by * 0.84;
        any = true;
      }
      if (!any) continue;
      frame.ribbons[ri].d = `${fwd}${back}Z`;
      const mbd = mid - BAND_C;
      const mban = Math.exp(-(mbd * mbd) / (2 * 130 * 130));
      frame.ribbons[ri].opacity = RB.op * (0.72 + 0.46 * mban);
    }
  }

  // ---- the motes that ride the ribbons ----
  for (let i = 0; i < N_WIND; i++) {
    const W = wind[i];
    if (tc < W.b) {
      scratch.op[i] = 0;
      scratch.sh[i] = 0;
      continue;
    }
    const wage = tc - W.b;
    const ddw = dist - W.relP * PATH.L;
    if (ddw < 0) {
      scratch.op[i] = 0;
      scratch.sh[i] = 0;
      continue;
    }
    const RR = strands[W.rib];
    const aN = clamp(ddw / (RR.len * (1 - gather * 0.72)), 0, 1);
    const wob2 = Math.sin(RR.ph + aN * 3.4 + tc * RR.fr * 2.0);
    const off2 =
      (RR.lat * (1 - gather * 0.55) * wob2 * (0.3 + aN * 0.95) +
        W.jit * (0.55 + wage * 1.7)) *
      depthK;
    const rr2 = (W.relA + 90) * DEG;
    let px = W.relX + Math.cos(rr2) * off2;
    let py = W.relY + Math.sin(rr2) * off2 + W.rise * wage * wage * 0.3;
    const fl =
      Math.sin(tc * W.fr + W.ph) * W.amp * 0.35 * Math.min(1, wage * 2.2) * depthK;
    px += Math.cos(rr2) * fl;
    py += Math.sin(rr2) * fl;
    if (gather > 0) {
      px = lerp(px, q.x, gather * 0.88);
      py = lerp(py, q.y, gather * 0.88);
    }

    let lifeT = clamp(Math.max(wage / W.life, aN), 0, 1);
    if (gather > 0) {
      const far = clamp((Math.hypot(px - q.x, py - q.y) - 34) / 90, 0, 1);
      lifeT = clamp(lifeT + far * gather * 0.85, 0, 1);
    }
    let op =
      Math.min(1, wage / 0.07) *
      (1 - lifeT * lifeT) *
      (1 - ss(span(tc, T.join[0] + 0.35, T.join[0] + 0.95)));
    op = clamp(op, 0, 1);
    const gl = Math.pow(Math.max(0, Math.sin(tc * W.gf + W.gp)), 6);
    const axis = px * 0.55 + py * 0.84;
    const bandD = axis - BAND_C;
    const band = Math.exp(-(bandD * bandD) / (2 * 112 * 112));
    const shine2 = Math.min(1, gl * 0.85 + band * 0.8);
    op = Math.min(1, op * (1 + 0.42 * band));
    scratch.px[i] = px;
    scratch.py[i] = py;
    scratch.op[i] = op;
    scratch.sh[i] = shine2;
    dust(
      px,
      py,
      Math.min(1, op * (0.28 + 0.8 * shine2) * (0.44 + 0.74 * W.tb)) * 0.7,
      W.r * (1 - 0.24 * lifeT) * Math.max(0.7, depthK)
    );
  }

  // ---- the word becomes the fish: motes fly from the letters to the outline ----
  const rot0 = scene.startAngle * DEG;
  const ca0 = Math.cos(rot0);
  const sa0 = Math.sin(rot0);
  const cur: Pose = { x: 0, y: 0, a: 0 };
  const mid: Pose = { x: 0, y: 0, a: 0 };
  const prv: Pose = { x: 0, y: 0, a: 0 };
  for (let j = 0; j < N_FISH; j++) {
    if (j & 1) continue;
    const FP = fishMotes[j];
    const rk2 = Math.abs(FP.li - 4);
    const st0 = T.release[0] + (4 - rk2) * 0.07 + FP.delay;
    const w = span(tc, st0, st0 + 0.66);
    if (w <= 0 || w >= 1) continue;
    const lxp = FP.src[0] * HERO;
    const lyp = FP.src[1] * HERO;
    const ex = F0.x + lxp * ca0 - lyp * sa0; // on the fish
    const ey = F0.y + lxp * sa0 + lyp * ca0;
    const bx0 = LETTER_X[FP.li] * K + OX + FP.jx * K; // in the letter
    const by0 = midYpx + FP.jy * K;
    const mx = (bx0 + ex) / 2;
    const my = (by0 + ey) / 2;
    const nx = -(ey - by0);
    const ny = ex - bx0;
    const nl = Math.hypot(nx, ny) || 1;
    const cx2 = mx + (nx / nl) * FP.curl * K * 0.8;
    const cy2 = my + (ny / nl) * FP.curl * K * 0.8;
    const bez = (wv: number, out: Pose): void => {
      const e = ss(wv);
      const m = 1 - e;
      out.x = m * m * bx0 + 2 * m * e * cx2 + e * e * ex;
      out.y = m * m * by0 + 2 * m * e * cy2 + e * e * ey;
    };
    bez(w, cur);
    bez(Math.max(0, w - 0.23), mid);
    bez(Math.max(0, w - 0.46), prv);
    const fop = Math.min(1, w / 0.12) * (1 - ss(span(w, 0.78, 1)));
    const fax = cur.x * 0.55 + cur.y * 0.84;
    const fbd = fax - BAND_C;
    const fsh = Math.exp(-(fbd * fbd) / (2 * 112 * 112));
    thread(prv, mid, cur, Math.min(1, fop * (0.55 + 0.6 * fsh) * (0.6 + 0.55 * FP.tb)));
  }

  for (let ti = 0; ti < 4; ti++) {
    frame.streaks[ti].d = threads[ti];
    frame.streaks[ti].opacity = threads[ti] ? 0.5 + ti * 0.16 : 0;
  }
  for (let ti = 0; ti < TIERS; ti++) {
    frame.tiers[ti].d = buckets[ti];
    frame.tiers[ti].opacity = buckets[ti] ? 0.3 + (ti / (TIERS - 1)) * 0.7 : 0;
  }
  for (let bi = 0; bi < N_BLOOM; bi++) {
    const wi = (bi * 13 + 5) % N_WIND;
    const dot = frame.blooms[bi];
    if (scratch.op[wi] <= 0.05 || scratch.sh[wi] <= 0.4) {
      dot.opacity = 0;
      continue;
    }
    dot.cx = scratch.px[wi];
    dot.cy = scratch.py[wi];
    dot.r = 2.0 + wind[wi].r * 5.0;
    dot.opacity = scratch.sh[wi] * scratch.op[wi] * 0.4;
  }

  return frame;
}
