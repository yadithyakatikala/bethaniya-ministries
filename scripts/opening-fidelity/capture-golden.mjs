// Regenerates mobile/src/features/opening/__tests__/fixtures/openingGolden.json from the
// approved engine. Only needed if the approved film itself is ever deliberately changed.
import fs from 'fs';
import path from 'path';
import { MOBILE, buildReferencePage, launch, openPage } from './lib.mjs';

const orig = buildReferencePage();
const browser = await launch();
const { page } = await openPage(browser, orig, () => window.__ready === true);
const out = await page.evaluate(() => {
  const S = window.__S, M = window.MaranathaOpening, D = window.__dbg;
  const num = (s) => (s || '').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) || [];
  const g = (el, n) => el.getAttribute(n);
  const round = (v, n = 4) => Number(v.toFixed(n));
  const times = [0.4, 1.0, 1.6, 2.2, 2.8, 3.4, 3.9, 4.4, 4.9, 5.3868];
  const frames = times.map((t) => {
    M.render(S, t);
    const ft = num(g(S.fishG, 'transform')), lt = num(g(S.logoG, 'transform'));
    const dotsPerTier = S.tiers.map((tp) => ((g(tp, 'd') || '').match(/M/g) || []).length);
    let sx = 0, sy = 0;
    S.tiers.forEach((tp) => (g(tp, 'd') || '').split('M').filter(Boolean).forEach((seg) => { const n = num(seg.split('l')[0]); sx += n[0]; sy += n[1]; }));
    return {
      t, logo: { opacity: round(+g(S.logoG, 'opacity')), scale: round(lt[2]) },
      fish: { opacity: round(+g(S.fishG, 'opacity')), x: round(ft[0], 2), y: round(ft[1], 2), angle: round(ft[2], 2) },
      glow: { cx: round(+g(S.fishGlow, 'cx'), 2), cy: round(+g(S.fishGlow, 'cy'), 2), r: round(+g(S.fishGlow, 'r'), 2), opacity: round(+g(S.fishGlow, 'opacity'), 3) },
      hazeOpacity: round(+g(S.hazeG, 'opacity'), 3), ribbonsOpacity: round(+g(S.ribG, 'opacity'), 3),
      ribbonOpacities: S.ribs.map((r) => round(+g(r, 'opacity'), 3)),
      dotsPerTier, dotChecksum: { x: round(sx, 1), y: round(sy, 1) },
      tierOpacities: S.tiers.map((tp) => round(+g(tp, 'opacity'), 3)),
      sheen: round(num(g(S.textGrad, 'gradientTransform'))[0], 1),
      letters: S.letters.map((l) => ({ opacity: round(+g(l, 'opacity'), 3), dy: round(num(g(l, 'transform'))[1], 2) })),
      blooms: S.blooms.map((c) => round(+g(c, 'opacity'), 3)),
    };
  });
  const idx = [0, 200, 400, 600, 799];
  const pick = (arr, ids) => ids.map((i) => arr[i]);
  return {
    source: 'approved opening engine (reference/anim2.js, SPEED 1.34), measured in Chromium', duration: M.DURATION,
    flight: { length: D.FLEN, samples: idx.map((i) => ({ i, x: round(D.SX[i], 3), y: round(D.SY[i], 3), a: round(D.SA[i], 3) })) },
    particles: {
      wind: pick(D.WIND, [0, 47, 95]).map((w) => ({ b: w.b, rib: w.rib, jit: w.jit, rise: w.rise, life: w.life, amp: w.amp, fr: w.fr, ph: w.ph, r: w.r, tb: w.tb, gf: w.gf, gp: w.gp, li: w.li })),
      fish: pick(D.FISHP, [0, 60, 119]).map((f) => ({ src: f.src, delay: f.delay, tb: f.tb, curl: f.curl, r: f.r, jx: f.jx, jy: f.jy, li: f.li })),
      ribbons: D.RIBBON, haze: pick(D.HAZE, [0, 13]),
    },
    frames,
  };
});
const file = path.join(MOBILE, 'src/features/opening/__tests__/fixtures/openingGolden.json');
fs.writeFileSync(file, JSON.stringify(out, null, 1));
console.log('wrote', file);
await browser.close();
