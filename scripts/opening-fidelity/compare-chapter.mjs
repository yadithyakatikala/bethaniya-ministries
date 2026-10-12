// Numerical check: the app's onboarding chapter engine against the approved prototype, frame by frame.
import fs from 'fs';
import path from 'path';
import { OUT, buildChapterReferencePage, bundleChapterEngine, launch, openPage } from './lib.mjs';

const orig = buildChapterReferencePage();
const bundle = await bundleChapterEngine();
const browser = await launch();
const { page, errors } = await openPage(browser, orig, () => window.__ready === true);
await page.addScriptTag({ content: fs.readFileSync(bundle, 'utf8') });

const report = await page.evaluate(() => {
  const S = window.__S, M = window.MaranathaOnboarding, D = window.__dbgC, Ch = window.PortChapter.Ch;
  const scene = Ch.getChapterScene();
  const num = (s) => (s || '').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) || [];
  const g = (el, n) => el.getAttribute(n);
  const maxDiff = (a, b, keys) => { let m = 0; a.forEach((o, i) => keys.forEach((k) => { m = Math.max(m, Math.abs(o[k] - b[i][k])); })); return m; };
  const out = { tables: {}, frames: [], band: [] };

  // tables
  let dx = 0, dy = 0, da = 0; const tmp = { x: 0, y: 0, a: 0 };
  for (let i = 0; i < D.PX.length; i++) { scene.pathAt(i / (D.PX.length - 1), tmp); dx = Math.max(dx, Math.abs(tmp.x - D.PX[i])); dy = Math.max(dy, Math.abs(tmp.y - D.PY[i])); da = Math.max(da, Math.abs(tmp.a - D.PA[i])); }
  let dprog = 0; for (let i = 0; i <= 100; i++) dprog = Math.max(dprog, Math.abs(D.progress(i / 100) - scene.progress(i / 100)));
  out.tables = {
    path: [dx, dy, da], J: [D.J.x - scene.J.x, D.J.y - scene.J.y], progress: dprog,
    wind: maxDiff(D.WIND, scene.wind, ['b', 'rib', 'jit', 'rise', 'life', 'amp', 'fr', 'ph', 'r', 'tb', 'gf', 'gp']),
    ribbon: maxDiff(D.RIBBON, scene.strands, ['lag', 'len', 'lat', 'w', 'fr', 'ph', 'op']),
    haze: maxDiff(D.HAZE, scene.haze, ['lag', 'r', 'op', 'amp', 'fr', 'ph']),
    fish: maxDiff(D.FISHP, scene.fishMotes, ['li', 'delay', 'tb', 'curl', 'r', 'jx', 'jy']),
    school: maxDiff(D.SCHOOL, scene.school, ['bx', 'by', 's', 'op', 'a0', 'ax', 'ay', 'wx', 'wy', 'px', 'py', 'ah', 'wh', 'ph', 'delay']),
    schoolRib: D.SCHOOL.reduce((m, o, i) => Math.max(m, ...[0, 1].map((k) => ['len', 'lat', 'w', 'fr', 'ph', 'op'].reduce((mm, key) => Math.max(mm, Math.abs(o.rib[k][key] - scene.school[i].rib[k][key])), 0))), 0),
  };

  // full chapter, frame by frame
  for (let t = 0; t <= 5.0001; t += 0.05) {
    M.render(S, t, {});
    const f = Ch.renderChapterFrame(scene, t);
    const d = {};
    const cmp = (name, a, b) => { d[name] = Math.max(d[name] || 0, Math.abs(a - b)); };
    const lt = num(g(S.logoG, 'transform')); // translate(x y) scale(s) translate(-x -y)
    cmp('portraitOpacity', +g(S.logoG, 'opacity'), f.open.portrait.opacity);
    cmp('portraitOffsetY', lt[1] - 282, f.open.portrait.offsetY);
    cmp('portraitScale', lt[2], f.open.portrait.scale);
    cmp('sheen', num(g(S.textGrad, 'gradientTransform'))[0], f.open.sheen);
    S.letters.forEach((l, i) => { cmp('letterOpacity', +g(l, 'opacity'), f.open.letters[i].opacity); cmp('letterDy', num(g(l, 'transform'))[1], f.open.letters[i].dy); });
    cmp('hazeGroup', +g(S.hazeG, 'opacity'), f.hazeOpacity);
    cmp('ribbonGroup', +g(S.ribG, 'opacity'), f.ribbonsOpacity);
    cmp('goldFish', +g(S.goldFish, 'opacity'), f.goldFish.opacity);
    cmp('glowOpacity', +g(S.fishGlow, 'opacity'), f.glow.opacity); cmp('glowR', +g(S.fishGlow, 'r'), f.glow.r); cmp('glowX', +g(S.fishGlow, 'cx'), f.glow.cx);
    if (f.hazeOpacity > 0.004) S.haze.forEach((c, i) => { cmp('hazeX', +g(c, 'cx'), f.haze[i].cx); cmp('hazeY', +g(c, 'cy'), f.haze[i].cy); cmp('hazeR', +g(c, 'r'), f.haze[i].r); });
    if (f.ribbonsOpacity > 0.004) S.ribs.forEach((r, i) => {
      const a = num(g(r, 'd')), p = num(f.ribbons[i].d);
      if (a.length !== p.length) d.ribbonShape = (d.ribbonShape || 0) + 1; else a.forEach((v, k) => cmp('ribbonPath', v, p[k]));
    });
    S.fish.forEach((F, i) => {
      const tr = num(g(F.g, 'transform')), m = f.school[i];
      cmp('fishX', tr[0], m.x); cmp('fishY', tr[1], m.y); cmp('fishAngle', tr[2], m.angle); cmp('fishScale', tr[3], m.scale);
      cmp('fishOpacity', +g(F.g, 'opacity'), m.opacity); cmp('rimOpacity', +g(F.rim, 'opacity'), m.rimOpacity);
      // The prototype leaves a hidden member's ribbons as they were; compare while it is on screen.
      if (+g(F.g, 'opacity') > 0.01 && m.ribbons[0].d) F.rib.forEach((r, k) => {
        const a = num(g(r, 'd')), p = num(m.ribbons[k].d);
        if (a.length !== p.length) d.schoolRibShape = (d.schoolRibShape || 0) + 1; else a.forEach((v, q) => cmp('schoolRibPath', v, p[q]));
        cmp('schoolRibOpacity', +g(r, 'opacity'), m.ribbons[k].opacity);
      });
    });
    S.tiers.forEach((tp, i) => {
      const a = (g(tp, 'd') || '').match(/M(-?[\d.]+) (-?[\d.]+)/g) || [], p = (f.tiers[i].d || '').match(/M(-?[\d.]+) (-?[\d.]+)/g) || [];
      d.moteCountDiff = (d.moteCountDiff || 0) + Math.abs(a.length - p.length);
      for (let k = 0; k < Math.min(a.length, p.length); k++) { const x = num(a[k]), y = num(p[k]); cmp('motePosition', x[0], y[0]); cmp('motePosition', x[1], y[1]); }
    });
    S.streaks.forEach((sp, i) => {
      const a = num(g(sp, 'd')), p = num(f.streaks[i].d);
      if (a.length !== p.length) d.streakShape = (d.streakShape || 0) + 1; else a.forEach((v, k) => cmp('streakPath', v, p[k]));
    });
    out.frames.push({ t: +t.toFixed(2), d });
  }

  // the settled band: ambient sway, the exit swim, and the keyboard's compact row
  const bandHost = document.createElement('div'); document.body.appendChild(bandHost); bandHost.setAttribute('data-scene', 'light');
  const B = M.buildScene(bandHost, { band: true });
  const cases = [];
  for (let a = 0; a <= 40; a += 2.5) cases.push({ ambientT: a });
  for (const e of [0.2, 0.5, 0.8, 1]) cases.push({ ambientT: 11, exit: e });
  for (const c of [0.3, 0.7, 1]) cases.push({ ambientT: 7, compact: c });
  cases.push({ ambientT: 7, compact: 1, compactY: 120 });
  for (const o of cases) {
    M.render(B, M.T.total, o);
    const rows = Ch.renderBandFrame(scene, M.T.total, { ambientT: o.ambientT, exit: o.exit, compact: o.compact, compactY: o.compactY });
    const d = {};
    const cmp = (name, a, b) => { d[name] = Math.max(d[name] || 0, Math.abs(a - b)); };
    B.fish.forEach((F, i) => {
      const tr = num(g(F.g, 'transform')), m = rows[i];
      cmp('x', tr[0], m.x); cmp('y', tr[1], m.y); cmp('angle', tr[2], m.angle); cmp('scale', tr[3], m.scale);
      cmp('opacity', +g(F.g, 'opacity'), m.opacity); cmp('rim', +g(F.rim, 'opacity'), m.rimOpacity);
      F.rib.forEach((r, k) => { const a = num(g(r, 'd')), p = num(m.ribbons[k].d); if (a.length !== p.length) d.ribShape = (d.ribShape || 0) + 1; else a.forEach((v, q) => cmp('ribPath', v, p[q])); cmp('ribOpacity', +g(r, 'opacity'), m.ribbons[k].opacity); });
    });
    out.band.push({ o, d });
  }
  return out;
});

