import {
  BAND,
  CHAPTER_T,
  COMPACT_KEEP,
  F0,
  HERO,
  K,
  N_SCHOOL,
  OX,
  RESUME_START,
  STAGE,
  formProgress,
  getChapterScene,
  renderBandFrame,
  renderChapterFrame,
  type Pose,
} from '../engine/chapter';
import { LOGO, OPENING_DURATION } from '../engine/constants';
import { renderOpeningFrame } from '../engine/frame';
import { getOpeningScene } from '../engine/scene';
import golden from './fixtures/chapterGolden.json';

/**
 * The onboarding chapter is a port of an approved prototype, so like the
 * opening it is tested two ways: pinned to numbers measured from the
 * prototype itself (./fixtures/chapterGolden.json, captured in a browser
 * by scripts/opening-fidelity), and against the properties the story needs.
 */
const scene = getChapterScene();

describe('the approved chapter', () => {
  it('is five seconds, with a shorter version for somebody who has seen it', () => {
    expect(CHAPTER_T.total).toBe(5);
    expect(RESUME_START).toBeGreaterThan(CHAPTER_T.resolve[0]);
    // About two seconds: the school and the arrival, without the word and the flight.
    expect(CHAPTER_T.total - RESUME_START).toBeGreaterThan(1.8);
    expect(CHAPTER_T.total - RESUME_START).toBeLessThan(2.3);
  });

  it('keeps its beats in order: word to fish, the journey, the school, the question', () => {
    const T = CHAPTER_T;
    // Each beat begins after the one before it. They overlap by design --
    // the fish is already moving as it finishes forming -- so it is the
    // starts that are ordered, and nothing may run past the end.
    const starts = [
      T.release[0],
      T.formed[0],
      T.swim[0],
      T.resolve[0],
      T.join[0],
      T.gold[0],
      T.form[0],
      T.settle[0],
    ];
    expect(starts).toEqual([...starts].sort((x, y) => x - y));
    expect(new Set(starts).size).toBe(starts.length);
    const beats = [
      T.release,
      T.formed,
      T.swim,
      T.resolve,
      T.join,
      T.gold,
      T.form,
      T.settle,
    ];
    beats.forEach((beat) => expect(beat[1]).toBeLessThanOrEqual(T.total));
    expect(T.settle[1]).toBe(T.total);
  });

  it('places the opening scene on the reference phone exactly as the opening places itself', () => {
    expect(STAGE).toEqual({ w: 390, h: 844 });
    expect(K).toBeCloseTo(1.27879, 4);
    expect(OX).toBeCloseTo(-9.6, 1);
    expect(HERO).toBeCloseTo(0.58 * K, 6);
    // The fish re-forms where the word's centre was.
    expect(F0.x).toBeCloseTo(golden.path.F0.x, 6);
    expect(F0.y).toBeCloseTo(golden.path.F0.y, 6);
  });
});

describe('the journey and the school match the prototype', () => {
  it('flies the same path', () => {
    const pose: Pose = { x: 0, y: 0, a: 0 };
    for (const s of golden.path.samples) {
      scene.pathAt(s.i / 699, pose);
      expect(pose.x).toBeCloseTo(s.x, 2);
      expect(pose.y).toBeCloseTo(s.y, 2);
      expect(pose.a).toBeCloseTo(s.a, 2);
    }
    expect(scene.J.x).toBeCloseTo(golden.path.J.x, 6);
    expect(scene.J.y).toBeCloseTo(golden.path.J.y, 6);
  });

  it('turns steadily one way and never back: the fish cannot wobble, snap or double back', () => {
    const pose: Pose = { x: 0, y: 0, a: 0 };
    let previous = -Infinity;
    for (let i = 0; i <= 699; i++) {
      scene.pathAt(i / 699, pose);
      expect(pose.a).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = pose.a;
    }
    scene.pathAt(0, pose);
    expect(pose.a).toBeCloseTo(-165, 6);
    scene.pathAt(1, pose);
    expect(pose.a).toBeCloseTo(-35, 6);
  });

  it('is a school of fourteen: the arriving fish and thirteen of its own kind', () => {
    expect(N_SCHOOL).toBe(14);
    expect(scene.school).toHaveLength(14);
    expect(scene.school.filter((m) => m.user)).toHaveLength(1);
    expect(scene.school[0].user).toBe(true);
    golden.school.forEach((g, i) => {
      const m = scene.school[i];
      expect(m.bx).toBeCloseTo(g.bx, 2);
      expect(m.by).toBeCloseTo(g.by, 2);
      expect([m.s, m.op, m.a0, m.user]).toEqual([g.s, g.op, g.a0, g.user]);
    });
  });

  it('lands the school in the band the question sits under', () => {
    for (const m of scene.school) {
      expect(m.by).toBeGreaterThan(BAND.y0);
      expect(m.by).toBeLessThan(BAND.y0 + BAND.h);
      expect(m.bx).toBeGreaterThan(0);
      expect(m.bx).toBeLessThan(STAGE.w);
    }
  });
});

