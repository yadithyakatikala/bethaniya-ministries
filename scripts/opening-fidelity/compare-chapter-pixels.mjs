// Pixel check: the app's real ChapterCanvas and SchoolBand against the approved prototype, at 2x,
// in light and dark, on the reference phone.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { OUT, buildChapterPortPage, buildChapterReferencePage, launch, openPage } from './lib.mjs';

const times = [0.15, 0.6, 1.0, 1.4, 1.8, 2.2, 2.6, 3.0, 3.4, 3.8, 4.2, 4.6, 5.0];
const bandTimes = [0, 3.7, 11.2, 30.5];
const name = (t) => String(t);
const orig = buildChapterReferencePage();
const port = await buildChapterPortPage();
const browser = await launch();
const a = await openPage(browser, orig, () => window.__ready === true, 2);
const b = await openPage(browser, port, () => window.__portReady === true, 2);
const shots = path.join(OUT, 'chapter-shots');
fs.mkdirSync(shots, { recursive: true });
for (const scene of ['light', 'dark']) {
  for (const t of times) {
    await a.page.evaluate(([t, s]) => window.renderAt(t, s), [t, scene]);
    await a.page.waitForTimeout(40);
    await a.page.screenshot({ path: path.join(shots, `orig_${scene}_${name(t)}.png`) });
    await b.page.evaluate(([t, d]) => window.renderChapter(t, d), [t, scene === 'dark']);
    await b.page.waitForTimeout(120);
    await b.page.screenshot({ path: path.join(shots, `port_${scene}_${name(t)}.png`) });
  }
}
// the settled band: the prototype's band scene vs SchoolBand, cropped to the band (y 96..246)
await a.page.evaluate(() => {
  const host = document.getElementById('host'); host.innerHTML = '';
  const M = window.MaranathaOnboarding;
  window.__B = M.buildScene(host, { band: true });
  host.style.height = '150px';
  window.renderBandOrig = (amb, scene) => { host.setAttribute('data-scene', scene); M.render(window.__B, M.T.total, { ambientT: amb }); };
});
for (const scene of ['light', 'dark']) {
  for (const amb of bandTimes) {
    await a.page.evaluate(([amb, s]) => window.renderBandOrig(amb, s), [amb, scene]);
    await a.page.waitForTimeout(40);
    await a.page.screenshot({ path: path.join(shots, `bandorig_${scene}_${name(amb)}.png`), clip: { x: 0, y: 0, width: 390, height: 150 } });
    await b.page.evaluate(([amb, d]) => window.renderBand(amb, d), [amb, scene === 'dark']);
    await b.page.waitForTimeout(120);
    await b.page.screenshot({ path: path.join(shots, `bandport_${scene}_${name(amb)}.png`), clip: { x: 0, y: 0, width: 390, height: 150 } });
  }
}
console.log('page errors:', JSON.stringify([...a.errors, ...b.errors]));
await browser.close();

const py = `
import sys, numpy as np
from PIL import Image
shots = sys.argv[1]; times = sys.argv[2].split(','); bands = sys.argv[3].split(',')
worst_mean = 0; worst_frac = 0
def cmp(o, p, label):
    global worst_mean, worst_frac
    x = np.asarray(Image.open(o).convert('RGB')).astype(int); y = np.asarray(Image.open(p).convert('RGB')).astype(int)
    d = np.abs(x - y).max(axis=2); mean, frac = np.abs(x - y).mean(), (d > 64).mean() * 100
    worst_mean = max(worst_mean, mean); worst_frac = max(worst_frac, frac)
    print(f'{label:34} mean abs diff {mean:6.3f}/255   pixels differing by >64: {frac:.4f}%')
for scene in ('light', 'dark'):
    for t in times: cmp(f'{shots}/orig_{scene}_{t}.png', f'{shots}/port_{scene}_{t}.png', f'chapter {scene} t={t}')
    for t in bands: cmp(f'{shots}/bandorig_{scene}_{t}.png', f'{shots}/bandport_{scene}_{t}.png', f'band    {scene} sway={t}')
print(f'WORST  mean abs diff {worst_mean:.3f}/255, pixels differing by >64: {worst_frac:.4f}%')
sys.exit(0 if worst_mean < 0.5 and worst_frac < 0.05 else 1)
`;
const r = spawnSync('python3', ['-c', py, shots, times.map(name).join(','), bandTimes.map(name).join(',')], { stdio: 'inherit' });
if (r.status !== 0) { console.error('FAIL: chapter frames differ from the approved prototype.'); process.exit(1); }
console.log('PASS: the real chapter renderer draws the approved prototype. Frames are in', shots);
