/**
 * One frame of the opening, as a pure function of time.
 *
 *   renderOpeningFrame(scene, seconds) -> OpeningFrame
 *
 * The frame holds every number and path string the renderer needs and
 * nothing else: no elements, no state, no clock. That is the whole point
 * of the split. The same function drives playback, the reduced-motion
 * still, the tests, and the pixel comparison against the approved film.
 *
 * It is a line-for-line port of the approved engine's `render(t)`. The
 * comments that explain WHY a beat is built the way it is are the film's
 * own and are kept: they record decisions the owner already approved.
 */
import {
  FISH_SCALE,
  LETTER_X,
  N_BLOOM,
  N_FISH,
  N_HAZE,
  N_RIBBON,
  N_WIND,
  OPENING_DURATION,
  RIB_PTS,
  SPEED,
  T,
  TIERS,
  WORD_MID_Y,
  WORD_TEXT,
} from './constants';
import { clamp, lerp, smoothstep as ss, span } from './math';
import type { FlightPose, OpeningScene } from './scene';

export interface Dot {
  cx: number;
  cy: number;
  r: number;
  opacity: number;
}

export interface OpeningFrame {
  /** The clamped wall-clock time this frame shows, in seconds. */
  seconds: number;
  logo: { opacity: number; scale: number };
  hazeOpacity: number;
  haze: Dot[];
  ribbonsOpacity: number;
  ribbons: { d: string; opacity: number }[];
  glow: Dot;
  fish: { opacity: number; x: number; y: number; angle: number };
  blooms: Dot[];
  tiers: { d: string; opacity: number }[];
  /** Horizontal travel of the wordmark's sheen. */
  sheen: number;
  letters: { opacity: number; dy: number }[];
}

/**
 * Style of brightness tier `i`: which of the four dust colours it takes
 * and how thick its round-capped dots are. Brighter motes are also
 * bigger -- catching the light is what makes a speck read as larger.
 */
export function tierStyle(i: number): { dust: 0 | 1 | 2 | 3; width: number } {
  const f = i / (TIERS - 1);
  return {
    dust: f < 0.28 ? 0 : f < 0.56 ? 1 : f < 0.82 ? 2 : 3,
    width: Number((0.62 + f * 1.33).toFixed(2)),
  };
}

const f1 = (v: number): string => v.toFixed(1);
const f2 = (v: number): string => v.toFixed(2);

const DEG = Math.PI / 180;

/** A frame with nothing on screen, before the first beat. */
export function emptyFrame(): OpeningFrame {
  const dot = (): Dot => ({ cx: -50, cy: -50, r: 6, opacity: 0 });
  return {
    seconds: 0,
    logo: { opacity: 0, scale: 0.94 },
    hazeOpacity: 0,
    haze: Array.from({ length: N_HAZE }, dot),
    ribbonsOpacity: 0,
    ribbons: Array.from({ length: N_RIBBON }, () => ({ d: '', opacity: 0 })),
    glow: { cx: -99, cy: -99, r: 26, opacity: 0 },
    fish: { opacity: 0, x: 0, y: 0, angle: 0 },
    blooms: Array.from({ length: N_BLOOM }, dot),
    tiers: Array.from({ length: TIERS }, () => ({ d: '', opacity: 0 })),
    sheen: -118,
    letters: Array.from({ length: WORD_TEXT.length }, () => ({ opacity: 0, dy: 2.6 })),
  };
}

