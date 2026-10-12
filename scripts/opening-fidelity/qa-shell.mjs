// Visual QA of the navigation SHELL, in Chromium, through react-native-web: the five-tab bar with its gold
// ribbon and the member's monogram, and the screens it opens that are new -- Community's Updates feed (with
// the shelf), the You hub (Saved and Profile), the Saved verses lists and the shared update detail -- in
// light, dark and Telugu. The real screens, the real TabBar, the real contexts and services run against the
// seeded in-memory Firestore in ./qa-fakes.mjs; nothing reaches a network.
//
// It is a LOOK, not React Native: text metrics, the native animation driver and the safe-area insets differ
// on a phone. Screenshots land in out/qa-shots/shell-*.png, to be laid beside the approved stills. The script
// also measures the pieces the design gives numbers for and prints them.
//
//   node qa-shell.mjs              # everything
//   node qa-shell.mjs you          # only scenarios whose name contains "you"
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
import { DarkTheme, DefaultTheme, NavigationContainer, createNavigationContainerRef } from ${NM('@react-navigation/native')};
import { createNativeStackNavigator } from ${NM('@react-navigation/native-stack')};
import { AuthProvider } from ${T('context/AuthContext')};
import { PreferencesProvider } from ${T('context/PreferencesContext')};
import { useTheme } from ${T('theme')};
import { HomeScreen } from ${T('features/auth/HomeScreen')};
import { PrayersHubScreen } from ${T('features/prayers/PrayersHubScreen')};
import { CommunityHubScreen } from ${T('features/community/CommunityHubScreen')};
import { YouScreen } from ${T('features/you/YouScreen')};
import { SavedVersesScreen } from ${T('features/you/SavedVersesScreen')};
import { AnnouncementDetailScreen } from ${T('features/announcements/AnnouncementDetailScreen')};
import { CommunityPostDetailScreen } from ${T('features/community/CommunityPostDetailScreen')};
import { TabBar } from ${T('navigation/TabBar')};

const Stack = createNativeStackNavigator();
const ref = createNavigationContainerRef();
const TABS = new Set(['Home', 'BibleBooks', 'PrayersHub', 'CommunityHub', 'You']);
const OTHER = ['BibleBooks', 'EventsList', 'SongsList', 'MediaFeed', 'Settings', 'NotificationCenter', 'PlansList',
  'SavedMedia', 'DailyVerse', 'EventDetail', 'BibleChapter', 'PlanDay'];

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
  const [active, setActive] = React.useState<string | undefined>(undefined);
  const initial = (globalThis as any).__qaRoute ?? { name: 'Home' };
  return (
    <NavigationContainer
      ref={ref}
      theme={{ ...base, colors: { ...base.colors, background: colors.paper, card: colors.surface } }}
      onReady={() => setActive(ref.getCurrentRoute()?.name)}
      onStateChange={() => setActive(ref.getCurrentRoute()?.name)}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <Stack.Navigator
            initialRouteName={initial.name}
            screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: colors.paper } }}
          >
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="PrayersHub" component={PrayersHubScreen} initialParams={initial.name === 'PrayersHub' ? initial.params : undefined} />
            <Stack.Screen name="CommunityHub" component={CommunityHubScreen} initialParams={initial.name === 'CommunityHub' ? initial.params : undefined} />
            <Stack.Screen name="You" component={YouScreen} initialParams={initial.name === 'You' ? initial.params : undefined} />
            <Stack.Screen name="SavedVerses" component={SavedVersesScreen} initialParams={initial.name === 'SavedVerses' ? initial.params : undefined} />
            <Stack.Screen name="AnnouncementDetail" component={AnnouncementDetailScreen} initialParams={initial.name === 'AnnouncementDetail' ? initial.params : undefined} />
            <Stack.Screen name="CommunityPostDetail" component={CommunityPostDetailScreen} initialParams={initial.name === 'CommunityPostDetail' ? initial.params : undefined} />
            {OTHER.map((name) => <Stack.Screen key={name} name={name} component={Stub} />)}
          </Stack.Navigator>
        </View>
        {active && TABS.has(active) ? (
          <TabBar activeRoute={active} onNavigate={(route: string) => ref.isReady() && (ref as any).navigate(route, undefined, { pop: true })} />
        ) : null}
      </View>
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

const { html } = await buildQa({ name: 'qa-shell', entry });
const browser = await launch();
const problems = [];
const hooks = { problems, shots: path.join(OUT, 'qa-shots') };

// Sunday 11 October 2026, 09:30 in India.
const NOW = Date.UTC(2026, 9, 11, 4, 0, 0);