describe.each(golden.frames.map((f) => [f.t, f] as const))('frame at %s s', (_t, g) => {
  const f = renderChapterFrame(scene, g.t);

  it('draws the portrait and the word as the prototype does', () => {
    expect(f.open.portrait.opacity).toBeCloseTo(g.portrait.opacity, 2);
    expect(f.open.portrait.offsetY).toBeCloseTo(g.portrait.offsetY, 1);
    expect(f.open.portrait.scale).toBeCloseTo(g.portrait.scale, 3);
    expect(f.open.sheen).toBeCloseTo(g.sheen, 0);
    f.open.letters.forEach((l, i) => {
      expect(l.opacity).toBeCloseTo(g.letters[i].opacity, 2);
      expect(l.dy).toBeCloseTo(g.letters[i].dy, 1);
    });
  });

  it('draws the gold, the glow and the haze as the prototype does', () => {
    expect(f.hazeOpacity).toBeCloseTo(g.hazeOpacity, 2);
    expect(f.ribbonsOpacity).toBeCloseTo(g.ribbonsOpacity, 2);
    expect(f.goldFish.opacity).toBeCloseTo(g.goldFish, 2);
    expect(f.glow.cx).toBeCloseTo(g.glow.cx, 1);
    expect(f.glow.cy).toBeCloseTo(g.glow.cy, 1);
    expect(f.glow.r).toBeCloseTo(g.glow.r, 1);
    expect(f.glow.opacity).toBeCloseTo(g.glow.opacity, 2);
  });

  it('puts every fish of the school where the prototype does', () => {
    f.school.forEach((m, i) => {
      const e = g.school[i];
      expect(Math.abs(m.x - e.x)).toBeLessThan(0.02);
      expect(Math.abs(m.y - e.y)).toBeLessThan(0.02);
      expect(Math.abs(m.angle - e.angle)).toBeLessThan(0.02);
      expect(m.scale).toBeCloseTo(e.scale, 3);
      expect(m.opacity).toBeCloseTo(e.opacity, 2);
      expect(m.rimOpacity).toBeCloseTo(e.rim, 2);
    });
  });

  it('draws the same motes', () => {
    const count = f.tiers.reduce((n, t) => n + (t.d.match(/M/g) ?? []).length, 0);
    expect(Math.abs(count - g.dots)).toBeLessThanOrEqual(2);
  });
});

