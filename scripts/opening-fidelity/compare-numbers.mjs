// Numerical check: the app's TypeScript engine against the approved engine, frame by frame.
import fs from 'fs';
import path from 'path';
import { OUT, buildReferencePage, bundleEngine, launch, openPage } from './lib.mjs';

const orig = buildReferencePage();
const bundle = await bundleEngine();
const browser = await launch();
const { page, errors } = await openPage(browser, orig, () => window.__ready === true);
await page.addScriptTag({ content: fs.readFileSync(bundle, 'utf8') });

const report = await page.evaluate(() => {
  const S = window.__S, M = window.MaranathaOpening, E = window.PortEngine, D = window.__dbg;
  const scene = E.getOpeningScene();
  const num = (s) => (s || '').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) || [];
  const g = (el, n) => el.getAttribute(n);
  const out = { tables: {}, frames: [] };

  const N = D.SX.length, tmp = { x: 0, y: 0, a: 0 };
  let dx = 0, dy = 0, da = 0;
  for (let i = 0; i < N; i++) {
    scene.flight.at(i / (N - 1), tmp);
    dx = Math.max(dx, Math.abs(tmp.x - D.SX[i])); dy = Math.max(dy, Math.abs(tmp.y - D.SY[i])); da = Math.max(da, Math.abs(tmp.a - D.SA[i]));
  }
  const maxDiff = (a, b, keys) => { let m = 0; a.forEach((o, i) => keys.forEach((k) => { m = Math.max(m, Math.abs(o[k] - b[i][k])); })); return m; };
  out.tables = {
    flightLength: [D.FLEN, scene.flight.length], flightMaxDx: dx, flightMaxDy: dy, flightMaxDa: da,
    wind: maxDiff(D.WIND, scene.wind, ['b', 'rib', 'jit', 'rise', 'life', 'amp', 'fr', 'ph', 'r', 'tb', 'gf', 'gp', 'li']),
    fish: maxDiff(D.FISHP, scene.fish, ['delay', 'tb', 'curl', 'r', 'jx', 'jy', 'li']),
    ribbon: maxDiff(D.RIBBON, scene.ribbons, ['lag', 'len', 'lat', 'w', 'fr', 'ph', 'op']),
    haze: maxDiff(D.HAZE, scene.haze, ['lag', 'r', 'op', 'amp', 'fr', 'ph']),
  };

  for (let t = 0; t <= M.DURATION + 1e-9; t += 0.05) {
    M.render(S, t);
    const f = E.renderOpeningFrame(scene, t);
    const d = {};
    const cmp = (name, a, b) => { d[name] = Math.max(d[name] || 0, Math.abs(a - b)); };
    cmp('logoOpacity', +g(S.logoG, 'opacity'), f.logo.opacity);
    const ft = num(g(S.fishG, 'transform'));
    cmp('fishX', ft[0], f.fish.x); cmp('fishY', ft[1], f.fish.y); cmp('fishAngle', ft[2], f.fish.angle);
    cmp('fishOpacity', +g(S.fishG, 'opacity'), f.fish.opacity);
    cmp('glowOpacity', +g(S.fishGlow, 'opacity'), f.glow.opacity);
    cmp('sheen', num(g(S.textGrad, 'gradientTransform'))[0], f.sheen);
    S.letters.forEach((l, i) => { cmp('letterOpacity', +g(l, 'opacity'), f.letters[i].opacity); cmp('letterDy', num(g(l, 'transform'))[1], f.letters[i].dy); });
    if (f.ribbonsOpacity > 0.004) S.ribs.forEach((r, i) => {
      const a = num(g(r, 'd')), p = num(f.ribbons[i].d);
      if (a.length !== p.length) d.ribbonShape = (d.ribbonShape || 0) + 1;
      else a.forEach((v, k) => cmp('ribbonPath', v, p[k]));
    });
    S.tiers.forEach((tp, i) => {
      const a = (g(tp, 'd') || '').match(/M(-?[\d.]+) (-?[\d.]+)/g) || [], p = (f.tiers[i].d || '').match(/M(-?[\d.]+) (-?[\d.]+)/g) || [];
      d.moteCountDiff = (d.moteCountDiff || 0) + Math.abs(a.length - p.length);
      for (let k = 0; k < Math.min(a.length, p.length); k++) { const x = num(a[k]), y = num(p[k]); cmp('motePosition', x[0], y[0]); cmp('motePosition', x[1], y[1]); }
    });
    out.frames.push({ t: +t.toFixed(2), d });
  }
  return out;
});

const worst = {};
for (const fr of report.frames) for (const [k, v] of Object.entries(fr.d)) worst[k] = Math.max(worst[k] || 0, v);
fs.writeFileSync(path.join(OUT, 'compare-numbers.json'), JSON.stringify(report, null, 1));
console.log('tables ', JSON.stringify(report.tables));
console.log('worst per-frame differences over', report.frames.length, 'frames:');
console.log(JSON.stringify(worst, null, 1));
console.log('page errors:', JSON.stringify(errors));
await browser.close();

// The attributes the approved engine writes are rounded (3 / 2 / 1 decimals), and its path
// sampler is the browser's. Anything beyond that rounding is a real difference.
const limits = { fishX: 0.02, fishY: 0.02, fishAngle: 0.05, logoOpacity: 0.001, fishOpacity: 0.001, glowOpacity: 0.001, letterOpacity: 0.001, letterDy: 0.02, sheen: 0.1, ribbonPath: 0.05, motePosition: 0.15, moteCountDiff: 0, ribbonShape: 0 };
const bad = Object.entries(limits).filter(([k, lim]) => (worst[k] || 0) > lim);
const t = report.tables;
if (t.wind || t.fish || t.ribbon || t.haze || t.flightMaxDx > 0.01 || t.flightMaxDa > 0.05) bad.push(['tables', t]);
if (bad.length) { console.error('FAIL', JSON.stringify(bad)); process.exit(1); }
console.log('PASS: the app engine reproduces the approved film.');
