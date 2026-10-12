// Visual QA of the REAL onboarding screen, in Chromium, through react-native-web.
//
// This bundles mobile/src/features/onboarding/OnboardingScreen.tsx exactly as the app builds it
// (every component, the real chapter, the real band, the real theme) and stubs only what a browser
// cannot provide: the Firebase-backed contexts, safe-area insets, AsyncStorage, the keyboard events
// and the font loader. A fake clock drives every animation frame, so a screenshot "at 2.8 s" is the
// frame at 2.8 s, every time.
//
// It is a layout and look check, not a replacement for a device: react-native-web is not React
// Native (KeyboardAvoidingView, the native animation driver, text metrics and the keyboard itself
// all differ). Screenshots land in out/onboarding-shots/; `contact-sheets.py` joins them.
//
//   node qa-onboarding-screen.mjs            # everything
//   node qa-onboarding-screen.mjs chapter    # only scenarios whose name contains "chapter"
import fs from 'fs';
import path from 'path';
import { build } from 'esbuild';
import { HERE, MOBILE, OUT, launch } from './lib.mjs';

const only = process.argv[2] ?? '';
const STUBS = path.join(OUT, 'qa-stubs');
const SHOTS = path.join(OUT, 'onboarding-shots');
fs.mkdirSync(STUBS, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });
const nm = path.join(HERE, 'node_modules');
const b64 = (file) => fs.readFileSync(file).toString('base64');
const stub = (name, text) => {
  const file = path.join(STUBS, name);
  fs.writeFileSync(file, text);
  return file;
};

// ---------------------------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------------------------
const store = stub(
  'store.ts',
  `import { useSyncExternalStore } from 'react';
export interface QaState {
  dark: boolean; language: 'en' | 'te'; keyboard: number; displayName: string | null;
  insets: { top: number; bottom: number; left: number; right: number };
  failSave: boolean | 'hang';
}
let snapshot: QaState = { dark: false, language: 'en', keyboard: 0, displayName: null,
  insets: { top: 47, bottom: 34, left: 0, right: 0 }, failSave: false };
const listeners = new Set<() => void>();
export const qa = {
  get: () => snapshot,
  set(patch: Partial<QaState>) { snapshot = { ...snapshot, ...patch }; listeners.forEach((l) => l()); },
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
};
export const useQa = () => useSyncExternalStore(qa.subscribe, qa.get);
(globalThis as any).__qa = qa;
(globalThis as any).__calls = [];
`
);
const prefs = stub(
  'prefs.tsx',
  `import { useQa, qa } from './store';
export function usePreferences() {
  const s = useQa();
  return {
    isDark: s.dark,
    appLanguage: s.language,
    setAppLanguage: async (language: 'en' | 'te') => {
      (globalThis as any).__calls.push(['setAppLanguage', language]);
      qa.set({ language });
    },
  };
}
`
);
const auth = stub(
  'auth.tsx',
  `import { useQa } from './store';
export function useAuth() {
  const s = useQa();
  return { user: { uid: 'qa-user', displayName: s.displayName, phoneNumber: null } };
}
`
);
const safeArea = stub(
  'safearea.tsx',
  `import { useQa } from './store';
export const useSafeAreaInsets = () => useQa().insets;
export const SafeAreaProvider = ({ children }: any) => children;
`
);
const asyncStorage = stub(
  'asyncstorage.ts',
  `const memory = new Map<string, string>();
if ((globalThis as any).__seen) memory.set('onboarding_chapter_seen', '1');
export default {
  getItem: async (k: string) => (memory.has(k) ? memory.get(k)! : null),
  setItem: async (k: string, v: string) => { memory.set(k, v); },
  removeItem: async (k: string) => { memory.delete(k); },
  clear: async () => memory.clear(),
  getAllKeys: async () => [...memory.keys()],
};
`
);
const profile = stub(
  'profile.ts',
  `import { qa } from './store';
const calls = () => (globalThis as any).__calls as unknown[][];
export async function completeOnboarding(uid: string, answers: unknown) {
  calls().push(['completeOnboarding', uid, answers]);
  if (qa.get().failSave === 'hang') await new Promise(() => {});
  if (qa.get().failSave) throw new Error('offline');
}
export async function updateOwnProfile(uid: string, patch: unknown) {
  calls().push(['updateOwnProfile', uid, patch]);
}
`
);
const keyboard = stub(
  'keyboard.ts',
  `import { useQa } from './store';
export function useKeyboard() {
  const s = useQa();
  return { visible: s.keyboard > 0, height: s.keyboard };
}
`
);
const expoFont = stub(
  'expofont.ts',
  `export const loadAsync = async () => undefined;
export const isLoaded = () => true;
`
);
// react-native with one change: KeyboardAvoidingView pads by the keyboard's height, as it does
// on a phone, so a "keyboard up" screenshot lays out the way the device would.
const rnShim = stub(
  'react-native-shim.tsx',
  `import * as React from 'react';
import { View } from ${JSON.stringify(path.join(nm, 'react-native-web'))};
import { useQa } from './store';
export * from ${JSON.stringify(path.join(nm, 'react-native-web'))};
// react-native-web has no native node handles; the screen asks for one only to move a screen reader's focus.
export const findNodeHandle = () => null;
// Android's hardware back button does not exist in a browser.
export const BackHandler = { addEventListener: () => ({ remove() {} }), exitApp() {}, removeEventListener() {} };
export function KeyboardAvoidingView({ style, behavior: _b, children, ...rest }: any) {
  const s = useQa();
  return <View {...rest} style={[style, { paddingBottom: s.keyboard }]}>{children}</View>;
}
`
);