describe('the story the chapter tells', () => {
  it("begins on the opening's last frame: the portrait and the whole word, no fish", () => {
    const first = renderChapterFrame(scene, 0);
    expect(first.open.portrait).toEqual({ opacity: 1, offsetY: 0, scale: 1 });
    first.open.letters.forEach((l) => expect(l).toEqual({ opacity: 1, dy: 0 }));
    expect(first.school.every((m) => m.opacity === 0)).toBe(true);
    expect(first.goldFish.opacity).toBe(0);
  });

  it('really is that last frame: the same portrait and letters the opening ends on', () => {
    const end = renderOpeningFrame(getOpeningScene(), OPENING_DURATION);
    const first = renderChapterFrame(scene, 0);
    expect(end.logo.opacity).toBe(first.open.portrait.opacity);
    expect(end.logo.scale).toBe(first.open.portrait.scale);
    end.letters.forEach((l, i) => {
      expect(l.opacity).toBe(first.open.letters[i].opacity);
      expect(l.dy).toBe(first.open.letters[i].dy);
    });
    // and the sheen has settled where the opening left it
    expect(end.sheen).toBe(first.open.sheen);
    // The portrait is in the same place relative to the word: same scene, same constants.
    expect(LOGO.x).toBe(160);
  });

  it('turns the word back into the fish: the outer letters give up their gold first', () => {
    const f = renderChapterFrame(scene, CHAPTER_T.release[0] + 0.2);
    const opacity = f.open.letters.map((l) => l.opacity);
    // M and the last A are well on their way while the middle N has not started.
    expect(opacity[0]).toBeLessThan(0.6);
    expect(opacity[8]).toBeCloseTo(opacity[0], 10);
    expect(opacity[4]).toBe(1);
    // and it works inward, so the word comes apart from both ends toward the middle
    expect(opacity[0]).toBeLessThan(opacity[1]);
    expect(opacity[1]).toBeLessThan(opacity[2]);
    expect(opacity[2]).toBeLessThanOrEqual(opacity[3]);
    // By the time the fish is whole, the word is gone.
    const formed = renderChapterFrame(scene, CHAPTER_T.formed[0] + 0.1);
    formed.open.letters.forEach((l) => expect(l.opacity).toBe(0));
  });

  it('carries gold with the fish while it swims, and has none left when it joins', () => {
    const swimming = renderChapterFrame(scene, 2.4);
    expect(swimming.ribbonsOpacity).toBeGreaterThan(0.9);
    const joined = renderChapterFrame(scene, 4.8);
    expect(joined.ribbonsOpacity).toBe(0);
    expect(joined.hazeOpacity).toBe(0);
  });

  it('reveals the school as the fish arrives, and the school is complete when it has joined', () => {
    const arriving = renderChapterFrame(scene, 2.8);
    expect(arriving.school.filter((m) => m.opacity > 0.05).length).toBeGreaterThan(5);
    const joined = renderChapterFrame(scene, CHAPTER_T.total);
    expect(joined.school.every((m) => m.opacity > 0.3)).toBe(true);
  });

  it("lands the arriving fish at the school's tail, where the school is waiting for it", () => {
    const joined = renderChapterFrame(scene, CHAPTER_T.total);
    const arrived = joined.school[0];
    // Within the few points it sways of its resting place.
    expect(Math.abs(arrived.x - scene.J.x)).toBeLessThan(6);
    expect(Math.abs(arrived.y - scene.J.y)).toBeLessThan(5);
  });

  it('fades the portrait as the fish leaves it', () => {
    expect(renderChapterFrame(scene, 3).open.portrait.opacity).toBe(0);
    expect(renderChapterFrame(scene, 2).open.portrait.opacity).toBeGreaterThan(0.1);
  });

  it('is a pure function of time', () => {
    const a = renderChapterFrame(scene, 3.1);
    renderChapterFrame(scene, 1.0);
    renderChapterFrame(scene, 4.9);
    expect(renderChapterFrame(scene, 3.1)).toEqual(a);
  });

  it('holds its last choreography frame forever after the end', () => {
    const end = renderChapterFrame(scene, CHAPTER_T.total);
    const later = renderChapterFrame(scene, CHAPTER_T.total + 30);
    expect(later.open).toEqual(end.open);
    expect(later.ribbonsOpacity).toBe(end.ribbonsOpacity);
  });
});

describe('the question rises as the school settles', () => {
  it('rises header first, then the title, the sentence, the field and Continue', () => {
    const t = CHAPTER_T.form[0] + 0.3;
    const p = formProgress(t);
    expect(p.header).toBeGreaterThan(p.title);
    expect(p.title).toBeGreaterThan(p.support);
    expect(p.support).toBeGreaterThan(p.input);
    expect(p.input).toBeGreaterThan(p.cta);
  });

  it('has nothing risen before it starts and everything up by the time it ends', () => {
    expect(formProgress(CHAPTER_T.form[0] - 0.2)).toEqual({
      header: 0,
      title: 0,
      support: 0,
      input: 0,
      cta: 0,
    });
    const done = formProgress(CHAPTER_T.form[0] + 0.9);
    expect(done).toEqual({ header: 1, title: 1, support: 1, input: 1, cta: 1 });
  });

  it('is usable by about four seconds, as the design promises', () => {
    // Continue is the last part to rise; the first question can be answered
    // well before the chapter ends.
    expect(formProgress(4.31).cta).toBeCloseTo(1, 5);
    expect(formProgress(4.31).cta).toBeGreaterThan(0.999);
  });
});

