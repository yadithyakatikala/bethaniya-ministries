import {
  FISH_SCALE,
  LETTER_X,
  N_BLOOM,
  N_HAZE,
  N_RIBBON,
  N_WIND,
  OPENING_DURATION,
  SPEED,
  T,
  TIERS,
  WORD_MID_Y,
  WORD_TEXT,
} from '../engine/constants';
import { renderOpeningFrame, type OpeningFrame } from '../engine/frame';
import { createOpeningScene, getOpeningScene, type FlightPose } from '../engine/scene';
import golden from './fixtures/openingGolden.json';

/**
 * The opening is a port of an approved film, so these tests are of two
 * kinds: characterisation tests pinned to numbers measured from the
 * ORIGINAL engine (./fixtures/openingGolden.json, captured in a browser
 * by scripts/opening-fidelity), and behavioural tests of the properties
 * the owner asked for -- a fish that never flips or spins, a gold that
 * becomes the word, a film that ends on the wordmark.
 */
const scene = getOpeningScene();

function dotsOf(frame: OpeningFrame): [number, number][] {
  const dots: [number, number][] = [];
  for (const tier of frame.tiers) {
    for (const m of tier.d.matchAll(/M(-?[\d.]+) (-?[\d.]+)/g)) {
      dots.push([Number(m[1]), Number(m[2])]);
    }
  }
  return dots;
}

describe('the approved timing', () => {
  it('is the 4.02 s film played at 1.34x -- the 5.4 s the owner exported', () => {
    expect(SPEED).toBe(1.34);
    expect(T.total).toBe(4.02);
    expect(OPENING_DURATION).toBeCloseTo(5.3868, 4);
    expect(golden.duration).toBeCloseTo(OPENING_DURATION, 4);
  });

  it('keeps every beat in order', () => {
    expect(T.logoIn[1]).toBeLessThanOrEqual(T.flight[0]);
    expect(T.flight[0]).toBeLessThan(T.gather[0]);
    // The gather overlaps the end of the flight, and the dissolve starts
    // before the flight ends: the gold is in motion throughout.
    expect(T.gather[0]).toBeLessThan(T.flight[1]);
    expect(T.dissolve[0]).toBeLessThan(T.flight[1]);
    expect(T.dissolve[1]).toBeLessThan(T.letters[1]);
    expect(T.letters[1]).toBeLessThanOrEqual(T.hold[0]);
    expect(T.hold[1]).toBe(T.total);
  });
});

describe('the scene', () => {
  it('is built the same way every time', () => {
    const a = createOpeningScene();
    const b = createOpeningScene();
    expect(a.wind).toEqual(b.wind);
    expect(a.fish).toEqual(b.fish);
    expect(a.ribbons).toEqual(b.ribbons);
    expect(a.haze).toEqual(b.haze);
  });

  it('has the approved particle budget', () => {
    expect(scene.wind).toHaveLength(N_WIND);
    expect(scene.ribbons).toHaveLength(N_RIBBON);
    expect(scene.haze).toHaveLength(N_HAZE);
    expect(scene.fish).toHaveLength(120);
  });

  it('draws the same particles as the approved film', () => {
    const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 9);
    golden.particles.wind.forEach((g, k) => {
      const w = scene.wind[[0, 47, 95][k]];
      for (const key of [
        'b',
        'jit',
        'rise',
        'life',
        'amp',
        'fr',
        'ph',
        'r',
        'tb',
        'gf',
        'gp',
      ] as const) {
        near(w[key], g[key]);
      }
      expect(w.rib).toBe(g.rib);
      expect(w.li).toBe(g.li);
    });
    golden.particles.fish.forEach((g, k) => {
      const f = scene.fish[[0, 60, 119][k]];
      for (const key of ['delay', 'tb', 'curl', 'r', 'jx', 'jy'] as const)
        near(f[key], g[key]);
      expect(f.li).toBe(g.li);
      expect(f.src[0]).toBeCloseTo(g.src[0], 3);
      expect(f.src[1]).toBeCloseTo(g.src[1], 3);
    });
    golden.particles.ribbons.forEach((g, k) => {
      for (const key of ['lag', 'len', 'lat', 'w', 'fr', 'ph', 'op'] as const) {
        near(scene.ribbons[k][key], g[key]);
      }
    });
    golden.particles.haze.forEach((g, k) => {
      const h = scene.haze[[0, 13][k]];
      for (const key of ['lag', 'r', 'op', 'amp', 'fr', 'ph'] as const)
        near(h[key], g[key]);
    });
  });

  it('flies the approved path: in from the lower right, to rest below the mark', () => {
    expect(scene.flight.length).toBeCloseTo(golden.flight.length, 0);
    const pose: FlightPose = { x: 0, y: 0, a: 0 };
    for (const sample of golden.flight.samples) {
      scene.flight.at(sample.i / 799, pose);
      expect(pose.x).toBeCloseTo(sample.x, 1);
      expect(pose.y).toBeCloseTo(sample.y, 1);
      expect(pose.a).toBeCloseTo(sample.a, 1);
    }
    scene.flight.at(0, pose);
    expect(pose.x).toBeGreaterThan(320); // enters from beyond the right edge
    scene.flight.at(1, pose);
    expect([pose.x, pose.y]).toEqual([160, 390]); // ends just below the mark
  });
});

