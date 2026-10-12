// Shared plumbing for the browser QA scripts: bundle a React Native entry for Chromium through
// react-native-web, with the fakes in ./qa-fakes.mjs standing in for Firebase and native modules,
// and drive the result on a fake clock that stops, so "the frame at 2.8 s" is exact.
//
// Not part of the app or its tests. It is a LOOK, not React Native: KeyboardAvoidingView, the native
// animation driver, text metrics and the soft keyboard all differ on a phone.
import fs from 'fs';
import path from 'path';
import { build } from 'esbuild';
import { HERE, MOBILE, OUT, launch } from './lib.mjs';
import {
  FAKE_AUTH,
  FAKE_FIREBASE_APP,
  FAKE_FIREBASE_STORAGE,
  FAKE_FIRESTORE,
  NATIVE_STUBS,
} from './qa-fakes.mjs';

export { launch, MOBILE, OUT, HERE };

export const DEVICES = {
  PHONE: { w: 390, h: 844, insets: { top: 47, bottom: 34, left: 0, right: 0 } },
  SMALL_IOS: { w: 375, h: 667, insets: { top: 20, bottom: 0, left: 0, right: 0 } },
  SMALL_ANDROID: { w: 360, h: 640, insets: { top: 24, bottom: 0, left: 0, right: 0 } },
  TABLET: { w: 820, h: 1180, insets: { top: 24, bottom: 20, left: 0, right: 0 } },
};

const nm = path.join(HERE, 'node_modules');
const STUBS = path.join(OUT, 'qa-stubs');
fs.mkdirSync(STUBS, { recursive: true });
const b64 = (file) => fs.readFileSync(file).toString('base64');

function stub(name, text) {
  const file = path.join(STUBS, name);
  fs.writeFileSync(file, text);
  return file;
}

const FONT_FAMILIES = [
  'HindGuntur-Regular',
  'HindGuntur-Medium',
  'HindGuntur-SemiBold',
  'HindGuntur-Bold',
  'NotoSerif-Regular',
  'NotoSerif-SemiBold',
  'NotoSerifTelugu-Regular',
  'NotoSerifTelugu-SemiBold',
];

/**
 * Bundles `entry` (TSX source) with the QA fakes and writes <name>.html.
 *
 * The entry can import anything from the app by absolute path (`MOBILE` is exported) and the shared
 * fake state from './store' (`useQa`, `qa`). It must set `globalThis.__ready = true` when it can be
 * mounted, and define `globalThis.__mount()`.
 *
 * `overrides` maps a RegExp (matched against the import path) to a module path or source, for a
 * screen test that wants its own stub for one of the app's modules.
 */