describe('the settled band', () => {
  it('sways, a little, and never leaves its place', () => {
    const rest = renderBandFrame(scene, CHAPTER_T.total, { ambientT: 5 });
    const later = renderBandFrame(scene, CHAPTER_T.total, { ambientT: 17.3 });
    rest.forEach((m, i) => {
      const moved = Math.hypot(m.x - later[i].x, m.y - later[i].y);
      expect(moved).toBeLessThan(10);
      expect(Math.abs(m.angle - later[i].angle)).toBeLessThan(8);
    });
    // and it does move
    expect(rest.some((m, i) => m.x !== later[i].x)).toBe(true);
  });

  it('matches the prototype at rest, on exit, and tucked away', () => {
    golden.bands.forEach((b) => {
      const o = b.options as { ambientT: number; exit?: number; compact?: number };
      const rows = renderBandFrame(scene, CHAPTER_T.total, o);
      rows.forEach((m, i) => {
        const e = b.school[i];
        expect(Math.abs(m.x - e.x)).toBeLessThan(0.02);
        expect(Math.abs(m.y - e.y)).toBeLessThan(0.02);
        expect(Math.abs(m.angle - e.angle)).toBeLessThan(0.02);
        expect(m.scale).toBeCloseTo(e.scale, 3);
        expect(m.opacity).toBeCloseTo(e.opacity, 2);
      });
    });
  });

  it('tucks seven fish into one row for the keyboard and fades the rest -- never cuts one in half', () => {
    const tucked = renderBandFrame(scene, CHAPTER_T.total, { ambientT: 7, compact: 1 });
    const stay = tucked.slice(0, COMPACT_KEEP);
    const gone = tucked.slice(COMPACT_KEEP);
    expect(COMPACT_KEEP).toBe(7);
    stay.forEach((m) => expect(m.opacity).toBeGreaterThan(0.4));
    gone.forEach((m) => expect(m.opacity).toBe(0));
    // one row: within a few points of the band's centre line
    const centre = BAND.y0 + BAND.h / 2;
    stay.forEach((m) => expect(Math.abs(m.y - centre)).toBeLessThan(5));
    // the newcomer first, at the tail
    expect(stay[0].x).toBeLessThan(stay[1].x);
  });

  it('swims out to the right when the member leaves for Home', () => {
    const resting = renderBandFrame(scene, CHAPTER_T.total, { ambientT: 11 });
    const leaving = renderBandFrame(scene, CHAPTER_T.total, { ambientT: 11, exit: 1 });
    leaving.forEach((m, i) => expect(m.x).toBeGreaterThan(resting[i].x + STAGE.w * 0.9));
  });

  it("carries on from the chapter's last frame: the same fish in the same places", () => {
    const chapterEnd = renderChapterFrame(scene, CHAPTER_T.total);
    const band = renderBandFrame(scene, CHAPTER_T.total, { ambientT: CHAPTER_T.total });
    chapterEnd.school.forEach((m, i) => {
      expect(Math.abs(m.x - band[i].x)).toBeLessThan(0.05);
      expect(Math.abs(m.y - band[i].y)).toBeLessThan(0.05);
      expect(Math.abs(m.angle - band[i].angle)).toBeLessThan(0.05);
      expect(m.scale).toBeCloseTo(band[i].scale, 4);
      // The approved film fades its last few back-row fish in slightly later
      // than the rest, so at the very end of the chapter they are a hair
      // short of their resting opacity (3% at most) -- invisible, and
      // inherited from the film: its chapter and band renderers differ in
      // exactly this one respect.
      expect(Math.abs(m.opacity - band[i].opacity)).toBeLessThan(0.03);
    });
    // and it is only the last few: everything else is exactly the same
    const differing = chapterEnd.school.filter((m, i) => m.opacity !== band[i].opacity);
    expect(differing.length).toBeLessThan(4);
  });
});