const worst = {}; for (const fr of report.frames) for (const [k, v] of Object.entries(fr.d)) worst[k] = Math.max(worst[k] || 0, v);
const worstBand = {}; for (const b of report.band) for (const [k, v] of Object.entries(b.d)) worstBand[k] = Math.max(worstBand[k] || 0, v);
fs.writeFileSync(path.join(OUT, 'compare-chapter.json'), JSON.stringify(report, null, 1));
console.log('tables', JSON.stringify(report.tables));
console.log('worst chapter differences over', report.frames.length, 'frames:'); console.log(JSON.stringify(worst, null, 1));
console.log('worst band differences over', report.band.length, 'cases:'); console.log(JSON.stringify(worstBand, null, 1));
console.log('page errors:', JSON.stringify(errors));
await browser.close();

const limits = { portraitOpacity: 0.001, portraitOffsetY: 0.02, portraitScale: 0.0005, sheen: 0.1, letterOpacity: 0.001, letterDy: 0.02, hazeGroup: 0.001, ribbonGroup: 0.001, goldFish: 0.001, glowOpacity: 0.001, glowR: 0.02, glowX: 0.02, hazeX: 0.02, hazeY: 0.02, hazeR: 0.02, ribbonPath: 0.05, fishX: 0.02, fishY: 0.02, fishAngle: 0.02, fishScale: 0.0001, fishOpacity: 0.001, rimOpacity: 0.001, schoolRibPath: 0.05, schoolRibOpacity: 0.001, motePosition: 0.15, moteCountDiff: 2, streakPath: 0.15, ribbonShape: 0, schoolRibShape: 0, streakShape: 0 };
const bandLimits = { x: 0.02, y: 0.02, angle: 0.02, scale: 0.0001, opacity: 0.001, rim: 0.001, ribPath: 0.05, ribOpacity: 0.001, ribShape: 0 };
const bad = [
  ...Object.entries(limits).filter(([k, lim]) => (worst[k] || 0) > lim).map(([k, v]) => ['chapter ' + k, worst[k], '>', v]),
  ...Object.entries(bandLimits).filter(([k, lim]) => (worstBand[k] || 0) > lim).map(([k, v]) => ['band ' + k, worstBand[k], '>', v]),
];
const t = report.tables;
if (t.wind || t.ribbon || t.haze || t.fish || t.school || t.schoolRib || t.progress > 1e-9 || Math.max(...t.path) > 1e-6) bad.push(['tables', t]);
if (bad.length) { console.error('FAIL', JSON.stringify(bad)); process.exit(1); }
console.log('PASS: the app chapter engine reproduces the approved prototype.');
