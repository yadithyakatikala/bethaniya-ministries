// Pixel check: the app's real OpeningCanvas (react-native-svg via react-native-web) against the
// approved engine's DOM, at 2x, in light and dark.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { OUT, buildPortPage, buildReferencePage, launch, openPage } from './lib.mjs';

const times = [0.2, 0.6, 1.0, 1.4, 1.8, 2.2, 2.6, 3.0, 3.4, 3.8, 4.2, 4.6, 5.0, 5.3868];
const name = (t) => (Number.isInteger(t) ? String(t) : String(t));
const orig = buildReferencePage();
const port = await buildPortPage();
const browser = await launch();
const a = await openPage(browser, orig, () => window.__ready === true, 2);
const b = await openPage(browser, port, () => window.__portReady === true, 2);
const shots = path.join(OUT, 'shots');
fs.mkdirSync(shots, { recursive: true });
for (const scene of ['light', 'dark']) {
  for (const t of times) {
    await a.page.evaluate(([t, s]) => window.renderAt(t, s), [t, scene]);
    await a.page.waitForTimeout(40);
    await a.page.screenshot({ path: path.join(shots, `orig_${scene}_${name(t)}.png`) });
    await b.page.evaluate(([t, d]) => window.renderPort(t, d), [t, scene === 'dark']);
    await b.page.waitForTimeout(120);
    await b.page.screenshot({ path: path.join(shots, `port_${scene}_${name(t)}.png`) });
  }
}
console.log('page errors:', JSON.stringify([...a.errors, ...b.errors]));
await browser.close();

const py = `
import sys, numpy as np
from PIL import Image
shots, times = sys.argv[1], sys.argv[2].split(',')
worst_mean = 0; worst_frac = 0
for scene in ('light', 'dark'):
    for t in times:
        x = np.asarray(Image.open(f'{shots}/orig_{scene}_{t}.png').convert('RGB')).astype(int)
        y = np.asarray(Image.open(f'{shots}/port_{scene}_{t}.png').convert('RGB')).astype(int)
        d = np.abs(x - y).max(axis=2)
        mean, frac = np.abs(x - y).mean(), (d > 64).mean() * 100
        worst_mean = max(worst_mean, mean); worst_frac = max(worst_frac, frac)
        print(f'{scene:5} t={t:<7} mean abs diff {mean:6.3f}/255   pixels differing by >64: {frac:.4f}%')
print(f'WORST  mean abs diff {worst_mean:.3f}/255, pixels differing by >64: {worst_frac:.4f}%')
sys.exit(0 if worst_mean < 0.5 and worst_frac < 0.05 else 1)
`;
const r = spawnSync('python3', ['-c', py, shots, times.map(name).join(',')], { stdio: 'inherit' });
if (r.status !== 0) { console.error('FAIL: frames differ from the approved film.'); process.exit(1); }
console.log('PASS: the real renderer draws the approved film. Frames are in', shots);