describe('frames match the approved film', () => {
  it.each(golden.frames.map((f) => [f.t, f] as const))('at %s s', (_t, g) => {
    const f = renderOpeningFrame(scene, g.t);
    const tol = 0.02;

    expect(f.logo.opacity).toBeCloseTo(g.logo.opacity, 2);
    expect(f.logo.scale).toBeCloseTo(g.logo.scale, 3);
    expect(f.fish.opacity).toBeCloseTo(g.fish.opacity, 2);
    expect(Math.abs(f.fish.x - g.fish.x)).toBeLessThan(tol);
    expect(Math.abs(f.fish.y - g.fish.y)).toBeLessThan(tol);
    expect(Math.abs(f.fish.angle - g.fish.angle)).toBeLessThan(0.05);
    expect(Math.abs(f.glow.cx - g.glow.cx)).toBeLessThan(tol);
    expect(Math.abs(f.glow.r - g.glow.r)).toBeLessThan(tol);
    expect(f.glow.opacity).toBeCloseTo(g.glow.opacity, 2);
    expect(f.hazeOpacity).toBeCloseTo(g.hazeOpacity, 2);
    expect(f.ribbonsOpacity).toBeCloseTo(g.ribbonsOpacity, 2);
    // The film leaves a hidden ribbon's opacity as it was; only compare
    // the ribbons that are actually on screen.
    if (g.ribbonsOpacity > 0.004) {
      f.ribbons.forEach((r, i) => {
        if (r.d !== '') expect(r.opacity).toBeCloseTo(g.ribbonOpacities[i], 2);
      });
    }
    expect(f.sheen).toBeCloseTo(g.sheen, 0);
    f.letters.forEach((l, i) => {
      expect(l.opacity).toBeCloseTo(g.letters[i].opacity, 2);
      expect(Math.abs(l.dy - g.letters[i].dy)).toBeLessThan(0.02);
    });
    f.blooms.forEach((b, i) => expect(b.opacity).toBeCloseTo(g.blooms[i], 2));

    // The motes: the same number in every tier, in the same places.
    f.tiers.forEach((tier, i) => {
      expect((tier.d.match(/M/g) ?? []).length).toBe(g.dotsPerTier[i]);
      expect(tier.opacity).toBeCloseTo(g.tierOpacities[i], 2);
    });
    const dots = dotsOf(f);
    const sx = dots.reduce((s, d) => s + d[0], 0);
    const sy = dots.reduce((s, d) => s + d[1], 0);
    // One decimal of rounding per dot, so allow a tenth per dot.
    const slack = Math.max(0.2, dots.length * 0.1);
    expect(Math.abs(sx - g.dotChecksum.x)).toBeLessThan(slack);
    expect(Math.abs(sy - g.dotChecksum.y)).toBeLessThan(slack);
  });
});