/** Runs IN THE PAGE: seeds the member, the church and whatever a scenario asks for. */
const seed = (d) => {
  const ts = (ms) => window.__fs.Timestamp.fromMillis(ms);
  const now = Date.now();
  const hour = 3_600_000;
  const day = 24 * hour;
  const docs = {};
  docs['settings/church'] = { churchName: d.churchName };
  (d.announcements ?? []).forEach((a, i) => {
    docs['announcements/a' + i] = { published: true, imageUrl: null, ...a, createdAt: ts(now - (a.ageH ?? (i + 1) * 20) * hour) };
    delete docs['announcements/a' + i].ageH;
  });
  (d.posts ?? []).forEach((p, i) => {
    docs['community/p' + i] = { published: true, imageUrl: null, ...p, createdAt: ts(now - (p.ageH ?? (i + 1) * 30) * hour) };
    delete docs['community/p' + i].ageH;
  });
  (d.notes ?? []).forEach((n, i) => {
    docs['users/qa-member/verseNotes/n' + i] = { ...n.ref, text: n.text, createdAt: ts(now - n.days * day), updatedAt: ts(now - n.days * day) };
  });
  (d.highlights ?? []).forEach((h, i) => {
    docs['users/qa-member/highlights/h' + i] = { ...h.ref, colour: h.colour, createdAt: ts(now - h.days * day) };
  });
  (d.bookmarks ?? []).forEach((b, i) => {
    docs['users/qa-member/bookmarks/b' + i] = { ...b.ref, createdAt: ts(now - b.days * day) };
  });
  if (d.plan) {
    docs['plans/p1'] = { title: d.plan.title, description: '', category: 'Devotional', dayCount: 7, published: true, order: 0 };
    docs['users/qa-member/planProgress/p1'] = { startedAt: ts(now - 2 * day), currentDay: 2, completedDays: [1], lastReadAt: ts(now - hour) };
  }
  for (let i = 0; i < (d.journal ?? 0); i++) {
    docs['users/qa-member/prayers/j' + i] = { text: 'A prayer ' + i, answered: i % 3 === 0, createdAt: ts(now - (i + 1) * day), answeredAt: null };
  }
  for (let i = 0; i < (d.savedMedia ?? 0); i++) {
    docs['users/qa-member/mediaSaves/s' + i] = { createdAt: ts(now - i * day) };
  }
  window.__fs.seed(docs);
  window.__auth.signIn({
    uid: 'qa-member',
    displayName: d.name,
    email: 'joshua@example.com',
    emailVerified: true,
    providerData: [],
  });
};

