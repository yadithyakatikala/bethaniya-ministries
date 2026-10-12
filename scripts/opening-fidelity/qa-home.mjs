// Visual QA of the REAL Home screen, in Chromium, through react-native-web: light, dark, Telugu, a new
// member with nothing yet, a live service, a verse on a photograph, a long Prophet Verse, and the small
// phones. The real HomeScreen, its real children, the real contexts and services run against the
// seeded in-memory Firestore in ./qa-fakes.mjs; nothing reaches a network.
//
// It is a LOOK, not React Native: text metrics, the native animation driver and the safe-area insets
// differ on a phone. Screenshots land in out/qa-shots/home-*.png, to be laid beside the approved still.
// The script also measures the gaps between the pieces and checks them against the design's rhythm.
//
//   node qa-home.mjs              # everything
//   node qa-home.mjs photo        # only scenarios whose name contains "photo"
import path from 'path';
import { DEVICES, MOBILE, OUT, buildQa, launch, openQa } from './qa-lib.mjs';

const only = process.argv[2] ?? '';
const T = (p) => JSON.stringify(path.join(MOBILE, 'src', p));
// The entry file lives under out/, so it reaches the app's own packages by path.
const NM = (p) => JSON.stringify(path.join(MOBILE, 'node_modules', p));

const entry = `
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Text, View } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer } from ${NM('@react-navigation/native')};
import { createNativeStackNavigator } from ${NM('@react-navigation/native-stack')};
import { AuthProvider } from ${T('context/AuthContext')};
import { PreferencesProvider } from ${T('context/PreferencesContext')};
import { useTheme } from ${T('theme')};
import { HomeScreen } from ${T('features/auth/HomeScreen')};

const Stack = createNativeStackNavigator();
const DESTINATIONS = ['Announcements', 'DailyVerse', 'PrayerWall', 'CommunityChat', 'MediaFeed', 'EventsList',
  'EventDetail', 'BibleChapter', 'PlansList', 'PlanDay'];

function Stub({ route }: any) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text testID="stub-name">{route.name}</Text>
      <Text testID="stub-params">{JSON.stringify(route.params ?? null)}</Text>
    </View>
  );
}

function Root() {
  const { colors, isDark } = useTheme();
  const base = isDark ? DarkTheme : DefaultTheme;
  return (
    <NavigationContainer theme={{ ...base, colors: { ...base.colors, background: colors.paper, card: colors.surface } }}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: colors.paper } }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        {DESTINATIONS.map((name) => <Stack.Screen key={name} name={name} component={Stub} />)}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const g = globalThis as any;
g.__mount = () => {
  createRoot(document.getElementById('root')!).render(
    <AuthProvider><PreferencesProvider><Root /></PreferencesProvider></AuthProvider>
  );
};
g.__ready = true;
`;

const { html } = await buildQa({ name: 'qa-home', entry });
const browser = await launch();
const problems = [];
const hooks = { problems, shots: path.join(OUT, 'qa-shots') };

// Sunday 11 October 2026, 09:30 in India -- the day of the approved still.
const NOW = Date.UTC(2026, 9, 11, 4, 0, 0);

/** Runs IN THE PAGE: seeds the member, the church and whatever a scenario asks for. */
const seed = (d) => {
  const ts = (ms) => window.__fs.Timestamp.fromMillis(ms);
  const now = Date.now();
  const hour = 3_600_000;
  const docs = {};
  docs['settings/church'] = { churchName: d.churchName, ...(d.logoUrl ? { logoUrl: d.logoUrl } : {}) };
  if (d.pool) {
    docs['settings/dailyVerse'] = { enabled: true, seed: 'qa', poolVersion: 1, timezone: 'Asia/Kolkata' };
    docs['verse_pool/v1'] = { ...d.pool, order: 0, active: true };
  }
  if (d.override) {
    docs['daily_verses/today'] = { date: '2026-10-11', ...d.override, createdAt: ts(now) };
  }
  if (d.plan) {
    docs['plans/p1'] = {
      title: d.plan.title, description: '', category: 'Devotional', dayCount: d.plan.dayCount, published: true, order: 0,
    };
    docs['users/qa-member/planProgress/p1'] = {
      startedAt: ts(now - 48 * hour), currentDay: d.plan.day, completedDays: d.plan.done, lastReadAt: ts(now - hour),
    };
  }
  if (d.position) docs['users/qa-member/readingPosition/' + d.position.translation] = { ...d.position.value, updatedAt: ts(now) };
  if (d.prophet) docs['prophet_verses/p1'] = { ...d.prophet, published: true, publishAt: ts(now - 24 * hour) };
  (d.events ?? []).forEach((e, i) => {
    docs['events/e' + i] = { description: '', youtubeUrl: '', published: true, isLive: false, ...e, startsAt: ts(e.startsAt) };
  });
  (d.media ?? []).forEach((m, i) => {
    docs['media/m' + i] = { caption: '', published: true, authorName: 'Pastor', ...m, publishAt: ts(now - (i + 1) * hour) };
  });
  window.__fs.seed(docs);
  window.__auth.signIn({ uid: 'qa-member', displayName: d.name, email: 'joshua@example.com', providerData: [] });
};