const mountEntry = stub(
  'entry.tsx',
  `import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { View } from 'react-native';
import { OnboardingScreen } from ${JSON.stringify(path.join(MOBILE, 'src/features/onboarding/OnboardingScreen'))};
import { lightTokens, darkTokens } from ${JSON.stringify(path.join(MOBILE, 'src/theme/tokens'))};
import { useQa } from './store';
const g = globalThis as any;
function Frame() {
  const s = useQa();
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: (s.dark ? darkTokens : lightTokens).paper }}>
      <OnboardingScreen profile={null} chapterSeen={!!g.__seen} onDone={() => { g.__done = true; }} onSkip={() => { g.__skipped = true; }} />
    </View>
  );
}
g.__mount = () => {
  g.__root = createRoot(document.getElementById('root')!);
  g.__root.render(<Frame />);
};
g.__ready = true;
`
);

const jpgData = `data:image/jpeg;base64,${b64(path.join(MOBILE, 'assets/brand/maranatha-portrait-crop-512.jpg'))}`;

const plugin = {
  name: 'qa-stubs',
  setup(b) {
    const to = (filter, file) => b.onResolve({ filter }, () => ({ path: file }));
    to(/context\/PreferencesContext$/, prefs);
    to(/context\/AuthContext$/, auth);
    to(/services\/firebase\/userProfile$/, profile);
    to(/onboarding\/useKeyboard$/, keyboard);
    to(/^\.\/useKeyboard$/, keyboard);
    to(/^react-native-safe-area-context$/, safeArea);
    to(/^@react-native-async-storage\/async-storage$/, asyncStorage);
    to(/^expo-font$/, expoFont);
    to(/^react-native$/, rnShim);
    b.onResolve({ filter: /\.ttf$/ }, (a) => ({ path: a.path, namespace: 'empty' }));
    b.onResolve({ filter: /\.(jpg|png)$/ }, (a) => ({ path: a.path, namespace: 'image' }));
    b.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: 'export default 0;', loader: 'js' }));
    // CommonJS, because the screen asks for it with require(): that must return the {uri}, not a namespace.
    b.onLoad({ filter: /.*/, namespace: 'image' }, () => ({
      contents: `module.exports = { uri: ${JSON.stringify(jpgData)} };`,
      loader: 'js',
    }));
  },
};

const bundle = path.join(OUT, 'onboarding-screen.bundle.js');
await build({
  entryPoints: [mountEntry],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  outfile: bundle,
  logLevel: 'warning',
  plugins: [plugin],
  alias: {
    react: path.join(nm, 'react'),
    'react-dom': path.join(nm, 'react-dom'),
    'react-native-svg': path.join(MOBILE, 'node_modules/react-native-svg'),
  },
  resolveExtensions: ['.web.js', '.web.ts', '.web.tsx', '.js', '.ts', '.tsx', '.json'],
  mainFields: ['browser', 'module', 'main'],
  define: { 'process.env.NODE_ENV': '"production"', __DEV__: 'false', global: 'globalThis' },
  jsx: 'automatic',
});

const fontFace = ['HindGuntur-Regular', 'HindGuntur-Medium', 'HindGuntur-SemiBold', 'HindGuntur-Bold', 'NotoSerif-Regular', 'NotoSerif-SemiBold', 'NotoSerifTelugu-Regular', 'NotoSerifTelugu-SemiBold']
  .map((n) => `@font-face{font-family:'${n}';src:url(file://${path.join(MOBILE, 'assets/fonts', n + '.ttf')});font-display:block}`)
  .join('\n');