const PICTURES = { a: ['#CDBBA0', '#8F7C63'], b: ['#B9C2C4', '#6F8085'] };
const svg = (a, b) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="900" height="600" fill="url(#g)"/></svg>`;

/** Answers the pictures a church would have hosted, with no network. */
async function setup(page) {
  await page.route('https://example.org/**', (route) => {
    const key = /qa-(\w+)\.svg/.exec(route.request().url())?.[1] ?? 'a';
    const [a, b] = PICTURES[key] ?? PICTURES.a;
    return route.fulfill({ contentType: 'image/svg+xml', body: svg(a, b) });
  });
}

const EN_DATA = {
  name: 'Joshua',
  churchName: 'Maranatha',
  announcements: [
    {
      title: 'Youth meeting moved to Friday',
      content:
        'The youth meeting this week is on Friday at 6pm in the hall, not Saturday.\n\nWe begin with worship, then a short word, then food. Bring a friend.',
      ageH: 20,
    },
    {
      title: 'Harvest festival: how you can help',
      content: 'We need hands for setting up on Saturday morning, for the kitchen, and for the children’s tables.',
      imageUrl: 'https://example.org/qa-a.svg',
      ageH: 70,
    },
  ],
  posts: [
    {
      title: 'A testimony from the Rao family',
      content: 'We want to thank the Lord, and all of you who prayed with us through the winter.\n\nHe has been faithful.',
      ageH: 44,
    },
    {
      title: 'Baptism Sunday photographs',
      content: 'Eleven brothers and sisters were baptised last Sunday. Here are some of the moments.',
      imageUrl: 'https://example.org/qa-b.svg',
      ageH: 200,
    },
  ],
  notes: [
    { ref: { translationId: 'en', bookId: 'john', chapter: 3, verse: 16 }, text: 'He gave: the verb is past tense. It is already done.', days: 2 },
    { ref: { translationId: 'en', bookId: 'romans', chapter: 8, verse: 28 }, text: 'Prayed about this one in a hard week.', days: 5 },
    { ref: { translationId: 'en', bookId: 'philippians', chapter: 4, verse: 6 }, text: 'Turn the worry into the request.', days: 9 },
  ],
  highlights: [
    { ref: { translationId: 'en', bookId: 'psalms', chapter: 23, verse: 1 }, colour: 'yellow', days: 2 },
    { ref: { translationId: 'en', bookId: 'isaiah', chapter: 41, verse: 10 }, colour: 'green', days: 5 },
    { ref: { translationId: 'en', bookId: 'john', chapter: 3, verse: 16 }, colour: 'blue', days: 8 },
    { ref: { translationId: 'en', bookId: 'romans', chapter: 8, verse: 28 }, colour: 'pink', days: 20 },
  ],
  bookmarks: [
    { ref: { translationId: 'en', bookId: 'john', chapter: 3, verse: 16 }, days: 2 },
    { ref: { translationId: 'en', bookId: 'psalms', chapter: 23, verse: 1 }, days: 5 },
    { ref: { translationId: 'en', bookId: 'isaiah', chapter: 41, verse: 10 }, days: 8 },
  ],
  plan: { title: 'Seven Days in the Psalms' },
  journal: 6,
  savedMedia: 4,
};

const TE_DATA = {
  ...EN_DATA,
  name: 'జాషువా',
  announcements: [
    {
      title: 'యువజన సమావేశం శుక్రవారానికి మార్పు',
      content: 'ఈ వారం యువజన సమావేశం శనివారం కాదు, శుక్రవారం సాయంత్రం 6 గంటలకు హాలులో జరుగుతుంది.\n\nఆరాధనతో మొదలుపెడతాం, తరువాత చిన్న వాక్యం, తరువాత భోజనం. ఒక స్నేహితుడిని తీసుకురండి.',
      ageH: 20,
    },
    {
      title: 'పంట పండుగ: మీరు ఎలా సహాయపడగలరు',
      content: 'శనివారం ఉదయం ఏర్పాట్లకు, వంటగదికి, పిల్లల బల్లలకు సహాయం కావాలి.',
      imageUrl: 'https://example.org/qa-a.svg',
      ageH: 70,
    },
  ],
  posts: [
    {
      title: 'రావు కుటుంబం నుండి సాక్ష్యం',
      content: 'శీతాకాలం అంతా మాతో కలిసి ప్రార్థించిన మీ అందరికీ, ప్రభువుకు కృతజ్ఞతలు.',
      ageH: 44,
    },
  ],
  notes: EN_DATA.notes.map((n, i) => ({
    ...n,
    ref: { ...n.ref, translationId: 'te' },
    text: ['ఇచ్చాడు: ఇది గతకాలంలో జరిగిన పని. ఇప్పటికే పూర్తయింది.', 'ఈ వారం కష్టకాలంలో ఈ వచనం గురించి ప్రార్థించాను.', 'చింతను ప్రార్థనగా మార్చుకోవాలి.'][i],
  })),
  plan: { title: 'కీర్తనలలో ఏడు రోజులు' },
};

const EN = { app_language_preference: 'en', bible_mode_preference: 'en' };
const TE = { app_language_preference: 'te', bible_mode_preference: 'te' };

const route = (name, params) => ({ name, params });

const SCENARIOS = [
  // --- the bar, on Home
  { name: 'home-light', storage: EN, data: EN_DATA, route: route('Home') },
  { name: 'home-dark', storage: { ...EN, theme_preference: 'dark' }, dark: true, data: EN_DATA, route: route('Home') },
  { name: 'home-te', storage: TE, data: TE_DATA, route: route('Home') },
  // --- Community
  { name: 'community-light', storage: EN, data: EN_DATA, route: route('CommunityHub') },
  { name: 'community-dark', storage: { ...EN, theme_preference: 'dark' }, dark: true, data: EN_DATA, route: route('CommunityHub') },
  { name: 'community-te', storage: TE, data: TE_DATA, route: route('CommunityHub') },
  { name: 'community-empty', storage: EN, data: { name: 'Joshua', churchName: 'Maranatha' }, route: route('CommunityHub') },
  // --- You
  { name: 'you-saved-light', storage: EN, data: EN_DATA, route: route('You') },
  { name: 'you-saved-dark', storage: { ...EN, theme_preference: 'dark' }, dark: true, data: EN_DATA, route: route('You') },
  { name: 'you-saved-te', storage: TE, data: TE_DATA, route: route('You') },
  { name: 'you-profile-light', storage: EN, data: EN_DATA, route: route('You', { tab: 'profile' }) },
  // --- Saved verses
  { name: 'saved-notes-light', storage: EN, data: EN_DATA, route: route('SavedVerses', { kind: 'notes' }) },
  { name: 'saved-notes-dark', storage: { ...EN, theme_preference: 'dark' }, dark: true, data: EN_DATA, route: route('SavedVerses', { kind: 'notes' }) },
  { name: 'saved-notes-te', storage: TE, data: TE_DATA, route: route('SavedVerses', { kind: 'notes' }) },
  { name: 'saved-highlights-light', storage: EN, data: EN_DATA, route: route('SavedVerses', { kind: 'highlights' }) },
  { name: 'saved-highlights-dark', storage: { ...EN, theme_preference: 'dark' }, dark: true, data: EN_DATA, route: route('SavedVerses', { kind: 'highlights' }) },
  { name: 'saved-bookmarks-light', storage: EN, data: EN_DATA, route: route('SavedVerses', { kind: 'bookmarks' }) },
  { name: 'saved-empty-light', storage: EN, data: { name: 'Joshua', churchName: 'Maranatha' }, route: route('SavedVerses', { kind: 'notes' }) },
  // --- The shared update detail
  {
    name: 'detail-light',
    storage: EN,
    data: EN_DATA,
    route: route('AnnouncementDetail', {
      announcement: {
        id: 'a1',
        title: EN_DATA.announcements[1].title,
        content: EN_DATA.announcements[1].content + '\n\nIf you can give an hour on Saturday morning, please tell the office.',
        imageUrl: 'https://example.org/qa-a.svg',
        createdAt: { __date: NOW - 70 * 3_600_000 },
      },
    }),
  },
  {
    name: 'detail-te',
    storage: TE,
    data: TE_DATA,
    route: route('CommunityPostDetail', {
      post: {
        id: 'p1',
        title: TE_DATA.posts[0].title,
        content: TE_DATA.posts[0].content + '\n\nఆయన నమ్మకమైనవాడు.',
        imageUrl: null,
        createdAt: { __date: NOW - 44 * 3_600_000 },
      },
    }),
  },
];

const results = [];
for (const scenario of SCENARIOS) {
  if (only && !scenario.name.includes(only)) continue;
  const device = scenario.device ?? DEVICES.PHONE;
  const qa = await openQa(
    browser,
    html,
    `shell-${scenario.name}`,
    device,
    {
      dark: scenario.dark,
      language: scenario.storage.app_language_preference,
      storage: scenario.storage,
      startTime: NOW,
      displayName: scenario.data.name,
      setup,
      // A route's params are real objects in the app -- a Date is a Date -- so the dates the JSON carried as
      // { __date: ms } are turned back into Dates in the page.
      beforeMount: `(${seed.toString()})(${JSON.stringify(scenario.data)}); window.__qaRoute = JSON.parse(${JSON.stringify(
        JSON.stringify(scenario.route)
      )}, (k, v) => (v && typeof v === 'object' && '__date' in v ? new Date(v.__date) : v));`,
    },
    hooks
  );
  await qa.advance(1200);
  await qa.advance(1200);
  await qa.shot('first');

  const m = await qa.eval(() => {
    const rect = (id) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) };
    };
    return {
      bar: rect('tab-bar'),
      tabs: ['tab-home', 'tab-bible', 'tab-prayers', 'tab-community', 'tab-you'].map((id) => [id, rect(id)]),
      ribbon: rect('tab-ribbon'),
      monogram: rect('tab-monogram'),
      avatar: rect('you-avatar'),
      name: rect('you-name'),
      shelf: rect('community-shelf'),
      doc: { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth },
    };
  });
  results.push({ scenario: scenario.name, m });
  if (m.doc.sw > m.doc.cw) problems.push(`shell-${scenario.name}: sideways overflow ${m.doc.sw} > ${m.doc.cw}`);
  await qa.close();
}

await browser.close();

for (const { scenario, m } of results) {
  if (!m.bar) continue;
  console.log(`\n== ${scenario}`);
  console.log('bar height (52 + 11 + 1 + inset)', m.bar.h);
  console.log('tab widths                      ', m.tabs.map(([, r]) => r?.w).join(' '), '(5 equal)');
  console.log('tab heights                     ', m.tabs.map(([, r]) => r?.h).join(' '), '(>= 52)');
  if (m.ribbon) console.log('ribbon                          ', `${m.ribbon.w}x${m.ribbon.h} at top ${m.ribbon.top} (bar top ${m.bar.top})`);
  if (m.monogram) console.log('monogram                        ', `${m.monogram.w}x${m.monogram.h}`, '(24x24)');
  if (m.avatar) console.log('avatar                          ', `${m.avatar.w}x${m.avatar.h}`, '(72x72)');
  if (m.shelf) console.log('shelf                           ', `left ${m.shelf.left} right ${m.shelf.right} (bleeds to the edges)`);
}
console.log(problems.length ? '\nPROBLEMS:\n' + [...new Set(problems)].join('\n') : '\nno console errors or warnings');