export async function buildQa({ name, entry, overrides = [], env = {} }) {
  const store = stub(
    'store.ts',
    `import { useSyncExternalStore } from 'react';
export interface QaState {
  dark: boolean; language: 'en' | 'te'; keyboard: number; displayName: string | null;
  insets: { top: number; bottom: number; left: number; right: number };
  extra: Record<string, any>;
}
let snapshot: QaState = { dark: false, language: 'en', keyboard: 0, displayName: null,
  insets: { top: 47, bottom: 34, left: 0, right: 0 }, extra: {} };
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
  const safeArea = stub(
    'safearea.tsx',
    `import * as React from 'react';
import { View } from 'react-native';
import { useQa } from './store';
export const useSafeAreaInsets = () => useQa().insets;
export const useSafeAreaFrame = () => ({ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight });
export const SafeAreaProvider = ({ children }: any) => <>{children}</>;
export const SafeAreaInsetsContext = React.createContext(null as any);
export const SafeAreaFrameContext = React.createContext(null as any);
export const SafeAreaView = (props: any) => <View {...props} />;
export const initialWindowMetrics = null;
`
  );
  const asyncStorage = stub(
    'asyncstorage.ts',
    `const memory = new Map<string, string>(Object.entries((globalThis as any).__storageSeed ?? {}));
const api = {
  getItem: async (k: string) => (memory.has(k) ? memory.get(k)! : null),
  setItem: async (k: string, v: string) => { memory.set(k, v); },
  removeItem: async (k: string) => { memory.delete(k); },
  clear: async () => memory.clear(),
  getAllKeys: async () => [...memory.keys()],
  multiGet: async (keys: string[]) => keys.map((k) => [k, memory.has(k) ? memory.get(k)! : null]),
  multiSet: async (pairs: [string, string][]) => { pairs.forEach(([k, v]) => memory.set(k, v)); },
  multiRemove: async (keys: string[]) => { keys.forEach((k) => memory.delete(k)); },
};
export default api;
`
  );
  const rnShim = stub(
    'react-native-shim.tsx',
    `import * as React from 'react';
import { View, Text as WebText } from ${JSON.stringify(path.join(nm, 'react-native-web'))};
import { useQa } from './store';
export * from ${JSON.stringify(path.join(nm, 'react-native-web'))};
// react-native-web has no native node handles; a screen asks for one only to move a screen reader's focus.
export const findNodeHandle = () => null;
// Android's hardware back button does not exist in a browser.
export const BackHandler = { addEventListener: () => ({ remove() {} }), exitApp() {}, removeEventListener() {} };
export function KeyboardAvoidingView({ style, behavior: _b, children, ...rest }: any) {
  const s = useQa();
  return <View {...rest} style={[style, { paddingBottom: s.keyboard }]}>{children}</View>;
}
// react-native-web has no onTextLayout, which tells a screen how many lines its text took. A phone does;
// this reports the same thing from the browser's own layout (height over line height), so a screen that
// asks -- the Prophet Verse deciding whether to offer "Read more" -- can be looked at here.
export const Text = React.forwardRef(function Text({ onTextLayout, ...props }: any, forwarded: any) {
  const local = React.useRef<any>(null);
  React.useLayoutEffect(() => {
    const el = local.current;
    if (!onTextLayout || !el || !el.getBoundingClientRect) return;
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 1;
    const lines = Math.max(1, Math.round(el.getBoundingClientRect().height / lineHeight));
    onTextLayout({ nativeEvent: { lines: Array.from({ length: lines }, () => ({})) } });
  });
  return (
    <WebText
      {...props}
      ref={(node: any) => {
        local.current = node;
        if (typeof forwarded === 'function') forwarded(node);
        else if (forwarded) forwarded.current = node;
      }}
    />
  );
});
`
  );
  const files = {
    store,
    firestore: stub('firestore.ts', FAKE_FIRESTORE),
    auth: stub('fakeauth.ts', FAKE_AUTH),
    firebaseApp: stub('firebaseapp.ts', FAKE_FIREBASE_APP),
    firebaseStorage: stub('firebasestorage.ts', FAKE_FIREBASE_STORAGE),
  };
  const nativeFiles = Object.fromEntries(
    Object.entries(NATIVE_STUBS).map(([mod, source]) => [
      mod,
      stub('native-' + mod.replace(/[^a-z0-9]/gi, '_') + '.tsx', source),
    ])
  );

  const entryFile = stub(`entry-${name}.tsx`, entry);
  const portrait = `data:image/jpeg;base64,${b64(path.join(MOBILE, 'assets/brand/maranatha-portrait-crop-512.jpg'))}`;

  const plugin = {
    name: 'qa-fakes',
    setup(b) {
      const to = (filter, file) => b.onResolve({ filter }, () => ({ path: file }));
      for (const [filter, target] of overrides) to(filter, target);
      to(/^firebase\/firestore$/, files.firestore);
      to(/^firebase\/auth$/, files.auth);
      to(/^firebase\/app$/, files.firebaseApp);
      to(/^firebase\/storage$/, files.firebaseStorage);
      to(/^react-native-safe-area-context$/, safeArea);
      to(/^@react-native-async-storage\/async-storage$/, asyncStorage);
      to(/^react-native$/, rnShim);
      for (const [mod, file] of Object.entries(nativeFiles)) {
        to(new RegExp('^' + mod.replace(/[/.-]/g, '\\$&') + '$'), file);
      }
      b.onResolve({ filter: /\.ttf$/ }, (a) => ({ path: a.path, namespace: 'empty' }));
      b.onResolve({ filter: /\.(jpg|jpeg|png)$/ }, (a) => ({
        path: path.resolve(a.resolveDir, a.path),
        namespace: 'image',
      }));
      b.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({
        contents: 'export default 0;',
        loader: 'js',
      }));
      // CommonJS, because the app asks for these with require(): that must return the {uri}.
      b.onLoad({ filter: /.*/, namespace: 'image' }, (a) => {
        const file = a.path;
        const mime = file.endsWith('.png') ? 'image/png' : 'image/jpeg';
        const data = fs.existsSync(file) ? `data:${mime};base64,${b64(file)}` : portrait;
        return { contents: `module.exports = { uri: ${JSON.stringify(data)} };`, loader: 'js' };
      });
    },
  };

  const bundle = path.join(OUT, `${name}.bundle.js`);
  await build({
    entryPoints: [entryFile],
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
    define: {
      'process.env.NODE_ENV': '"production"',
      __DEV__: 'false',
      global: 'globalThis',
      'process.env.EXPO_PUBLIC_FIREBASE_API_KEY': '"demo-api-key"',
      'process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN': '"localhost"',
      'process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID': '"demo-maranatha"',
      'process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET': '"demo.appspot.com"',
      'process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID': '"0"',
      'process.env.EXPO_PUBLIC_FIREBASE_APP_ID': '"1:0:web:0"',
      'process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS': '"false"',
      ...env,
    },
    // Anything the app reads from process.env that is not defined above is simply undefined.
    banner: { js: 'globalThis.process = globalThis.process || { env: {} };' },
    jsx: 'automatic',
  });

  const fontFace = FONT_FAMILIES.map(
    (n) =>
      `@font-face{font-family:'${n}';src:url(file://${path.join(MOBILE, 'assets/fonts', n + '.ttf')});font-display:block}`
  ).join('\n');
  const html = path.join(OUT, `${name}.html`);
  fs.writeFileSync(
    html,
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${fontFace}
html,body{margin:0;padding:0;height:100%;overflow:hidden;-webkit-font-smoothing:antialiased}
#root{position:absolute;inset:0;display:flex}
/* a browser draws a focus ring a phone does not */
input,textarea{outline:none !important}</style></head><body><div id="root"></div>
<script>
const q = new URLSearchParams(location.search);
window.__seen = q.get('seen') === '1';
try { window.__storageSeed = JSON.parse(q.get('storage') || '{}'); } catch (e) { window.__storageSeed = {}; }
</script>
<script src="file://${bundle}"></script></body></html>`
  );
  return { html };
}

/** Opens one page of a built QA bundle. */
export async function openQa(browser, html, label, cfg, opts = {}, hooks = {}) {
  const { problems = [], shots = path.join(OUT, 'qa-shots') } = hooks;
  fs.mkdirSync(shots, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: cfg.w, height: cfg.h },
    deviceScaleFactor: opts.scale ?? 2,
    reducedMotion: opts.reduced ? 'reduce' : 'no-preference',
    colorScheme: opts.dark ? 'dark' : 'light',
    // The app's canonical zone, so "6:30 PM" is 6:30 PM whatever machine this runs on.
    timezoneId: opts.timezoneId ?? 'Asia/Kolkata',
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => problems.push(`${label}: pageerror ${e.message}`));
  page.on('console', (m) => {
    const text = m.text();
    if (/useNativeDriver|Animated:|Missing environment variable|deprecated/i.test(text)) return;
    if (m.type() === 'error' || m.type() === 'warning')
      problems.push(`${label}: ${m.type()} ${text.slice(0, 300)}`);
  });
  // Anything a scenario needs before the page loads: a network route for a picture, say.
  if (opts.setup) await opts.setup(page, context);
  // A fake clock that STOPS: until the test advances it nothing moves, so a shot "at 2.8 s" is exact.
  await page.clock.install({ time: opts.startTime ?? 1_700_000_000_000 });
  const query = new URLSearchParams();
  if (opts.seen) query.set('seen', '1');
  if (opts.storage) query.set('storage', JSON.stringify(opts.storage));
  await page.goto(`file://${html}?${query}`);
  await page.waitForFunction(() => window.__ready === true);
  // The installed clock RUNS until it is paused, so a slow load (a big bundle, a busy machine) can pass
  // the moment we meant to stop at -- and pausing in the past is an error. Stop a moment after "now".
  const loaded = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(Math.max((opts.startTime ?? 1_700_000_000_000) + 1000, loaded + 20));
  await page.evaluate(
    (c) =>
      window.__qa.set({
        dark: c.dark,
        language: c.language,
        insets: c.insets,
        displayName: c.displayName,
        extra: c.extra,
      }),
    {
      dark: !!opts.dark,
      language: opts.language ?? 'en',
      insets: cfg.insets,
      displayName: opts.displayName ?? null,
      extra: opts.extra ?? {},
    }
  );
  // A function (run in the page, no arguments) or a string expression.
  if (opts.beforeMount) await page.evaluate(opts.beforeMount);
  await page.evaluate(() => window.__mount());

  const qa = {
    page,
    context,
    label,
    async advance(ms) {
      await page.clock.runFor(ms);
      await page.waitForTimeout(40);
    },
    async shot(name, options = {}) {
      const file = path.join(shots, `${label}__${name}.png`);
      await page.screenshot({ path: file, ...options });
      return file;
    },
    tid: (id) => page.getByTestId(id),
    async has(id) {
      return (await page.getByTestId(id).count()) > 0;
    },
    async tap(id) {
      await page.getByTestId(id).first().click({ force: true });
      await page.waitForTimeout(40);
    },
    async tapText(text) {
      await page.getByText(text, { exact: true }).first().click({ force: true });
      await page.waitForTimeout(40);
    },
    async type(id, text) {
      await page.getByTestId(id).fill(text);
      await page.waitForTimeout(40);
    },
    async scrollTo(id) {
      await page.getByTestId(id).first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(40);
    },
    async keyboard(height) {
      await page.evaluate((h) => window.__qa.set({ keyboard: h }), height);
      await qa.advance(400);
    },
    async eval(fn, arg) {
      return page.evaluate(fn, arg);
    },
    async close() {
      await context.close();
    },
  };
  await qa.advance(50);
  return qa;
}