describe('a frame is a pure function of time', () => {
  it('does not depend on what was drawn before it', () => {
    const first = renderOpeningFrame(scene, 2.6);
    renderOpeningFrame(scene, 4.9);
    renderOpeningFrame(scene, 0.3);
    expect(renderOpeningFrame(scene, 2.6)).toEqual(first);
  });

  it('clamps time to the film', () => {
    expect(renderOpeningFrame(scene, -3)).toEqual(renderOpeningFrame(scene, 0));
    expect(renderOpeningFrame(scene, 99)).toEqual(
      renderOpeningFrame(scene, OPENING_DURATION)
    );
    expect(renderOpeningFrame(scene, 99).seconds).toBe(OPENING_DURATION);
  });

  it('always supplies every slot the renderer draws', () => {
    for (const s of [0, 1, 2.5, 4, OPENING_DURATION]) {
      const f = renderOpeningFrame(scene, s);
      expect(f.haze).toHaveLength(N_HAZE);
      expect(f.ribbons).toHaveLength(N_RIBBON);
      expect(f.blooms).toHaveLength(N_BLOOM);
      expect(f.tiers).toHaveLength(TIERS);
      expect(f.letters).toHaveLength(WORD_TEXT.length);
    }
  });
});

describe('the story the film tells', () => {
  it('begins with the portrait alone, then fades it in', () => {
    const first = renderOpeningFrame(scene, 0);
    expect(first.logo.opacity).toBe(0);
    expect(first.fish.opacity).toBe(0);
    expect(dotsOf(first)).toHaveLength(0);
    const settled = renderOpeningFrame(scene, T.logoIn[1] * SPEED);
    expect(settled.logo.opacity).toBeCloseTo(1, 5);
    expect(settled.logo.scale).toBeCloseTo(1, 5);
    // Nothing else has started: "the logo waits".
    expect(settled.fish.opacity).toBe(0);
  });

  it('carries gold with the fish: ribbons and motes stream behind it in flight', () => {
    const f = renderOpeningFrame(scene, 1.5 * SPEED);
    expect(f.fish.opacity).toBe(1);
    expect(f.ribbonsOpacity).toBeGreaterThan(0.9);
    expect(f.ribbons.filter((r) => r.d !== '').length).toBeGreaterThanOrEqual(3);
    expect(dotsOf(f).length).toBeGreaterThan(10);
  });

  it('turns the fish into gold that flows into the letters', () => {
    // Midway through the dissolve the fish has gone and the dust is in motion.
    const mid = renderOpeningFrame(scene, 2.8 * SPEED);
    expect(mid.fish.opacity).toBeLessThan(0.05);
    expect(dotsOf(mid).length).toBeGreaterThan(100);

    // When the word forms, every carried mote has landed on its letter:
    // on the word's centre line, within the span of the nine letters.
    const forming = renderOpeningFrame(scene, 3.4 * SPEED);
    const dots = dotsOf(forming);
    expect(dots).toHaveLength(N_WIND);
    for (const [x, y] of dots) {
      expect(Math.abs(y - WORD_MID_Y)).toBeLessThan(0.2);
      expect(x).toBeGreaterThan(LETTER_X[0] - 1);
      expect(x).toBeLessThan(LETTER_X[LETTER_X.length - 1] + 1);
    }
  });

  it('lights the letters from the centre outward', () => {
    const f = renderOpeningFrame(scene, (T.letters[0] + 0.08) * SPEED);
    const centre = f.letters[4].opacity;
    expect(centre).toBeGreaterThan(f.letters[3].opacity);
    expect(f.letters[3].opacity).toBeGreaterThanOrEqual(f.letters[2].opacity);
    expect(f.letters[2].opacity).toBeGreaterThanOrEqual(f.letters[0].opacity);
    expect(f.letters[0].opacity).toBeCloseTo(f.letters[8].opacity, 6);
  });

  it('ends on the portrait over the wordmark -- no fish, no ribbons', () => {
    const end = renderOpeningFrame(scene, OPENING_DURATION);
    expect(end.logo.opacity).toBe(1);
    expect(end.fish.opacity).toBe(0);
    expect(end.ribbonsOpacity).toBe(0);
    expect(end.hazeOpacity).toBe(0);
    expect(end.sheen).toBe(0);
    end.letters.forEach((l) => {
      expect(l.opacity).toBe(1);
      expect(l.dy).toBe(0);
    });
  });
});