const html = path.join(OUT, 'onboarding-screen.html');
fs.writeFileSync(
  html,
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${fontFace}
html,body{margin:0;padding:0;height:100%;overflow:hidden;-webkit-font-smoothing:antialiased}
#root{position:absolute;inset:0}
/* a browser draws a focus ring a phone does not */
input,textarea{outline:none !important}</style></head><body><div id="root"></div>
<script>window.__seen = new URLSearchParams(location.search).get('seen') === '1';</script>
<script src="file://${bundle}"></script></body></html>`
);

// ---------------------------------------------------------------------------------------------
// Driving it
// ---------------------------------------------------------------------------------------------
const PHONE = { w: 390, h: 844, insets: { top: 47, bottom: 34, left: 0, right: 0 } };
const SMALL_IOS = { w: 375, h: 667, insets: { top: 20, bottom: 0, left: 0, right: 0 } };
const SMALL_ANDROID = { w: 360, h: 640, insets: { top: 24, bottom: 0, left: 0, right: 0 } };
const TABLET = { w: 820, h: 1180, insets: { top: 24, bottom: 20, left: 0, right: 0 } };

const browser = await launch();
const problems = [];

async function open(label, cfg, opts = {}) {
  const context = await browser.newContext({
    viewport: { width: cfg.w, height: cfg.h },
    deviceScaleFactor: 2,
    reducedMotion: opts.reduced ? 'reduce' : 'no-preference',
    colorScheme: opts.dark ? 'dark' : 'light',
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => problems.push(`${label}: pageerror ${e.message}`));
  page.on('console', (m) => {
    const text = m.text();
    if (/useNativeDriver|Animated:/.test(text)) return;
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`${label}: ${m.type()} ${text}`);
  });
  // A fake clock that STOPS: until the test advances it nothing moves, so a shot "at 2.8 s" is exact.
  await page.clock.install({ time: 0 });
  await page.goto(`file://${html}${opts.seen ? '?seen=1' : ''}`);
  await page.waitForFunction(() => window.__ready === true);
  await page.clock.pauseAt(1000);
  await page.evaluate(
    (c) => window.__qa.set({ dark: c.dark, language: c.language, insets: c.insets, displayName: c.displayName, failSave: c.failSave || false }),
    { dark: !!opts.dark, language: opts.language ?? 'en', insets: cfg.insets, displayName: opts.displayName ?? null, failSave: opts.failSave }
  );
  await page.evaluate(() => window.__mount());
  const screen = {
    page,
    context,
    label,
    async advance(ms) {
      await page.clock.runFor(ms);
      await page.waitForTimeout(40);
    },
    async shot(name) {
      const file = path.join(SHOTS, `${label}__${name}.png`);
      await page.screenshot({ path: file });
      return file;
    },
    tid: (id) => page.getByTestId(id),
    async tap(id) {
      await page.getByTestId(id).click({ force: true });
      await page.waitForTimeout(40);
    },
    async type(id, text) {
      await page.getByTestId(id).fill(text);
      await page.waitForTimeout(40);
    },
    async keyboard(height) {
      await page.evaluate((h) => window.__qa.set({ keyboard: h }), height);
      await screen.advance(400);
    },
    async skipChapter() {
      const skip = page.getByTestId('onboarding-chapter-skip');
      if (await skip.count()) await skip.click({ force: true });
      await screen.advance(1200);
    },
    async calls() {
      return page.evaluate(() => window.__calls);
    },
    async close() {
      await context.close();
    },
  };
  await screen.advance(50); // the chapter-seen read resolves
  return screen;
}

