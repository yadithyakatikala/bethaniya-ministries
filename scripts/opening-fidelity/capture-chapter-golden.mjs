// Regenerates mobile/src/features/opening/__tests__/fixtures/chapterGolden.json from the approved
// onboarding chapter prototype. Only needed if the approved chapter itself is ever deliberately changed.
import fs from 'fs';
import path from 'path';
import { MOBILE, buildChapterReferencePage, launch, openPage } from './lib.mjs';

const orig = buildChapterReferencePage();
const browser = await launch();
const { page } = await openPage(browser, orig, () => window.__ready === true);
const out = await page.evaluate(() => {
  const S = window.__S, M = window.MaranathaOnboarding, D = window.__dbgC;
  const num = (s) => (s || '').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) || [];
  const g = (el, n) => el.getAttribute(n);
  const round = (v, n = 4) => Number(v.toFixed(n));
  const times = [0.15, 0.7, 1.2, 1.6, 2.2, 2.8, 3.3, 3.7, 4.2, 4.8, 5.0];
  const frames = times.map((t) => {
    M.render(S, t, {});
    const lt = num(g(S.logoG, 'transform'));
    let dots = 0, sx = 0, sy = 0;
    S.tiers.forEach((tp) => (g(tp, 'd') || '').split('M').filter(Boolean).forEach((seg) => { const n = num(seg.split('l')[0]); dots++; sx += n[0]; sy += n[1]; }));
    return {
      t,
      portrait: { opacity: round(+g(S.logoG, 'opacity')), offsetY: round(lt[1] - 282, 2), scale: round(lt[2]) },
      sheen: round(num(g(S.textGrad, 'gradientTransform'))[0], 1),
      letters: S.letters.map((l) => ({ opacity: round(+g(l, 'opacity'), 3), dy: round(num(g(l, 'transform'))[1], 2) })),
      hazeOpacity: round(+g(S.hazeG, 'opacity'), 3), ribbonsOpacity: round(+g(S.ribG, 'opacity'), 3),
      goldFish: round(+g(S.goldFish, 'opacity'), 3),
      glow: { cx: round(+g(S.fishGlow, 'cx'), 2), cy: round(+g(S.fishGlow, 'cy'), 2), r: round(+g(S.fishGlow, 'r'), 2), opacity: round(+g(S.fishGlow, 'opacity'), 3) },
      school: S.fish.map((F) => { const tr = num(g(F.g, 'transform')); return { x: round(tr[0], 2), y: round(tr[1], 2), angle: round(tr[2], 2), scale: round(tr[3], 4), opacity: round(+g(F.g, 'opacity'), 3), rim: round(+g(F.rim, 'opacity'), 3) }; }),
      dots, dotChecksum: { x: round(sx, 1), y: round(sy, 1) },
    };
  });
  // the settled band at two sways, plus exit and compact
  const host = document.createElement('div'); document.body.appendChild(host); host.setAttribute('data-scene', 'light');
  const B = M.buildScene(host, { band: true });
  const bands = [{ ambientT: 5 }, { ambientT: 17.3 }, { ambientT: 11, exit: 0.6 }, { ambientT: 7, compact: 1 }].map((o) => {
    M.render(B, M.T.total, o);
    return { options: o, school: B.fish.map((F) => { const tr = num(g(F.g, 'transform')); return { x: round(tr[0], 2), y: round(tr[1], 2), angle: round(tr[2], 2), scale: round(tr[3], 4), opacity: round(+g(F.g, 'opacity'), 3) }; }) };
  });
  const keep = (arr, n) => arr.slice(0, n);
  return {
    source: 'approved onboarding chapter prototype (reference/onboarding-chapter.js), measured in Chromium',
    path: { J: D.J, F0: D.F0, samples: [0, 175, 350, 525, 699].map((i) => ({ i, x: round(D.PX[i], 3), y: round(D.PY[i], 3), a: round(D.PA[i], 3) })) },
    school: D.SCHOOL.map((m) => ({ bx: round(m.bx, 3), by: round(m.by, 3), s: m.s, op: m.op, a0: m.a0, user: m.user })),
    frames, bands,
  };
});
const file = path.join(MOBILE, 'src/features/opening/__tests__/fixtures/chapterGolden.json');
fs.writeFileSync(file, JSON.stringify(out, null, 1));
console.log('wrote', file);
await browser.close();