describe('the fish never flips, tumbles or spins', () => {
  /** Heading of the fish at every 60 fps frame while it is on screen. */
  function headings(fps: number): number[] {
    const out: number[] = [];
    for (let s = 0; s <= OPENING_DURATION; s += 1 / fps) {
      const f = renderOpeningFrame(scene, s);
      if (f.fish.opacity > 0.01) out.push(f.fish.angle);
    }
    return out;
  }

  it('turns smoothly: never more than 6 degrees between 60 fps frames', () => {
    const h = headings(60);
    expect(h.length).toBeGreaterThan(100);
    let worst = 0;
    for (let i = 1; i < h.length; i++) worst = Math.max(worst, Math.abs(h[i] - h[i - 1]));
    // The raw tangent of this path swings ~93 degrees in 0.16 s; the film
    // low-passes the heading, which is what holds this under 6.
    expect(worst).toBeLessThan(6);
  });

  it('is just as smooth at 120 fps (no per-frame jitter hiding in a coarser sample)', () => {
    const h = headings(120);
    let worst = 0;
    for (let i = 1; i < h.length; i++) worst = Math.max(worst, Math.abs(h[i] - h[i - 1]));
    expect(worst).toBeLessThan(3);
  });

  it('faces the way it is flying: its heading is its direction of travel', () => {
    // Sample the position over 1/60 s and compare the motion to the heading.
    let checked = 0;
    for (let s = 1.3; s < 2.8; s += 0.1) {
      const a = renderOpeningFrame(scene, s);
      const b = renderOpeningFrame(scene, s + 1 / 120);
      const motion =
        (Math.atan2(b.fish.y - a.fish.y, b.fish.x - a.fish.x) * 180) / Math.PI;
      let diff = Math.abs(motion - a.fish.angle) % 360;
      if (diff > 180) diff = 360 - diff;
      // The heading is deliberately low-passed, so allow it to lag a bend.
      expect(diff).toBeLessThan(35);
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('never jumps: no frame moves it more than 10 scene units', () => {
    let worst = 0;
    let prev: OpeningFrame | null = null;
    for (let s = 0; s <= OPENING_DURATION; s += 1 / 60) {
      const f = renderOpeningFrame(scene, s);
      if (prev && prev.fish.opacity > 0 && f.fish.opacity > 0) {
        worst = Math.max(
          worst,
          Math.hypot(f.fish.x - prev.fish.x, f.fish.y - prev.fish.y)
        );
      }
      prev = f;
    }
    expect(worst).toBeGreaterThan(1); // it does fly
    expect(worst).toBeLessThan(10);
  });

  it('has already faded into gold by the time the flight ends', () => {
    // The fish stops where the gold gathers, so it is dissolving as it arrives.
    expect(renderOpeningFrame(scene, T.flight[1] * SPEED).fish.opacity).toBeLessThan(0.2);
    expect(renderOpeningFrame(scene, (T.dissolve[1] + 0.05) * SPEED).fish.opacity).toBe(
      0
    );
  });

  it('draws the fish at the approved size', () => {
    expect(FISH_SCALE).toBe(0.58);
  });
});