const scenarios = {
  // ---- the chapter, light and dark, first time and returning ----
  async 'chapter-light'() {
    const s = await open('chapter-light', PHONE, { displayName: 'Ruth Anand' });
    let t = 0;
    for (const at of [0.1, 0.8, 1.4, 1.9, 2.4, 2.9, 3.4, 3.8, 4.2, 4.7, 5.4]) {
      await s.advance((at - t) * 1000);
      t = at;
      await s.shot(`t${at.toFixed(1)}`);
    }
    await s.close();
  },
  async 'chapter-dark'() {
    const s = await open('chapter-dark', PHONE, { dark: true, displayName: 'Ruth Anand' });
    let t = 0;
    for (const at of [0.1, 1.4, 2.4, 3.4, 4.2, 5.4]) {
      await s.advance((at - t) * 1000);
      t = at;
      await s.shot(`t${at.toFixed(1)}`);
    }
    await s.close();
  },
  async 'chapter-resume'() {
    const s = await open('chapter-resume', PHONE, { seen: true, displayName: 'Ruth Anand' });
    let t = 0;
    for (const at of [0.1, 0.6, 1.2, 2.2]) {
      await s.advance((at - t) * 1000);
      t = at;
      await s.shot(`t${at.toFixed(1)}`);
    }
    await s.close();
  },
  async 'chapter-te'() {
    const s = await open('chapter-te', PHONE, { language: 'te', displayName: 'రూత్' });
    let t = 0;
    for (const at of [0.1, 2.4, 4.2, 5.4]) {
      await s.advance((at - t) * 1000);
      t = at;
      await s.shot(`t${at.toFixed(1)}`);
    }
    await s.close();
  },
  async 'chapter-tablet'() {
    const s = await open('chapter-tablet', TABLET, { displayName: 'Ruth Anand' });
    let t = 0;
    for (const at of [0.1, 2.4, 3.8, 5.4]) {
      await s.advance((at - t) * 1000);
      t = at;
      await s.shot(`t${at.toFixed(1)}`);
    }
    await s.close();
  },

  // ---- the five questions ----
  async 'questions-light'() {
    const s = await open('questions-light', PHONE);
    await s.skipChapter();
    await s.shot('q1-empty');
    await s.tap('onboarding-continue');
    await s.advance(300);
    await s.shot('q1-error');
    await s.type('onboarding-full-name', 'Ruth Anand');
    await s.shot('q1-filled');
    await s.tap('onboarding-continue');
    await s.advance(500);
    await s.shot('q2-empty');
    await s.type('onboarding-age', '9x');
    await s.tap('onboarding-continue');
    await s.advance(300);
    await s.shot('q2-error');
    await s.type('onboarding-age', '34');
    await s.shot('q2-filled');
    await s.tap('onboarding-continue');
    await s.advance(500);
    await s.shot('q3-empty');
    await s.type('onboarding-phone', '12');
    await s.tap('onboarding-continue');
    await s.advance(300);
    await s.shot('q3-error');
    await s.tap('onboarding-country');
    await s.advance(500);
    await s.shot('q3-country-sheet');
    await s.tap('onboarding-country-IN');
    await s.advance(500);
    await s.type('onboarding-phone', '98765 43210');
    await s.shot('q3-filled');
    await s.tap('onboarding-continue');
    await s.advance(500);
    await s.shot('q4-empty');
    await s.tap('onboarding-continue');
    await s.advance(300);
    await s.shot('q4-error');
    await s.tap('onboarding-gender-female');
    await s.shot('q4-selected');
    await s.tap('onboarding-continue');
    await s.advance(500);
    await s.shot('q5-english');
    await s.tap('onboarding-language-te');
    await s.advance(300);
    await s.shot('q5-telugu-selected');
    console.log('   calls so far:', JSON.stringify(await s.calls()));
    await s.close();
  },
  async 'questions-skip-phone'() {
    const s = await open('questions-skip-phone', PHONE, { displayName: 'Ruth Anand' });
    await s.skipChapter();
    await s.tap('onboarding-continue');
    await s.advance(500);
    await s.type('onboarding-age', '34');
    await s.tap('onboarding-continue');
    await s.advance(500);
    await s.tap('onboarding-skip-phone');
    await s.advance(500);
    await s.shot('q4-after-skip');
    await s.close();
  },
  async 'save-failed'() {
    const s = await open('save-failed', PHONE, { displayName: 'Ruth Anand', failSave: true });
    await s.skipChapter();
    await s.tap('onboarding-continue');
    await s.advance(500);
    await s.type('onboarding-age', '34');
    await s.tap('onboarding-continue');
    await s.advance(500);
    await s.tap('onboarding-skip-phone');
    await s.advance(500);
    await s.tap('onboarding-gender-male');
    await s.tap('onboarding-continue');
    await s.advance(500);
    await s.tap('onboarding-submit');
    await s.advance(500);
    await s.shot('q5-save-failed');
    await s.close();
  },
  async saving() {
    const s = await open('saving', PHONE, { displayName: 'Ruth Anand', failSave: 'hang' });
    await s.skipChapter();
    await s.tap('onboarding-continue');
    await s.advance(500);
    await s.type('onboarding-age', '34');
    await s.tap('onboarding-continue');
    await s.advance(500);
    await s.tap('onboarding-skip-phone');
    await s.advance(500);
    await s.tap('onboarding-gender-female');
    await s.tap('onboarding-continue');
    await s.advance(500);
    await s.tap('onboarding-submit');
    await s.advance(500);
    await s.shot('q5-saving');
    await s.close();
  },
  async 'questions-dark'() {
    const s = await open('questions-dark', PHONE, { dark: true, displayName: 'Ruth Anand' });
    await s.skipChapter();
    await s.shot('q1');
    await s.tap('onboarding-continue');
    await s.advance(500);
    await s.type('onboarding-age', '34');
    await s.tap('onboarding-continue');
    await s.advance(500);
    await s.shot('q3-phone');
    await s.type('onboarding-phone', '12');
    await s.tap('onboarding-continue');
    await s.advance(300);
    await s.shot('q3-error');
    await s.tap('onboarding-skip-phone');
    await s.advance(500);
    await s.tap('onboarding-gender-male');
    await s.shot('q4');
    await s.tap('onboarding-continue');
    await s.advance(500);
    await s.shot('q5');
    await s.close();
  },
  async 'questions-te'() {
    const s = await open('questions-te', PHONE, { language: 'te', displayName: 'రూత్ ఆనంద్' });
    await s.skipChapter();
    await s.shot('q1');
    await s.tap('onboarding-continue');
    await s.advance(500);
    await s.shot('q2');
    await s.type('onboarding-age', '34');
    await s.tap('onboarding-continue');
    await s.advance(500);
    await s.shot('q3');
    await s.type('onboarding-phone', '12');
    await s.tap('onboarding-continue');
    await s.advance(300);
    await s.shot('q3-error');
    await s.tap('onboarding-skip-phone');
    await s.advance(500);
    await s.tap('onboarding-continue');
    await s.advance(300);
    await s.shot('q4-error');
    await s.tap('onboarding-gender-female');
    await s.tap('onboarding-continue');
    await s.advance(500);
    await s.shot('q5');
    await s.close();
  },

  // ---- small screens and the keyboard ----
  async 'small-ios'() {
    const s = await open('small-ios', SMALL_IOS, { displayName: 'Ruth Anand' });
    await s.shot('chapter-t0.1');
    await s.advance(3900);
    await s.shot('chapter-t4.0');
    await s.skipChapter();
    await s.shot('q1');
    await s.keyboard(260);
    await s.shot('q1-keyboard');
    await s.keyboard(0);
    await s.tap('onboarding-continue');
    await s.advance(500);
    await s.type('onboarding-age', '34');
    await s.tap('onboarding-continue');
    await s.advance(500);
    await s.shot('q3');
    await s.keyboard(260);
    await s.shot('q3-keyboard');
    await s.close();
  },
  async 'small-android'() {
    const s = await open('small-android', SMALL_ANDROID, { displayName: 'Ruth Anand' });
    await s.skipChapter();
    await s.shot('q1');
    await s.keyboard(250);
    await s.shot('q1-keyboard');
    await s.keyboard(0);
    await s.tap('onboarding-continue');
    await s.advance(500);
    await s.type('onboarding-age', '34');
    await s.tap('onboarding-continue');
    await s.advance(500);
    await s.tap('onboarding-skip-phone');
    await s.advance(500);
    await s.tap('onboarding-gender-male');
    await s.tap('onboarding-continue');
    await s.advance(500);
    await s.shot('q5');
    await s.close();
  },
  async 'keyboard-tall'() {
    const s = await open('keyboard-tall', PHONE, { displayName: 'Ruth Anand' });
    await s.skipChapter();
    await s.keyboard(336);
    await s.shot('q1-keyboard');
    await s.keyboard(0);
    await s.shot('q1-keyboard-closed');
    await s.close();
  },
  async 'reduced-motion'() {
    const s = await open('reduced-motion', PHONE, { reduced: true, displayName: 'Ruth Anand' });
    await s.advance(100);
    await s.shot('q1');
    await s.close();
  },
  async 'tablet'() {
    const s = await open('tablet', TABLET, { displayName: 'Ruth Anand' });
    await s.skipChapter();
    await s.shot('q1');
    await s.tap('onboarding-continue');
    await s.advance(500);
    await s.type('onboarding-age', '34');
    await s.tap('onboarding-continue');
    await s.advance(500);
    await s.shot('q3');
    await s.close();
  },
};

for (const [name, run] of Object.entries(scenarios)) {
  if (only && !name.includes(only)) continue;
  process.stdout.write(`${name} ... `);
  try {
    await run();
    console.log('ok');
  } catch (e) {
    console.log('FAILED');
    problems.push(`${name}: ${e.message.split('\n')[0]}`);
  }
}
await browser.close();
console.log(problems.length ? 'PROBLEMS:\n' + [...new Set(problems)].join('\n') : 'no console errors or warnings');
console.log('screenshots:', SHOTS);
process.exit(problems.length ? 1 : 0);