const PICTURES = {
  a: ['#CDBBA0', '#8F7C63'],
  b: ['#B9C2C4', '#6F8085'],
  c: ['#D6C3B0', '#9A6E55'],
  photo: ['#D2B895', '#5B4331'],
  white: ['#FFFFFF', '#F6F6F6'],
};
const svg = (a, b) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="600" height="600" fill="url(#g)"/></svg>`;

/** Answers the pictures a church would have hosted, with no network. */
async function setup(page) {
  await page.route('https://example.org/**', (route) => {
    const key = /qa-(\w+)\.svg/.exec(route.request().url())?.[1] ?? 'a';
    const [a, b] = PICTURES[key] ?? PICTURES.a;
    return route.fulfill({ contentType: 'image/svg+xml', body: svg(a, b) });
  });
}

const FULL = {
  name: 'Joshua',
  churchName: 'Maranatha',
  pool: { reference: 'John 14:27', bookId: 'john', chapter: 14, verse: 27 },
  plan: { title: 'Seven Days in the Psalms', dayCount: 7, day: 2, done: [1] },
  position: { translation: 'en', value: { bookId: 'john', chapter: 3, verse: 1 } },
  prophet: { title: 'Be still', reference: 'Psalm 46:10', text: 'Be still, and know that I am God.' },
  events: [
    { title: 'Wednesday Prayer Meeting', location: 'Main hall', startsAt: Date.UTC(2026, 9, 14, 13, 0) },
  ],
  media: [
    { type: 'image', mediaUrl: 'https://example.org/qa-a.svg' },
    { type: 'image', mediaUrl: 'https://example.org/qa-b.svg' },
    { type: 'image', mediaUrl: 'https://example.org/qa-c.svg' },
  ],
};

const EN = { app_language_preference: 'en', bible_mode_preference: 'en' };
const TE = { app_language_preference: 'te', bible_mode_preference: 'te' };

const SCENARIOS = [
  { name: 'light', data: FULL, storage: EN },
  { name: 'dark', data: FULL, storage: { ...EN, theme_preference: 'dark' }, dark: true },
  {
    name: 'te',
    storage: TE,
    data: {
      ...FULL,
      name: 'జాషువా',
      plan: { title: 'కీర్తనలలో ఏడు రోజులు', dayCount: 7, day: 2, done: [1] },
      position: { translation: 'te', value: { bookId: 'john', chapter: 3, verse: 1 } },
      prophet: {
        title: 'నిశ్శబ్దంగా ఉండండి',
        reference: 'కీర్తనల గ్రంథము 46:10',
        text: 'నిశ్శబ్దంగా ఉండండి. నేనే యెహోవాని అని తెలుసుకోండి.',
      },
      events: [{ title: 'బుధవారం ప్రార్థన కూడిక', location: 'ప్రధాన మందిరం', startsAt: Date.UTC(2026, 9, 14, 13, 0) }],
    },
  },
  { name: 'te-dark', storage: { ...TE, theme_preference: 'dark' }, dark: true, data: null },
  {
    name: 'new',
    storage: EN,
    data: { name: 'Joshua', churchName: 'Maranatha', pool: FULL.pool },
  },
  {
    name: 'live',
    storage: EN,
    data: {
      ...FULL,
      events: [
        { title: 'Sunday Worship', location: 'Main hall', startsAt: Date.UTC(2026, 9, 11, 3, 30), isLive: true },
        ...FULL.events,
      ],
    },
  },
  {
    name: 'photo',
    storage: EN,
    data: {
      ...FULL,
      pool: undefined,
      override: {
        reference: 'John 14:27 (NIV)',
        text: 'Peace I leave with you; my peace I give you. I do not give to you as the world gives. Do not let your hearts be troubled and do not be afraid.',
        imageUrl: 'https://example.org/qa-photo.svg',
      },
    },
  },
  {
    name: 'photo-white',
    storage: EN,
    data: {
      ...FULL,
      pool: undefined,
      override: {
        reference: 'Psalm 23:1',
        text: 'The Lord is my shepherd; I shall not want.',
        imageUrl: 'https://example.org/qa-white.svg',
      },
    },
  },
  {
    name: 'long-prophet',
    storage: EN,
    data: {
      ...FULL,
      prophet: {
        title: 'A word for the church',
        reference: 'Isaiah 43:18-19',
        text:
          'Do not remember the former things, nor consider the things of old. Behold, I will do a new thing; now it shall spring forth; shall you not know it? I will even make a road in the wilderness and rivers in the desert. The beasts of the field will honor me, the jackals and the ostriches, because I give water in the wilderness, rivers in the desert, to give drink to my chosen people.',
        attribution: 'Pastor Samuel',
      },
    },
    expand: true,
  },
  {
    name: 'both',
    storage: { app_language_preference: 'en', bible_mode_preference: 'bilingual' },
    data: FULL,
  },
];
SCENARIOS.find((s) => s.name === 'te-dark').data = SCENARIOS.find((s) => s.name === 'te').data;

const GAPS = [
  // [label, from testID bottom, to testID top, expected]
  ['verse → Continue reading', 'daily-verse-card', 'continue-reading-button', 32],
  ['Continue reading → plan', 'continue-reading-button', 'home-active-plan', 24],
];

const metrics = [];
for (const scenario of SCENARIOS) {
  if (only && !scenario.name.includes(only)) continue;
  const device = scenario.device ?? DEVICES.PHONE;
  const qa = await openQa(
    browser,
    html,
    `home-${scenario.name}`,
    device,
    {
      dark: scenario.dark,
      language: scenario.storage.app_language_preference,
      storage: scenario.storage,
      startTime: NOW,
      displayName: scenario.data.name,
      setup,
      beforeMount: `(${seed.toString()})(${JSON.stringify(scenario.data)})`,
    },
    hooks
  );
  await qa.advance(1200);
  await qa.advance(1200);
  // first screen, as a phone shows it
  await qa.shot('first');
  // the whole of it: scroll to the foot and shoot the scroller's full height
  const height = await qa.eval(() => {
    const el = document.querySelector('[data-testid="home-screen"]');
    return el ? el.scrollHeight : 0;
  });
  await qa.page.setViewportSize({ width: device.w, height: Math.max(device.h, height + device.insets.top + 8) });
  await qa.advance(300);
  if (scenario.expand) {
    // held to four lines, with "Read more" -- then opened
    await qa.shot('clamped');
    await qa.eval(() => {
      const el = document.querySelector('[data-testid="prophet-verse-toggle"]');
      if (el) el.click();
    });
    await qa.advance(200);
  }
  await qa.shot('full');

  // rhythm: where each piece sits, relative to the scroller's top
  if (scenario.name === 'light' || scenario.name === 'live') {
    const rects = await qa.eval(() => {
      const root = document.querySelector('[data-testid="home-screen"]').getBoundingClientRect();
      const get = (id) => {
        const el = document.querySelector(`[data-testid="${id}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top - root.top), bottom: Math.round(r.bottom - root.top), height: Math.round(r.height), left: Math.round(r.left), right: Math.round(root.right - r.right) };
      };
      const labels = [...document.querySelectorAll('[role="heading"],h1,h2,h3')];
      return {
        branding: get('church-branding'),
        verse: get('daily-verse-card'),
        read: get('daily-verse-read'),
        share: get('daily-verse-share'),
        cont: get('continue-reading-button'),
        plan: get('home-active-plan'),
        prophet: get('prophet-verse-section-title'),
        prophetCard: get('prophet-verse-card'),
        event: get('home-next-event'),
        eventLink: get('home-events-see-all'),
        together: get('home-together'),
        live: get('home-live-banner'),
        headings: labels.map((l) => [l.textContent, Math.round(l.getBoundingClientRect().top - root.top)]),
      };
    });
    metrics.push({ scenario: scenario.name, rects });
  }
  // the first screen on a small phone must still reach "Read chapter"
  await qa.close();
}

