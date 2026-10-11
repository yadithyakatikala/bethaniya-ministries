// Shared helpers: paths, the browser, and the page that runs the ORIGINAL approved engine.
import { chromium } from 'playwright';
import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../..');
export const MOBILE = path.join(ROOT, 'mobile');
export const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });

const b64 = (file) => fs.readFileSync(file).toString('base64');

/**
 * Builds out/orig.html: the approved engine (reference/anim2.js, verbatim, plus a one-line
 * debug export appended so its internal tables can be read) on a 390 x 844 host, with the
 * app's real portrait and the same Noto Serif SemiBold the approved render used.
 */
export function buildReferencePage() {
  const engine = fs
    .readFileSync(path.join(HERE, 'reference/anim2.js'), 'utf8')
    .replace(
      '  global.MaranathaOpening = {',
      `  global.__dbg = { get SX(){return SX}, get SY(){return SY}, get SA(){return SA}, get FLEN(){return FLEN},
    get FISH_PTS(){return FISH_PTS}, WIND:WIND, FISHP:FISHP, HAZE:HAZE, RIBBON:RIBBON, progress:progress };
  global.MaranathaOpening = {`
    );
  if (!engine.includes('__dbg')) throw new Error('reference engine changed shape');
  const font = b64(path.join(MOBILE, 'assets/fonts/NotoSerif-SemiBold.ttf'));
  const logo = b64(path.join(MOBILE, 'assets/splash-icon.png'));
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Noto Serif';font-weight:600;font-style:normal;font-display:block;src:url(data:font/ttf;base64,${font})}
html,body{margin:0;padding:0;background:#777}
.host{width:390px;height:844px;position:relative;overflow:hidden}
.host svg{position:absolute;left:0;top:0;width:100%;height:100%;display:block}
.host[data-scene="light"]{--scene-ground:#FAFAF8;--scene-ink:#101114;--gold-deep:#4A2A06;--gold-base:#8F5A26;--gold-high:#DDB06B;--gold-spec:#FFF8E4;--gold-textpeak:#B9863C;--gold-rim:#6B4012;--ink-soft:#3A3F47;--dust1:#6B4012;--dust2:#8F5A26;--dust3:#BE8637;--dust4:#E3B258}
.host[data-scene="dark"]{--scene-ground:#0E0F11;--scene-ink:#F4F5F6;--gold-deep:#6E4A1E;--gold-base:#DCA766;--gold-high:#F5DCAC;--gold-spec:#FFFCF4;--gold-textpeak:#F0D6A4;--gold-rim:#8A6330;--ink-soft:#C9CDD2;--dust1:#8A6330;--dust2:#B8863F;--dust3:#DCA766;--dust4:#F2D49B}
</style></head><body><div class="host" id="host" data-scene="light"></div>
<script>${engine}</script>
<script>
(async function(){
  await document.fonts.load("600 16px 'Noto Serif'"); await document.fonts.ready;
  var M = window.MaranathaOpening; M.buildTable(); M.buildParticles();
  var S = M.buildScene(document.getElementById('host'), {});
  M.setLogo(S, 'data:image/png;base64,${logo}');
  window.__S = S;
  window.renderAt = function(t, scene){ document.getElementById('host').setAttribute('data-scene', scene||'light'); M.render(S, t); };
  M.render(S, 0); window.__ready = true;
})();
</script></body></html>`;
  const file = path.join(OUT, 'orig.html');
  fs.writeFileSync(file, html);
  return file;
}

/** Bundles the app's TypeScript engine for the browser (out/engine.bundle.js). */
export async function bundleEngine() {
  const entry = path.join(OUT, 'entry-engine.ts');
  fs.writeFileSync(
    entry,
    `import { getOpeningScene } from '${MOBILE}/src/features/opening/engine/scene';
import { renderOpeningFrame } from '${MOBILE}/src/features/opening/engine/frame';
import * as C from '${MOBILE}/src/features/opening/engine/constants';
export { getOpeningScene, renderOpeningFrame, C };`
  );
  const outfile = path.join(OUT, 'engine.bundle.js');
  await build({ entryPoints: [entry], bundle: true, format: 'iife', globalName: 'PortEngine', outfile, logLevel: 'warning' });
  return outfile;
}

/**
 * Bundles the app's real OpeningCanvas (react-native-svg, through react-native-web) and wraps
 * it in out/port.html. This renders the same component tree the phone does.
 */
export async function buildPortPage() {
  const entry = path.join(OUT, 'entry-web.tsx');
  fs.writeFileSync(
    entry,
    `import * as React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { OpeningCanvas } from '${MOBILE}/src/features/opening/OpeningCanvas';
import { renderOpeningFrame } from '${MOBILE}/src/features/opening/engine/frame';
import { getOpeningScene } from '${MOBILE}/src/features/opening/engine/scene';
import { scenePalette } from '${MOBILE}/src/features/opening/palette';
import { brandGold, lightTokens, darkTokens } from '${MOBILE}/src/theme/tokens';
const root = createRoot(document.getElementById('root'));
const scene = getOpeningScene();
window.renderPort = (t, dark) => {
  const palette = scenePalette(dark ? darkTokens : lightTokens, dark ? brandGold.dark : brandGold.light);
  flushSync(() => root.render(<OpeningCanvas frame={renderOpeningFrame(scene, t)} palette={palette} portrait={{ uri: window.__PORTRAIT }} />));
};
window.__portReady = true;`
  );
  const nm = path.join(HERE, 'node_modules');
  const outfile = path.join(OUT, 'web.bundle.js');
  await build({
    entryPoints: [entry], bundle: true, format: 'iife', platform: 'browser', outfile, logLevel: 'warning',
    alias: {
      'react-native': path.join(nm, 'react-native-web'),
      react: path.join(nm, 'react'),
      'react-dom': path.join(nm, 'react-dom'),
      'react-native-svg': path.join(MOBILE, 'node_modules/react-native-svg'),
    },
    resolveExtensions: ['.web.js', '.web.ts', '.web.tsx', '.js', '.ts', '.tsx', '.json'],
    mainFields: ['browser', 'module', 'main'],
    define: { 'process.env.NODE_ENV': '"production"', __DEV__: 'false' },
    jsx: 'automatic',
  });
  const jpg = b64(path.join(MOBILE, 'assets/brand/maranatha-portrait-crop-512.jpg'));
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#777}#root{width:390px;height:844px;position:relative;overflow:hidden}</style></head><body><div id="root"></div>
<script>window.__PORTRAIT='data:image/jpeg;base64,${jpg}';</script><script>${fs.readFileSync(outfile, 'utf8')}</script></body></html>`;
  const file = path.join(OUT, 'port.html');
  fs.writeFileSync(file, html);
  return file;
}

export async function openPage(browser, file, ready, dsf = 1) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dsf });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  await page.goto('file://' + file);
  await page.waitForFunction(ready, { timeout: 60000 });
  return { page, errors };
}

export const launch = () => chromium.launch({ args: ['--force-color-profile=srgb'] });