export function renderOpeningFrame(
  scene: OpeningScene,
  wallSeconds: number
): OpeningFrame {
  const seconds = clamp(wallSeconds, 0, OPENING_DURATION);
  const t = seconds / SPEED;
  const { flight, wind, ribbons: strands, haze: hazeSeeds, scratch } = scene;
  const FLEN = flight.length;
  const q: FlightPose = { x: 0, y: 0, a: 0 };
  const r: FlightPose = { x: 0, y: 0, a: 0 };

  const frame = emptyFrame();
  frame.seconds = seconds;

  const midY = WORD_MID_Y;
  // The specular sweep, cycling slowly through the scene's diagonal.
  const BAND_C = ((t * 168) % 760) - 120;
  const buckets: string[] = [];
  for (let i = 0; i < TIERS; i++) buckets.push('');

  function dust(x: number, y: number, bright: number, rad: number): void {
    if (bright <= 0.05) return;
    const ti = Math.min(
      TIERS - 1,
      Math.max(0, Math.round((bright * 0.86 + rad * 0.2) * (TIERS - 1)))
    );
    // A tiny round-capped segment renders as a dot whose diameter is the
    // tier's stroke width. (The film used a zero-length one; 0.01 units
    // is the same dot, but cannot be dropped by a path engine that
    // discards degenerate segments.)
    buckets[ti] += `M${f1(x)} ${f1(y)}l.01 0`;
  }

  // ---- the logo, present from the first half-second ----
  const inLogo = ss(span(t, T.logoIn[0], T.logoIn[1]));
  frame.logo.opacity = inLogo;
  frame.logo.scale = lerp(0.94, 1, inLogo);

  // ---- where the fish is ----
  const p = scene.progress(span(t, T.flight[0], T.flight[1]));
  const dist = p * FLEN;
  flight.at(p, q);
  const gather = ss(span(t, T.gather[0], T.gather[1]));
  const diss = ss(span(t, T.dissolve[0], T.dissolve[1]));
  const fishOp =
    ss(span(t, T.flight[0], T.flight[0] + 0.14)) *
    (1 - ss(span(t, T.dissolve[0], T.dissolve[0] + 0.26)));

  // ONE heading, used for the fish and for where its motes come from, so
  // the two can never disagree.
  const ang = q.a;
  frame.fish.opacity = fishOp;
  frame.fish.x = q.x;
  frame.fish.y = q.y;
  frame.fish.angle = ang;

  const glowOp = fishOp * (0.34 + 0.2 * Math.sin(t * 2.3));
  frame.glow.cx = q.x;
  frame.glow.cy = q.y;
  frame.glow.r = 20 + 4 * Math.sin(t * 1.7);
  frame.glow.opacity = Math.max(0, glowOp);

  // ---- haze: the cloud the fish moves inside ----
  const hazeOn =
    ss(span(t, T.flight[0], T.flight[0] + 0.22)) *
    (1 - ss(span(t, T.dissolve[0], T.dissolve[1] - 0.1)));
  frame.hazeOpacity = hazeOn;
  if (hazeOn > 0.004) {
    for (let h = 0; h < N_HAZE; h++) {
      const H = hazeSeeds[h];
      flight.at(Math.max(0, p - H.lag), r);
      const hw = Math.sin(t * H.fr + H.ph) * H.amp;
      const hr = (r.a + 90) * DEG;
      const dot = frame.haze[h];
      dot.cx = r.x + Math.cos(hr) * hw;
      dot.cy = r.y + Math.sin(hr) * hw;
      dot.r = H.r;
      dot.opacity = H.op;
    }
  }

  // ---- THE FLOWING GOLD ----
  // Each ribbon is sampled along the path behind the fish, given a lateral
  // drift that grows toward its tail, and closed into a tapered shape. Its
  // width fades to zero at the tail, so the gold streams and thins instead
  // of ending on a hard edge.
  const ribOn =
    ss(span(t, T.flight[0], T.flight[0] + 0.2)) *
    (1 - ss(span(t, T.dissolve[0] - 0.06, T.dissolve[0] + 0.3)));
  frame.ribbonsOpacity = ribOn;
  if (ribOn > 0.004) {
    for (let ri = 0; ri < N_RIBBON; ri++) {
      const R = strands[ri];
      // The gather shortens and tightens each ribbon toward the fish.
      const ribLen = R.len * (1 - gather * 0.72);
      const latAmp = R.lat * (1 - gather * 0.55);
      let fwd = '';
      let back = '';
      let any = false;
      let mid = 0;
      for (let rk = 0; rk < RIB_PTS; rk++) {
        const age = rk / (RIB_PTS - 1);
        const dd = dist - R.lag - age * ribLen;
        if (dd < 0) break;
        flight.at(dd / FLEN, r);
        const wob = Math.sin(R.ph + age * 3.4 + t * R.fr * 2.0);
        const off = latAmp * wob * (0.3 + age * 0.95);
        const half =
          R.w * Math.pow(1 - age, 1.3) * Math.min(1, 0.3 + age * 7) * (1 - gather * 0.28);
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
      // The specular band travelling through lifts whichever ribbon it is
      // crossing, so the shimmer moves along the flow.
      const mbd = mid - BAND_C;
      const mban = Math.exp(-(mbd * mbd) / (2 * 130 * 130));
      frame.ribbons[ri].opacity = R.op * (0.72 + 0.46 * mban);
    }
  }

  // ---- THE CARRIED GOLD ----
  // Each mote is released at the fish's position, drifts off its tail at a
  // speed set by how fast the fish was going, and flutters as it fades.
  // When the fish slows, the motes it sheds barely move -- so the cloud
  // gathers around it without being told to.
  for (let i = 0; i < N_WIND; i++) {
    const W = wind[i];
    if (t < W.b) {
      scratch.op[i] = 0;
      scratch.sh[i] = 0;
      continue;
    }
    const age = t - W.b;

    // A mote does NOT spray off the tail into open air -- that read as
    // speckle scattered around the fish. It is released onto one of the
    // ribbons and stays IN it, so the sparkle lives inside the gold. Its
    // station is the path distance the fish had reached when it was shed;
    // the fish moving on is what carries the ribbon past it.
    const dd = dist - W.relDist;
    if (dd < 0) {
      scratch.op[i] = 0;
      scratch.sh[i] = 0;
      continue;
    }

    const R = strands[W.rib];
    const aN = clamp(dd / (R.len * (1 - gather * 0.72)), 0, 1);
    const wob = Math.sin(R.ph + aN * 3.4 + t * R.fr * 2.0);
    const off =
      R.lat * (1 - gather * 0.55) * wob * (0.3 + aN * 0.95) + W.jit * (0.55 + age * 1.7);
    const rr = (W.relA + 90) * DEG;
    let px = W.relX + Math.cos(rr) * off;
    let py = W.relY + Math.sin(rr) * off + W.rise * age * age * 0.3;
    const fl = Math.sin(t * W.fr + W.ph) * W.amp * 0.35 * Math.min(1, age * 2.2);
    px += Math.cos(rr) * fl;
    py += Math.sin(rr) * fl;

    // THE GATHER. Pulled most of the way in, not half: at 0.55 the cloud
    // stayed a wide ring around the mark and then slid off to the word as
    // a ring, so the beat never read as gathering.
    if (gather > 0) {
      px = lerp(px, q.x, gather * 0.88);
      py = lerp(py, q.y, gather * 0.88);
    }
    // then the gold flows into the letters
    if (diss > 0) {
      const e = ss(diss);
      px = lerp(px, LETTER_X[W.li], e);
      py = lerp(py, midY, e);
    }

    let lifeT = clamp(Math.max(age / W.life, aN), 0, 1);
    // Anything still far from the fish when the gather starts is old trail.
    // It dies where it is rather than being dragged along, which is what
    // kept a ghost ring hanging around the mark.
    if (gather > 0) {
      const far = clamp((Math.hypot(px - q.x, py - q.y) - 34) / 90, 0, 1);
      lifeT = clamp(lifeT + far * gather * 0.85, 0, 1);
    }
    let op =
      Math.min(1, age / 0.07) *
      (1 - lifeT * lifeT) *
      (1 - ss(span(t, T.letters[0] + 0.18, T.letters[1])));
    if (gather > 0) op = Math.max(op, op * 0.4 + 0.45 * gather * (1 - lifeT * 0.55));
    op = clamp(op, 0, 1);
    const gl = Math.pow(Math.max(0, Math.sin(t * W.gf + W.gp)), 6);
    // A specular band travelling through the cloud: motes lying on it
    // catch the light together, the way a sheet of metal does when it
    // turns. This is what makes the gold look lit rather than tinted.
    const axis = px * 0.55 + py * 0.84;
    const bandD = axis - BAND_C;
    const band = Math.exp(-(bandD * bandD) / (2 * 112 * 112));
    const shine = Math.min(1, gl * 0.85 + band * 0.8);
    op = Math.min(1, op * (1 + 0.42 * band));
    scratch.px[i] = px;
    scratch.py[i] = py;
    scratch.op[i] = op;
    scratch.sh[i] = shine;
    dust(
      px,
      py,
      Math.min(1, op * (0.28 + 0.8 * shine) * (0.44 + 0.74 * W.tb)) * 0.7,
      W.r * (1 - 0.24 * lifeT)
    );
  }

  // ---- THE FISH BECOMES THE WORD ----
  // Motes taken from points ON the fish outline, at its final pose, each
  // flying to the letter it belongs to. Centre letters first.
  const ca = Math.cos(ang * DEG);
  const sa = Math.sin(ang * DEG);
  for (let j = 0; j < N_FISH; j++) {
    const F = scene.fish[j];
    const st0 = T.dissolve[0] + F.delay + Math.abs(F.li - 4) * 0.045;
    const w = span(t, st0, st0 + 0.58);
    if (w <= 0) continue;

    const lxp = F.src[0] * FISH_SCALE;
    const lyp = F.src[1] * FISH_SCALE;
    const sx = q.x + lxp * ca - lyp * sa;
    const sy = q.y + lxp * sa + lyp * ca;
    const tx = LETTER_X[F.li] + F.jx;
    const ty = midY + F.jy;

    const mx = (sx + tx) / 2;
    const my = (sy + ty) / 2;
    const nx = -(ty - sy);
    const ny = tx - sx;
    const nl = Math.hypot(nx, ny) || 1;
    const cx2 = mx + (nx / nl) * F.curl;
    const cy2 = my + (ny / nl) * F.curl;

    const e2 = ss(w);
    const m2 = 1 - e2;
    const qx = m2 * m2 * sx + 2 * m2 * e2 * cx2 + e2 * e2 * tx;
    const qy = m2 * m2 * sy + 2 * m2 * e2 * cy2 + e2 * e2 * ty;

    const fop = Math.min(1, w / 0.1) * (1 - ss(span(w, 0.7, 1)));
    const fax = qx * 0.55 + qy * 0.84;
    const fbd = fax - BAND_C;
    const fsh = Math.exp(-(fbd * fbd) / (2 * 112 * 112));
    dust(
      qx,
      qy,
      Math.min(1, fop * (0.38 + 0.74 * fsh) * (0.5 + 0.7 * F.tb)),
      F.r * (1 - 0.3 * e2)
    );
  }

  // ---- flush the tiers: eight paths carry every mote on screen ----
  for (let ti = 0; ti < TIERS; ti++) {
    frame.tiers[ti].d = buckets[ti];
    frame.tiers[ti].opacity = buckets[ti] ? 0.3 + (ti / (TIERS - 1)) * 0.7 : 0;
  }

  // ---- the bloom, on the brightest motes only ----
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

  // ---- the sheen crosses the wordmark as it forms, then settles centred ----
  frame.sheen = lerp(-118, 0, ss(span(t, T.letters[0], T.letters[1] + 0.12)));

  // ---- the letters light as their gold arrives, centre outward ----
  for (let L = 0; L < WORD_TEXT.length; L++) {
    const d0 = T.letters[0] + Math.abs(L - 4) * 0.055;
    const lp = ss(span(t, d0, d0 + 0.3));
    frame.letters[L].opacity = lp;
    frame.letters[L].dy = lp < 0.999 ? lerp(2.6, 0, lp) : 0;
  }

  return frame;
}