// Small phones: does the hero still fit, does anything overflow sideways?
for (const [name, device] of [
  ['small-ios', DEVICES.SMALL_IOS],
  ['small-android', DEVICES.SMALL_ANDROID],
]) {
  if (only && !name.includes(only)) continue;
  const qa = await openQa(
    browser,
    html,
    `home-${name}`,
    device,
    {
      storage: EN,
      startTime: NOW,
      displayName: 'Joshua',
      setup,
      beforeMount: `(${seed.toString()})(${JSON.stringify(FULL)})`,
    },
    hooks
  );
  await qa.advance(1200);
  await qa.advance(1200);
  await qa.shot('first');
  const overflow = await qa.eval(() => {
    const el = document.querySelector('[data-testid="home-screen"]');
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
  });
  if (overflow.scrollWidth > overflow.clientWidth)
    problems.push(`home-${name}: sideways overflow ${overflow.scrollWidth} > ${overflow.clientWidth}`);
  await qa.close();
}

await browser.close();

for (const { scenario, rects } of metrics) {
  console.log(`\n== ${scenario}`);
  const gap = (a, b) => (rects[a] && rects[b] ? rects[b].top - rects[a].bottom : null);
  console.log('header height      ', rects.branding?.height, '(expect 56)');
  console.log('verse → continue   ', gap('verse', 'cont'), '(expect 32)');
  console.log('continue → plan    ', gap('cont', 'plan'), '(expect 24)');
  console.log('plan → prophet     ', gap('plan', 'prophet'), '(expect 32)');
  console.log('prophet → event row', gap('prophetCard', 'event'), '(label row 44 high, centre of label 32 below the quote: expect 18 + 14)');
  console.log('event → together   ', gap('event', 'together'), '(expect 32)');
  console.log('margins (verse)    ', rects.verse?.left, rects.verse?.right, '(expect 20, 20)');
  console.log('Read chapter height', rects.read?.height, '(expect 48)');
  console.log('Share target       ', rects.share?.height, 'x', rects.share?.height, '(expect 44)');
  console.log('headings           ', JSON.stringify(rects.headings));
}
console.log(problems.length ? '\nPROBLEMS:\n' + [...new Set(problems)].join('\n') : '\nno console errors or warnings');
