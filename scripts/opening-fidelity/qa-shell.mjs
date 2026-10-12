// Visual QA of the navigation SHELL, in Chromium, through react-native-web: the five-tab bar with its gold
// ribbon and the member's monogram, and the screens it opens that are new -- Community's Updates feed (with
// the shelf), the You hub (Saved and Profile), the Saved verses lists, the shared update detail and the
// Prayers tab (the church's requests, the member's journal, and the sheets and pages they open) -- in
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
import { ReadingPreferencesProvider } from ${T('context/ReadingPreferencesContext')};
import { useTheme } from ${T('theme')};
import { HomeScreen } from ${T('features/auth/HomeScreen')};
import { PrayersHubScreen } from ${T('features/prayers/PrayersHubScreen')};
import { CommunityHubScreen } from ${T('features/community/CommunityHubScreen')};
import { YouScreen } from ${T('features/you/YouScreen')};
import { SavedVersesScreen } from ${T('features/you/SavedVersesScreen')};
import { AnnouncementDetailScreen } from ${T('features/announcements/AnnouncementDetailScreen')};
import { CommunityPostDetailScreen } from ${T('features/community/CommunityPostDetailScreen')};
import { SongsListScreen } from ${T('features/songs/SongsListScreen')};
import { SongDetailScreen } from ${T('features/songs/SongDetailScreen')};
import { EventsListScreen } from ${T('features/events/EventsListScreen')};
import { EventDetailScreen } from ${T('features/events/EventDetailScreen')};
import { YouTubePlayerScreen } from ${T('features/events/YouTubePlayerScreen')};
import { SettingsScreen } from ${T('features/settings/SettingsScreen')};
import { BibleTranslationsScreen } from ${T('features/settings/BibleTranslationsScreen')};
import { NotificationCenterScreen } from ${T('features/notifications/NotificationCenterScreen')};
import { BibleHomeScreen } from ${T('features/bible/BibleHomeScreen')};
import { ChaptersListScreen } from ${T('features/bible/ChaptersListScreen')};
import { BibleSearchScreen } from ${T('features/bible/BibleSearchScreen')};
import { ReaderScreen } from ${T('features/bible/reader/ReaderScreen')};
import { MediaFeedScreen } from ${T('features/media/MediaFeedScreen')};
import { MediaDetailScreen } from ${T('features/media/MediaDetailScreen')};
import { SavedMediaScreen } from ${T('features/media/SavedMediaScreen')};
import { PlanDetailScreen } from ${T('features/plans/PlanDetailScreen')};
import { PlanDayScreen } from ${T('features/plans/PlanDayScreen')};
import { PlanDoneScreen } from ${T('features/plans/PlanDoneScreen')};
import { SEED_PLANS } from ${T('features/plans/seedPlans')};
import { TabBar } from ${T('navigation/TabBar')};

const Stack = createNativeStackNavigator();
const ref = createNavigationContainerRef();
const TABS = new Set(['Home', 'BibleBooks', 'PrayersHub', 'CommunityHub', 'You']);
const OTHER = ['DailyVerse'];

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
            <Stack.Screen name="BibleBooks" component={BibleHomeScreen} initialParams={initial.name === 'BibleBooks' ? initial.params : undefined} />
            <Stack.Screen name="BibleChapters" component={ChaptersListScreen} initialParams={initial.name === 'BibleChapters' ? initial.params : undefined} />
            <Stack.Screen name="BibleChapter" component={ReaderScreen} initialParams={initial.name === 'BibleChapter' ? initial.params : undefined} />
            <Stack.Screen name="BibleSearch" component={BibleSearchScreen} />
            <Stack.Screen name="MediaFeed" component={MediaFeedScreen} />
            <Stack.Screen name="MediaDetail" component={MediaDetailScreen} initialParams={initial.name === 'MediaDetail' ? initial.params : undefined} />
            <Stack.Screen name="SavedMedia" component={SavedMediaScreen} />
            <Stack.Screen name="PlanDetail" component={PlanDetailScreen} initialParams={initial.name === 'PlanDetail' ? initial.params : undefined} />
            <Stack.Screen name="PlanDay" component={PlanDayScreen} initialParams={initial.name === 'PlanDay' ? initial.params : undefined} />
            <Stack.Screen name="PlanDone" component={PlanDoneScreen} initialParams={initial.name === 'PlanDone' ? initial.params : undefined} />
            <Stack.Screen name="Settings" component={SettingsScreen} initialParams={initial.name === 'Settings' ? initial.params : undefined} />
            <Stack.Screen name="BibleTranslations" component={BibleTranslationsScreen} />
            <Stack.Screen name="NotificationCenter" component={NotificationCenterScreen} />
            <Stack.Screen name="SongsList" component={SongsListScreen} />
            <Stack.Screen name="SongDetail" component={SongDetailScreen} initialParams={initial.name === 'SongDetail' ? initial.params : undefined} />
            <Stack.Screen name="EventsList" component={EventsListScreen} />
            <Stack.Screen name="EventDetail" component={EventDetailScreen} initialParams={initial.name === 'EventDetail' ? initial.params : undefined} />
            <Stack.Screen name="YouTubePlayer" component={YouTubePlayerScreen} initialParams={initial.name === 'YouTubePlayer' ? initial.params : undefined} />
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
    <AuthProvider><PreferencesProvider><ReadingPreferencesProvider><Root /></ReadingPreferencesProvider></PreferencesProvider></AuthProvider>
  );
};
g.__plan = (id: string) => { const p = SEED_PLANS.find((x) => x.id === id)!; return { id: p.id, title: p.title, description: p.description, category: p.category, coverImageUrl: null, dayCount: p.days.length }; };
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
  docs['settings/church'] = { churchName: d.churchName, ...(d.supportEmail ? { supportEmail: d.supportEmail } : {}) };
  docs['users/qa-member'] = { role: 'member', displayName: d.name, email: 'joshua@example.com', ...(d.profile ?? {}) };
  (d.announcements ?? []).forEach((a, i) => {
    docs['announcements/a' + i] = { published: true, imageUrl: null, ...a, createdAt: ts(now - (a.ageH ?? (i + 1) * 20) * hour) };
    delete docs['announcements/a' + i].ageH;
  });
  (d.posts ?? []).forEach((p, i) => {
    docs['community/p' + i] = { published: true, imageUrl: null, ...p, createdAt: ts(now - (p.ageH ?? (i + 1) * 30) * hour) };
    delete docs['community/p' + i].ageH;
  });
  // The reader finds a verse's marks by DOCUMENT ID -- `en_john_3_16`, the same one the app writes -- so the
  // seeds are written under it.
  const verseKey = (r) => `${r.translationId}_${r.bookId}_${r.chapter}_${r.verse}`;
  (d.notes ?? []).forEach((n) => {
    docs['users/qa-member/verseNotes/' + verseKey(n.ref)] = { ...n.ref, text: n.text, createdAt: ts(now - n.days * day), updatedAt: ts(now - n.days * day) };
  });
  (d.highlights ?? []).forEach((h) => {
    docs['users/qa-member/highlights/' + verseKey(h.ref)] = { ...h.ref, colour: h.colour, createdAt: ts(now - h.days * day) };
  });
  (d.bookmarks ?? []).forEach((b) => {
    docs['users/qa-member/bookmarks/' + verseKey(b.ref)] = { ...b.ref, createdAt: ts(now - b.days * day) };
  });
  if (d.plan) {
    docs['plans/p1'] = { title: d.plan.title, description: '', category: 'Devotional', dayCount: 7, published: true, order: 0 };
    docs['users/qa-member/planProgress/p1'] = { startedAt: ts(now - 2 * day), currentDay: 2, completedDays: [1], lastReadAt: ts(now - hour) };
  }
  for (let i = 0; i < (d.journalEntries ? 0 : (d.journal ?? 0)); i++) {
    docs['users/qa-member/prayers/j' + i] = { text: 'A prayer ' + i, answered: i % 3 === 0, createdAt: ts(now - (i + 1) * day), answeredAt: null };
  }
  (d.journalEntries ?? []).forEach((j, i) => {
    docs['users/qa-member/prayers/e' + i] = { text: j.text, answered: !!j.answered, createdAt: ts(now - j.days * day), answeredAt: null };
  });
  // The church's prayer wall: an anonymous request carries NO author at all; an own one is also in the member's index.
  (d.requests ?? []).forEach((r, i) => {
    const created = ts(now - r.days * day);
    docs['prayer_requests/r' + i] = {
      title: r.title ?? '',
      body: r.body ?? '',
      category: r.category ?? null,
      anonymous: !!r.anonymous,
      status: r.status ?? 'open',
      removed: !!r.removed,
      createdAt: created,
      updatedAt: null,
      ...(r.anonymous ? {} : { authorUid: r.own ? 'qa-member' : 'other-' + i, authorName: r.authorName }),
    };
    if (r.own) docs['users/qa-member/prayerRequests/r' + i] = { createdAt: created, anonymous: !!r.anonymous };
  });
  Object.entries(d.planProgress ?? {}).forEach(([id, p]) => {
    docs['users/qa-member/planProgress/' + id] = { startedAt: ts(now - 3 * day), currentDay: p.currentDay, completedDays: p.completedDays, lastReadAt: ts(now - (p.hoursAgo ?? 2) * hour) };
  });
  if (d.reading) {
    docs['users/qa-member/readingPosition/' + d.reading.translationId] = { bookId: d.reading.bookId, chapter: d.reading.chapter, verse: d.reading.verse ?? 1, updatedAt: ts(now - hour) };
  }
  (d.songs ?? []).forEach((song, i) => {
    docs['songs/s' + i] = { published: true, category: 'Hymn', lyrics: '', audioUrl: 'https://example.org/qa.mp3', coverUrl: null, ...song };
  });
  (d.events ?? []).forEach((e, i) => {
    const { inH, ...rest } = e;
    docs['events/e' + i] = { published: true, description: '', isLive: false, youtubeUrl: '', ...rest, startsAt: ts(now + inH * hour) };
  });
  (d.chat ?? []).forEach((m, i) => {
    const { minAgo, ...rest } = m;
    docs['community_messages/m' + String(i).padStart(2, '0')] = { removed: false, ...rest, createdAt: minAgo === null ? null : ts(now - minAgo * 60_000) };
  });
  for (let i = 0; i < (d.savedMedia ?? 0); i++) {
    docs['users/qa-member/mediaSaves/s' + i] = { createdAt: ts(now - i * day) };
  }
  // The church's photographs and videos, a member's likes, the small copies a save carries, and the comments.
  (d.media ?? []).forEach((m, i) => {
    const { ageH, ...rest } = m;
    docs['media/' + m.id] = { published: true, authorName: '', ...rest, publishAt: ts(now - (ageH ?? (i + 1) * 30) * hour) };
  });
  (d.likedMedia ?? []).forEach((id) => {
    docs['users/qa-member/mediaLikes/' + id] = { createdAt: ts(now - hour) };
  });
  (d.savedPosts ?? []).forEach((m, i) => {
    docs['users/qa-member/mediaSaves/' + m.id] = { type: m.type, mediaUrl: m.mediaUrl, caption: m.caption, createdAt: ts(now - (i + 1) * day) };
  });
  Object.entries(d.mediaComments ?? {}).forEach(([mediaId, list]) => {
    list.forEach((c, i) => {
      docs['media/' + mediaId + '/comments/c' + String(i).padStart(2, '0')] = { text: c.text, authorUid: c.own ? 'qa-member' : 'other-' + i, authorName: c.authorName, createdAt: ts(now - (c.minAgo ?? (list.length - i) * 40) * 60_000) };
    });
  });
  window.__fs.seed(docs);
  window.__auth.signIn({
    uid: 'qa-member',
    displayName: d.name,
    email: 'joshua@example.com',
    emailVerified: !d.unverified,
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
  // The still YouTube keeps for a video (a video post's poster) -- answered with a picture, no network.
  await page.route('https://i.ytimg.com/**', (route) =>
    route.fulfill({ contentType: 'image/svg+xml', body: svg(...PICTURES.b) })
  );
}

const EN_PRAYERS = {
  requests: [
    { title: 'Healing for my mother', body: 'Please pray for the results of her tests this week.', category: 'healing', anonymous: true, days: 2 },
    { removed: true, title: 'removed', body: 'removed', days: 3 },
    { title: 'Wisdom for our move', body: 'We move to a new city next month. Please pray for peace for the children and for steady work.', category: 'family', own: true, authorName: 'Joshua', days: 3 },
    { title: 'Thanks for a new job', body: 'I start on Monday. Thank you for praying with me through the long wait.', category: 'thanksgiving', status: 'answered', authorName: 'Priya', days: 5 },
    { title: 'Guidance for exams', body: 'Our youth begin exams next week.', category: 'guidance', authorName: 'Daniel', days: 6 },
  ],
  journalEntries: [
    { text: 'Lord, give me patience with my brother, and help me to listen before I answer.', days: 2 },
    { text: 'Thank you for a safe journey home.', days: 5, answered: true },
    { text: 'Guide the conversation with my manager on Monday.', days: 8 },
  ],
};

const TE_PRAYERS = {
  requests: [
    { title: 'మా అమ్మ స్వస్థత కోసం', body: 'ఈ వారం ఆమె పరీక్షల ఫలితాల కోసం ప్రార్థించండి.', category: 'healing', anonymous: true, days: 2 },
    { removed: true, title: 'x', body: 'x', days: 3 },
    { title: 'మా మార్పు కోసం జ్ఞానం', body: 'వచ్చే నెల మేము కొత్త నగరానికి వెళ్తున్నాం. పిల్లల కోసం, స్థిరమైన పని కోసం ప్రార్థించండి.', category: 'family', own: true, authorName: 'జాషువా', days: 3 },
    { title: 'కొత్త ఉద్యోగానికి కృతజ్ఞతలు', body: 'సోమవారం మొదలవుతోంది. నాతో కలిసి ప్రార్థించినందుకు ధన్యవాదాలు.', category: 'thanksgiving', status: 'answered', authorName: 'ప్రియ', days: 5 },
  ],
  journalEntries: [
    { text: 'ప్రభువా, నా సోదరునితో ఓర్పు చూపేలా, సమాధానం ఇచ్చే ముందు వినేలా నాకు సహాయం చేయి.', days: 2 },
    { text: 'సురక్షితమైన ప్రయాణానికి కృతజ్ఞతలు.', days: 5, answered: true },
  ],
};

const EN_DATA = {
  name: 'Joshua',
  churchName: 'Maranatha',
  supportEmail: 'support@example.org',
  profile: { gender: 'male', age: 34 },
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
  songs: [
    { title: 'Amazing Grace', artist: 'Hymn', coverUrl: 'https://example.org/qa-a.svg', lyrics: 'Amazing grace! How sweet the sound,\nThat saved a wretch like me!\nI once was lost, but now am found;\nWas blind, but now I see.\n\n’Twas grace that taught my heart to fear,\nAnd grace my fears relieved;\nHow precious did that grace appear\nThe hour I first believed.' },
    { title: 'Be Still', artist: 'Church choir', lyrics: 'Be still, and know that I am God.' },
    { title: 'How Great Thou Art', artist: 'Hymn', coverUrl: 'https://example.org/qa-b.svg', lyrics: 'O Lord my God, when I in awesome wonder...' },
  ],
  events: [
    { title: 'Sunday Worship', location: 'Main hall', isLive: true, youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', inH: 1, description: 'A time of worship and the word. Bring a friend.' },
    { title: 'Wednesday Prayer Meeting', location: 'Main hall', inH: 81, description: 'A time of prayer for the week ahead. Bring a friend, and bring the names of people you would like to pray for. Tea is served afterwards in the courtyard.' },
    { title: 'Youth Fellowship', location: 'Room 2', inH: 128.5 },
    { title: 'Harvest Thanksgiving', location: 'Main hall', inH: 337 },
  ],
  chat: [
    { authorUid: 'u-asha', authorName: 'Asha', minAgo: 16, text: 'Good morning, church family. Who is bringing tea on Sunday?' },
    { authorUid: 'u-asha', authorName: 'Asha', minAgo: 15, text: 'I can bring biscuits too.' },
    { authorUid: 'qa-member', authorName: 'Joshua', minAgo: 10, text: 'I can bring the tea. See you all there.' },
    { authorUid: 'u-daniel', authorName: 'Daniel', minAgo: 6, text: 'Praise the Lord! The youth meeting moved to 6 PM on Friday.' },
    { authorUid: 'u-priya', authorName: 'Priya', minAgo: 4, text: 'removed', removed: true },
    { authorUid: 'qa-member', authorName: 'Joshua', minAgo: null, text: 'Thank you, Daniel.' },
  ],
  journal: 6,
  savedMedia: 4,
  ...EN_PRAYERS,
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
  songs: [
    { title: 'ఆశ్చర్యకరమైన కృప', artist: 'కీర్తన', coverUrl: 'https://example.org/qa-a.svg', lyrics: 'ఆశ్చర్యకరమైన కృప! ఎంత మధురమైన నాదం,\nనాలాంటి పాపిని రక్షించింది!\nనేను తప్పిపోయాను, ఇప్పుడు దొరికాను;\nగుడ్డివాడను, ఇప్పుడు చూస్తున్నాను.\n\nకృపే నా హృదయానికి భయం నేర్పింది,\nకృపే నా భయాలను తొలగించింది.' },
    { title: 'నిశ్శబ్దంగా ఉండు', artist: 'సంఘ గాయక బృందం', lyrics: 'ఊరకుండుడి, నేనే దేవుడనని తెలిసికొనుడి.' },
    { title: 'నీవే మహా గొప్పవాడవు', artist: 'కీర్తన', lyrics: 'ప్రభువా నా దేవా...' },
  ],
  events: [
    { title: 'ఆదివారం ఆరాధన', location: 'ప్రధాన మందిరం', isLive: true, youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', inH: 1, description: 'ఆరాధన, వాక్యం. ఒక స్నేహితుడిని తీసుకురండి.' },
    { title: 'బుధవారం ప్రార్థన కూడిక', location: 'ప్రధాన మందిరం', inH: 81, description: 'రాబోయే వారం కోసం ప్రార్థన సమయం. స్నేహితులను తీసుకురండి, ప్రార్థన కోరుకునే వారి పేర్లు తీసుకురండి. తర్వాత ప్రాంగణంలో టీ ఉంటుంది.' },
    { title: 'యువజన సహవాసం', location: 'గది 2', inH: 128.5 },
    { title: 'కృతజ్ఞతా పండుగ', location: 'ప్రధాన మందిరం', inH: 337 },
  ],
  chat: [
    { authorUid: 'u-asha', authorName: 'ఆశా', minAgo: 16, text: 'శుభోదయం, సంఘ కుటుంబమా. ఆదివారం టీ ఎవరు తెస్తున్నారు?' },
    { authorUid: 'u-asha', authorName: 'ఆశా', minAgo: 15, text: 'నేను బిస్కెట్లు కూడా తెస్తాను.' },
    { authorUid: 'qa-member', authorName: 'జాషువా', minAgo: 10, text: 'టీ నేను తెస్తాను. అక్కడ కలుద్దాం.' },
    { authorUid: 'u-daniel', authorName: 'డేనియల్', minAgo: 6, text: 'ప్రభువును స్తుతించండి! శుక్రవారం యువజన సమావేశం సాయంత్రం 6 గంటలకు మారింది.' },
    { authorUid: 'u-priya', authorName: 'ప్రియ', minAgo: 4, text: 'x', removed: true },
    { authorUid: 'qa-member', authorName: 'జాషువా', minAgo: null, text: 'ధన్యవాదాలు, డేనియల్.' },
  ],
  ...TE_PRAYERS,
};

const EN = { app_language_preference: 'en', bible_mode_preference: 'en' };
const TE = { app_language_preference: 'te', bible_mode_preference: 'te' };

const route = (name, params) => ({ name, params });

/** The first of the plans that ship with the app, as the route param the screens receive. */
const PSALMS = {
  id: 'seven-days-in-the-psalms',
  title: 'Seven Days in the Psalms',
  description: 'One psalm a day for a week, chosen to move from trust through lament to praise.',
  category: 'Devotional',
  coverImageUrl: null,
  dayCount: 7,
};
const PSALMS_PROGRESS = { 'seven-days-in-the-psalms': { currentDay: 2, completedDays: [1] } };

// The church's photographs and videos: a picture with the verse it quotes, a YouTube video, and a plain picture.
const EN_MEDIA = [
  { id: 'm0', type: 'image', mediaUrl: 'https://example.org/qa-a.svg', caption: 'Sunday worship, 4 October', verseReference: 'Psalm 23:1', verseText: 'Yahweh is my shepherd: I shall lack nothing.', authorName: 'Church office', ageH: 150 },
  { id: 'm1', type: 'video', mediaUrl: 'https://www.youtube.com/watch?v=abcdefghijk', caption: 'Sermon: peace that stays', authorName: 'Church office', ageH: 190 },
  { id: 'm2', type: 'image', mediaUrl: 'https://example.org/qa-b.svg', caption: 'Children’s harvest craft', authorName: 'Sunday school', ageH: 260 },
];
const TE_MEDIA = [
  { id: 'm0', type: 'image', mediaUrl: 'https://example.org/qa-a.svg', caption: 'ఆదివారం ఆరాధన, 4 అక్టోబర్', verseReference: 'కీర్తనలు 23:1', verseText: 'యెహోవా నా కాపరి; నాకు లేమి కలుగదు.', authorName: 'సంఘ కార్యాలయం', ageH: 150 },
  { id: 'm1', type: 'video', mediaUrl: 'https://www.youtube.com/watch?v=abcdefghijk', caption: 'ప్రసంగం: నిలిచే సమాధానం', authorName: 'సంఘ కార్యాలయం', ageH: 190 },
  { id: 'm2', type: 'image', mediaUrl: 'https://example.org/qa-b.svg', caption: 'పిల్లల పంట కళాకృతులు', authorName: 'సండే స్కూల్', ageH: 260 },
];
const EN_COMMENTS = { m0: [
  { authorName: 'Asha', text: 'A lovely service. Thank you for sharing.' },
  { authorName: 'Joshua', text: 'Praise God for this.', own: true },
] };
const TE_COMMENTS = { m0: [
  { authorName: 'ఆశ', text: 'చక్కని ఆరాధన. పంచుకున్నందుకు ధన్యవాదాలు.' },
  { authorName: 'జాషువా', text: 'దీనికి దేవునికి స్తోత్రం.', own: true },
] };
const media = (list, comments) => ({ name: 'Joshua', churchName: 'Maranatha', media: list, likedMedia: ['m0'], savedPosts: [list[2]], mediaComments: comments });
const EN_MEDIA_DATA = media(EN_MEDIA, EN_COMMENTS);
const TE_MEDIA_DATA = { ...media(TE_MEDIA, TE_COMMENTS), name: 'జాషువా' };
const VIDEO_LINK_POST = { id: 'm9', type: 'video', mediaUrl: 'https://example.org/clip.mp4', caption: 'Sermon: peace that stays', authorName: 'Church office', publishAt: { __date: Date.UTC(2026, 9, 7) } };
const PHOTO_POST = (list) => ({ ...list[0], publishAt: { __date: Date.UTC(2026, 9, 5) } });

// The reader: John 3 in English, with the three marks a page can carry -- a highlight, a bookmark, a note.
const READER_EN = { ...EN, bible_mode_preference: 'en' };
const READER_DATA = {
  name: 'Joshua',
  churchName: 'Maranatha',
  highlights: [{ ref: { translationId: 'en', bookId: 'john', chapter: 3, verse: 3 }, colour: 'yellow', days: 1 }],
  bookmarks: [{ ref: { translationId: 'en', bookId: 'john', chapter: 3, verse: 5 }, days: 1 }],
  notes: [{ ref: { translationId: 'en', bookId: 'john', chapter: 3, verse: 7 }, text: 'Born from above: a new beginning.', days: 1 }],
};

/** The phone's own notification history: AsyncStorage's `notification_history`, newest first by arrival. */
const history = (rows) =>
  JSON.stringify(
    rows.map(([title, message, receivedAt, extra], i) => ({ id: 'n' + (i + 1), title, message, receivedAt, ...extra }))
  );
const EN_HISTORY = history([
  ['Live now: Sunday Worship', 'Join the service from the app.', new Date(NOW - 29 * 60_000).toISOString(), { data: { screen: 'EventsList' } }],
  ['Today’s reading: Psalm 23', 'Day 2 of Seven Days in the Psalms.', new Date(NOW - 3.5 * 3_600_000).toISOString(), { data: { screen: 'PlansList' } }],
  ['Wednesday prayer meeting moved', 'Tonight’s meeting starts at 7:00 PM.', new Date(NOW - 17.25 * 3_600_000).toISOString(), { readAt: '2026-10-10T12:00:00Z' }],
  ['Harvest Thanksgiving', 'Bring a gift for the families on 25 October.', '2026-10-06T03:30:00Z', { readAt: '2026-10-06T05:00:00Z', data: { screen: 'EventsList' } }],
]);
const TE_HISTORY = history([
  ['ప్రత్యక్ష ప్రసారం: ఆదివారం ఆరాధన', 'యాప్ నుండి ఆరాధనలో చేరండి.', new Date(NOW - 29 * 60_000).toISOString(), { data: { screen: 'EventsList' } }],
  ['నేటి పఠనం: కీర్తనలు 23', '‘కీర్తనలలో ఏడు రోజులు’లో 2వ రోజు.', new Date(NOW - 3.5 * 3_600_000).toISOString(), { data: { screen: 'PlansList' } }],
  ['బుధవారం ప్రార్థన కూడిక మార్పు', 'ఈ రాత్రి కూడిక సాయంత్రం 7:00కు మొదలవుతుంది.', new Date(NOW - 17.25 * 3_600_000).toISOString(), { readAt: '2026-10-10T12:00:00Z' }],
]);

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
  // --- Prayers: the church's requests, "Yours", and the journal
  { name: 'prayers-light', storage: EN, data: EN_DATA, route: route('PrayersHub') },
  { name: 'prayers-dark', storage: { ...EN, theme_preference: 'dark' }, dark: true, data: EN_DATA, route: route('PrayersHub') },
  { name: 'prayers-te', storage: TE, data: TE_DATA, route: route('PrayersHub') },
  {
    name: 'prayers-yours',
    storage: EN,
    data: EN_DATA,
    route: route('PrayersHub'),
    steps: async (qa) => {
      await qa.tap('prayer-wall-filter-yours');
      await qa.advance(400);
    },
  },
  {
    name: 'prayers-empty',
    storage: EN,
    data: { name: 'Joshua', churchName: 'Maranatha' },
    route: route('PrayersHub'),
  },
  {
    name: 'prayers-noown',
    storage: EN,
    data: { name: 'Joshua', churchName: 'Maranatha', requests: EN_PRAYERS.requests.filter((r) => !r.own) },
    route: route('PrayersHub'),
    steps: async (qa) => {
      await qa.tap('prayer-wall-filter-yours');
      await qa.advance(400);
    },
  },
  {
    name: 'prayers-ask',
    reduced: true,
    storage: EN,
    data: EN_DATA,
    route: route('PrayersHub'),
    steps: async (qa) => {
      await qa.tap('prayer-wall-compose');
      await qa.advance(600);
    },
  },
  {
    name: 'prayers-ask-te-dark',
    reduced: true,
    storage: { ...TE, theme_preference: 'dark' },
    dark: true,
    data: TE_DATA,
    route: route('PrayersHub'),
    steps: async (qa) => {
      await qa.tap('prayer-wall-compose');
      await qa.advance(600);
    },
  },
  {
    name: 'prayers-edit',
    reduced: true,
    storage: EN,
    data: EN_DATA,
    route: route('PrayersHub'),
    steps: async (qa) => {
      await qa.tap('prayer-request-edit-r2');
      await qa.advance(600);
    },
  },
  {
    name: 'prayers-report',
    reduced: true,
    storage: EN,
    data: EN_DATA,
    route: route('PrayersHub'),
    steps: async (qa) => {
      await qa.tap('prayer-request-report-r0');
      await qa.advance(600);
      await qa.tap('prayer-wall-report-reason-harassment');
      await qa.advance(200);
    },
  },
  {
    name: 'prayers-delete',
    reduced: true,
    storage: EN,
    data: EN_DATA,
    route: route('PrayersHub'),
    steps: async (qa) => {
      await qa.tap('prayer-request-delete-r2');
      await qa.advance(400);
    },
  },
  { name: 'journal-light', storage: EN, data: EN_DATA, route: route('PrayersHub', { tab: 'journal' }) },
  { name: 'journal-dark', storage: { ...EN, theme_preference: 'dark' }, dark: true, data: EN_DATA, route: route('PrayersHub', { tab: 'journal' }) },
  { name: 'journal-te', storage: TE, data: TE_DATA, route: route('PrayersHub', { tab: 'journal' }) },
  {
    name: 'journal-empty',
    storage: EN,
    data: { name: 'Joshua', churchName: 'Maranatha' },
    route: route('PrayersHub', { tab: 'journal' }),
  },
  {
    name: 'journal-entry',
    reduced: true,
    storage: EN,
    data: EN_DATA,
    route: route('PrayersHub', { tab: 'journal' }),
    steps: async (qa) => {
      await qa.tap('prayers-new-entry');
      await qa.advance(600);
      await qa.type('prayer-input', 'Lord, give me patience with my brother, and help me to listen before I answer.');
      await qa.advance(200);
    },
  },
  {
    name: 'journal-entry-empty',
    reduced: true,
    storage: EN,
    data: EN_DATA,
    route: route('PrayersHub', { tab: 'journal' }),
    steps: async (qa) => {
      await qa.tap('prayers-new-entry');
      await qa.advance(600);
    },
  },
  {
    name: 'journal-added',
    reduced: true,
    storage: EN,
    data: EN_DATA,
    route: route('PrayersHub', { tab: 'journal' }),
    steps: async (qa) => {
      await qa.tap('prayers-new-entry');
      await qa.advance(600);
      await qa.type('prayer-input', 'Thank you for this day.');
      await qa.tap('prayer-submit');
      await qa.advance(800);
    },
  },
  {
    name: 'journal-delete',
    reduced: true,
    storage: EN,
    data: EN_DATA,
    route: route('PrayersHub', { tab: 'journal' }),
    steps: async (qa) => {
      await qa.tap('prayer-delete-e0');
      await qa.advance(400);
    },
  },
  // --- Songs
  { name: 'songs-light', storage: { ...EN, song_favorites: '["s0","s2"]' }, data: EN_DATA, route: route('SongsList') },
  { name: 'songs-dark', storage: { ...EN, song_favorites: '["s0","s2"]', theme_preference: 'dark' }, dark: true, data: EN_DATA, route: route('SongsList') },
  { name: 'songs-te', storage: { ...TE, song_favorites: '["s0","s2"]' }, data: TE_DATA, route: route('SongsList') },
  {
    name: 'songs-favourites',
    storage: { ...EN, song_favorites: '["s0","s2"]' },
    data: EN_DATA,
    route: route('SongsList'),
    steps: async (qa) => {
      await qa.tap('songs-filter-favourites');
      await qa.advance(300);
    },
  },
  {
    name: 'songs-no-favourites',
    storage: EN,
    data: EN_DATA,
    route: route('SongsList'),
    steps: async (qa) => {
      await qa.tap('songs-filter-favourites');
      await qa.advance(300);
    },
  },
  { name: 'songs-empty', storage: EN, data: { name: 'Joshua', churchName: 'Maranatha' }, route: route('SongsList') },
  { name: 'song-detail-light', storage: { ...EN, song_favorites: '["s0"]' }, data: EN_DATA, route: route('SongDetail', { song: { id: 's0', ...EN_DATA.songs[0], category: 'Hymn', audioUrl: 'https://example.org/qa.mp3' } }) },
  { name: 'song-detail-dark', storage: { ...EN, theme_preference: 'dark' }, dark: true, data: EN_DATA, route: route('SongDetail', { song: { id: 's1', ...EN_DATA.songs[1], coverUrl: null, category: 'Hymn', audioUrl: 'https://example.org/qa.mp3' } }) },
  { name: 'song-detail-te', storage: { ...TE, song_favorites: '["s0"]' }, data: TE_DATA, route: route('SongDetail', { song: { id: 's0', ...TE_DATA.songs[0], category: 'Hymn', audioUrl: 'https://example.org/qa.mp3' } }) },
  // --- Events
  { name: 'events-light', storage: EN, data: EN_DATA, route: route('EventsList') },
  { name: 'events-dark', storage: { ...EN, theme_preference: 'dark' }, dark: true, data: EN_DATA, route: route('EventsList') },
  { name: 'events-te', storage: TE, data: TE_DATA, route: route('EventsList') },
  { name: 'events-empty', storage: EN, data: { name: 'Joshua', churchName: 'Maranatha' }, route: route('EventsList') },
  {
    name: 'event-live-light',
    storage: EN,
    data: EN_DATA,
    route: route('EventDetail', { event: { id: 'e0', title: 'Sunday Worship', location: 'Main hall', description: EN_DATA.events[1].description, isLive: true, youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', startsAt: { __date: NOW + 3_600_000 } } }),
  },
  {
    name: 'event-live-dark',
    storage: { ...EN, theme_preference: 'dark' },
    dark: true,
    data: EN_DATA,
    route: route('EventDetail', { event: { id: 'e0', title: 'Sunday Worship', location: 'Main hall', description: EN_DATA.events[1].description, isLive: true, youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', startsAt: { __date: NOW + 3_600_000 } } }),
  },
  {
    name: 'event-plain-light',
    storage: EN,
    data: EN_DATA,
    route: route('EventDetail', { event: { id: 'e1', title: 'Wednesday Prayer Meeting', location: 'Main hall', description: EN_DATA.events[1].description, isLive: false, youtubeUrl: '', startsAt: { __date: NOW + 81 * 3_600_000 } } }),
  },
  {
    name: 'event-live-te',
    storage: TE,
    data: TE_DATA,
    route: route('EventDetail', { event: { id: 'e0', title: 'ఆదివారం ఆరాధన', location: 'ప్రధాన మందిరం', description: TE_DATA.events[1].description, isLive: true, youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', startsAt: { __date: NOW + 3_600_000 } } }),
  },
  {
    name: 'player-unsupported',
    storage: EN,
    data: EN_DATA,
    route: route('YouTubePlayer', { youtubeUrl: 'https://example.com/not-youtube', title: 'Sunday Worship' }),
  },
  // --- Chat
  { name: 'chat-light', storage: EN, data: EN_DATA, route: route('CommunityHub', { tab: 'chat' }) },
  { name: 'chat-dark', storage: { ...EN, theme_preference: 'dark' }, dark: true, data: EN_DATA, route: route('CommunityHub', { tab: 'chat' }) },
  { name: 'chat-te', storage: TE, data: TE_DATA, route: route('CommunityHub', { tab: 'chat' }) },
  { name: 'chat-empty', storage: EN, data: { name: 'Joshua', churchName: 'Maranatha' }, route: route('CommunityHub', { tab: 'chat' }) },
  {
    name: 'chat-draft',
    storage: EN,
    data: EN_DATA,
    route: route('CommunityHub', { tab: 'chat' }),
    steps: async (qa) => {
      await qa.type('chat-input', 'Amen. I will bring chairs as well.');
      await qa.advance(200);
    },
  },
  {
    name: 'chat-delete',
    reduced: true,
    storage: EN,
    data: EN_DATA,
    route: route('CommunityHub', { tab: 'chat' }),
    steps: async (qa) => {
      await qa.tap('chat-delete-m02');
      await qa.advance(400);
    },
  },
  // --- You > Profile
  { name: 'profile-light', storage: EN, data: EN_DATA, route: route('You', { tab: 'profile' }) },
  { name: 'profile-dark', storage: { ...EN, theme_preference: 'dark' }, dark: true, data: EN_DATA, route: route('You', { tab: 'profile' }) },
  { name: 'profile-te', storage: TE, data: { ...TE_DATA, profile: { gender: 'male', age: 34 } }, route: route('You', { tab: 'profile' }) },
  { name: 'profile-sparse', storage: EN, data: { name: 'Joshua', churchName: 'Maranatha' }, route: route('You', { tab: 'profile' }) },
  { name: 'profile-unverified', storage: EN, data: { ...EN_DATA, unverified: true }, route: route('You', { tab: 'profile' }) },
  {
    name: 'profile-edit-name',
    storage: EN,
    data: EN_DATA,
    route: route('You', { tab: 'profile' }),
    steps: async (qa) => {
      await qa.tap('profile-edit-name');
      await qa.advance(300);
    },
  },
  {
    name: 'profile-edit-name-error',
    storage: EN,
    data: EN_DATA,
    route: route('You', { tab: 'profile' }),
    steps: async (qa) => {
      await qa.tap('profile-edit-name');
      await qa.type('profile-name-input', ' ');
      await qa.tap('profile-save');
      await qa.advance(300);
    },
  },
  {
    name: 'profile-edit-gender',
    storage: EN,
    data: EN_DATA,
    route: route('You', { tab: 'profile' }),
    steps: async (qa) => {
      await qa.tap('profile-edit-gender');
      await qa.advance(300);
    },
  },
  {
    name: 'profile-edit-age-error',
    storage: EN,
    data: EN_DATA,
    route: route('You', { tab: 'profile' }),
    steps: async (qa) => {
      await qa.tap('profile-edit-age');
      await qa.type('profile-age-input', '0');
      await qa.tap('profile-save');
      await qa.advance(300);
    },
  },
  {
    name: 'profile-saved',
    storage: EN,
    data: EN_DATA,
    route: route('You', { tab: 'profile' }),
    steps: async (qa) => {
      await qa.tap('profile-edit-age');
      await qa.type('profile-age-input', '35');
      await qa.tap('profile-save');
      await qa.advance(500);
    },
  },
  // --- Settings
  { name: 'settings-light', storage: EN, data: EN_DATA, route: route('Settings') },
  { name: 'settings-dark', storage: { ...EN, theme_preference: 'dark' }, dark: true, data: EN_DATA, route: route('Settings') },
  { name: 'settings-te', storage: TE, data: TE_DATA, route: route('Settings') },
  { name: 'settings-noemail', storage: EN, data: { ...EN_DATA, supportEmail: '' }, route: route('Settings') },
  {
    name: 'settings-sheet-app',
    reduced: true,
    storage: EN,
    data: EN_DATA,
    route: route('Settings'),
    steps: async (qa) => {
      await qa.tap('settings-app-language');
      await qa.advance(500);
    },
  },
  {
    name: 'settings-sheet-bible',
    reduced: true,
    storage: EN,
    data: EN_DATA,
    route: route('Settings'),
    steps: async (qa) => {
      await qa.tap('settings-bible-language');
      await qa.advance(500);
    },
  },
  {
    name: 'settings-logout',
    reduced: true,
    storage: EN,
    data: EN_DATA,
    route: route('Settings'),
    steps: async (qa) => {
      await qa.tap('settings-logout-button');
      await qa.advance(500);
    },
  },
  { name: 'credits-light', storage: EN, data: EN_DATA, route: route('BibleTranslations') },
  { name: 'credits-te', storage: TE, data: TE_DATA, route: route('BibleTranslations') },
  // --- Notifications
  { name: 'notifications-light', storage: { ...EN, notification_history: EN_HISTORY }, data: EN_DATA, route: route('NotificationCenter') },
  { name: 'notifications-dark', storage: { ...EN, notification_history: EN_HISTORY, theme_preference: 'dark' }, dark: true, data: EN_DATA, route: route('NotificationCenter') },
  { name: 'notifications-te', storage: { ...TE, notification_history: TE_HISTORY }, data: TE_DATA, route: route('NotificationCenter') },
  { name: 'notifications-empty', storage: EN, data: EN_DATA, route: route('NotificationCenter') },
  // --- Bible home, plans, chapters, search
  { name: 'bible-light', storage: { ...EN, bible_mode_preference: 'en' }, data: { ...EN_DATA, reading: { translationId: 'en', bookId: 'john', chapter: 3, verse: 16 } }, route: route('BibleBooks') },
  { name: 'bible-dark', storage: { ...EN, bible_mode_preference: 'en', theme_preference: 'dark' }, dark: true, data: { ...EN_DATA, reading: { translationId: 'en', bookId: 'john', chapter: 3, verse: 16 } }, route: route('BibleBooks') },
  { name: 'bible-te', storage: TE, data: { ...TE_DATA, reading: { translationId: 'te', bookId: 'john', chapter: 3, verse: 16 } }, route: route('BibleBooks') },
  { name: 'bible-fresh', storage: { ...EN, bible_mode_preference: 'en' }, data: EN_DATA, route: route('BibleBooks') },
  {
    name: 'bible-language-sheet',
    reduced: true,
    storage: { ...EN, bible_mode_preference: 'en' },
    data: EN_DATA,
    route: route('BibleBooks'),
    steps: async (qa) => {
      await qa.tap('bible-language-pill');
      await qa.advance(500);
    },
  },
  { name: 'plans-my-light', storage: EN, data: { ...EN_DATA, planProgress: PSALMS_PROGRESS }, route: route('BibleBooks', { tab: 'plans' }) },
  { name: 'plans-my-dark', storage: { ...EN, theme_preference: 'dark' }, dark: true, data: { ...EN_DATA, planProgress: PSALMS_PROGRESS }, route: route('BibleBooks', { tab: 'plans' }) },
  { name: 'plans-my-te', storage: TE, data: { ...TE_DATA, planProgress: PSALMS_PROGRESS }, route: route('BibleBooks', { tab: 'plans' }) },
  { name: 'plans-fresh', storage: EN, data: EN_DATA, route: route('BibleBooks', { tab: 'plans' }) },
  {
    name: 'plans-find',
    storage: EN,
    data: { ...EN_DATA, planProgress: PSALMS_PROGRESS },
    route: route('BibleBooks', { tab: 'plans' }),
    steps: async (qa) => {
      await qa.tap('plans-chip-find');
      await qa.advance(300);
    },
  },
  {
    name: 'plans-completed',
    storage: EN,
    data: { ...EN_DATA, planProgress: { 'peace-in-anxiety': { currentDay: 8, completedDays: [1, 2, 3, 4, 5, 6, 7] } } },
    route: route('BibleBooks', { tab: 'plans' }),
    steps: async (qa) => {
      await qa.tap('plans-chip-completed');
      await qa.advance(300);
    },
  },
  { name: 'plan-new-light', storage: EN, data: EN_DATA, route: route('PlanDetail', { plan: PSALMS }) },
  { name: 'plan-new-te', storage: TE, data: TE_DATA, route: route('PlanDetail', { plan: PSALMS }) },
  { name: 'plan-active-light', storage: EN, data: { ...EN_DATA, planProgress: PSALMS_PROGRESS }, route: route('PlanDetail', { plan: PSALMS }) },
  { name: 'plan-active-dark', storage: { ...EN, theme_preference: 'dark' }, dark: true, data: { ...EN_DATA, planProgress: PSALMS_PROGRESS }, route: route('PlanDetail', { plan: PSALMS }) },
  { name: 'plan-active-te', storage: TE, data: { ...TE_DATA, planProgress: PSALMS_PROGRESS }, route: route('PlanDetail', { plan: PSALMS }) },
  { name: 'plan-day-light', storage: EN, data: { ...EN_DATA, planProgress: PSALMS_PROGRESS }, route: route('PlanDay', { plan: PSALMS, dayNumber: 2 }) },
  { name: 'plan-day-done', storage: EN, data: { ...EN_DATA, planProgress: { 'seven-days-in-the-psalms': { currentDay: 3, completedDays: [1, 2] } } }, route: route('PlanDay', { plan: PSALMS, dayNumber: 2 }) },
  { name: 'plan-day-dark', storage: { ...EN, theme_preference: 'dark' }, dark: true, data: { ...EN_DATA, planProgress: PSALMS_PROGRESS }, route: route('PlanDay', { plan: PSALMS, dayNumber: 2 }) },
  { name: 'plan-day-te', storage: TE, data: { ...TE_DATA, planProgress: PSALMS_PROGRESS }, route: route('PlanDay', { plan: PSALMS, dayNumber: 2 }) },
  { name: 'plan-done-light', storage: EN, data: EN_DATA, route: route('PlanDone', { plan: PSALMS }) },
  { name: 'plan-done-dark', storage: { ...EN, theme_preference: 'dark' }, dark: true, data: EN_DATA, route: route('PlanDone', { plan: PSALMS }) },
  { name: 'chapters-light', storage: { ...EN, bible_mode_preference: 'en' }, data: EN_DATA, route: route('BibleChapters', { bookId: 'john' }) },
  { name: 'chapters-te', storage: TE, data: TE_DATA, route: route('BibleChapters', { bookId: 'john' }) },
  {
    name: 'search-results',
    storage: { ...EN, bible_mode_preference: 'en' },
    data: EN_DATA,
    route: route('BibleSearch'),
    steps: async (qa) => {
      await qa.type('bible-search-input', 'peace');
      await qa.advance(400);
    },
  },
  { name: 'search-prompt', storage: { ...EN, bible_mode_preference: 'en' }, data: EN_DATA, route: route('BibleSearch') },
  // --- Photos and videos: the feed, one post, and the saved list
  { name: 'media-feed-light', storage: EN, data: EN_MEDIA_DATA, route: route('MediaFeed') },
  { name: 'media-feed-dark', storage: { ...EN, theme_preference: 'dark' }, dark: true, data: EN_MEDIA_DATA, route: route('MediaFeed') },
  { name: 'media-feed-te', storage: TE, data: TE_MEDIA_DATA, route: route('MediaFeed') },
  { name: 'media-feed-empty', storage: EN, data: { name: 'Joshua', churchName: 'Maranatha' }, route: route('MediaFeed') },
  { name: 'media-detail-light', storage: EN, data: EN_MEDIA_DATA, route: route('MediaDetail', { post: PHOTO_POST(EN_MEDIA) }) },
  { name: 'media-detail-dark', storage: { ...EN, theme_preference: 'dark' }, dark: true, data: EN_MEDIA_DATA, route: route('MediaDetail', { post: PHOTO_POST(EN_MEDIA) }) },
  { name: 'media-detail-te', storage: TE, data: TE_MEDIA_DATA, route: route('MediaDetail', { post: PHOTO_POST(TE_MEDIA) }) },
  { name: 'media-detail-link', storage: EN, data: { ...EN_MEDIA_DATA, mediaComments: {} }, route: route('MediaDetail', { post: VIDEO_LINK_POST }) },
  { name: 'media-detail-link-dark', storage: { ...EN, theme_preference: 'dark' }, dark: true, data: { ...EN_MEDIA_DATA, mediaComments: {} }, route: route('MediaDetail', { post: VIDEO_LINK_POST }) },
  { name: 'media-saved-light', storage: EN, data: { ...EN_MEDIA_DATA, savedPosts: EN_MEDIA }, route: route('SavedMedia') },
  { name: 'media-saved-dark', storage: { ...EN, theme_preference: 'dark' }, dark: true, data: { ...EN_MEDIA_DATA, savedPosts: EN_MEDIA }, route: route('SavedMedia') },
  { name: 'media-saved-te', storage: TE, data: { ...TE_MEDIA_DATA, savedPosts: TE_MEDIA }, route: route('SavedMedia') },
  { name: 'media-saved-empty', storage: EN, data: { name: 'Joshua', churchName: 'Maranatha' }, route: route('SavedMedia') },
  {
    name: 'media-saved-gone',
    storage: EN,
    data: { name: 'Joshua', churchName: 'Maranatha', media: [], savedPosts: EN_MEDIA },
    route: route('SavedMedia'),
    steps: async (qa) => {
      await qa.tap('saved-media-m0');
      await qa.advance(500);
    },
  },
  // --- The reader: its page, its chrome and its sheets
  { name: 'reader-light', storage: READER_EN, data: READER_DATA, route: route('BibleChapter', { bookId: 'john', chapterNumber: 3 }) },
  { name: 'reader-dark', storage: { ...READER_EN, theme_preference: 'dark' }, dark: true, data: READER_DATA, route: route('BibleChapter', { bookId: 'john', chapterNumber: 3 }) },
  { name: 'reader-sepia', storage: { ...READER_EN, reader_page_preference: 'sepia' }, data: READER_DATA, route: route('BibleChapter', { bookId: 'john', chapterNumber: 3 }) },
  { name: 'reader-sepia-dark-app', storage: { ...READER_EN, reader_page_preference: 'sepia', theme_preference: 'dark' }, dark: true, data: READER_DATA, route: route('BibleChapter', { bookId: 'john', chapterNumber: 3 }) },
  { name: 'reader-te', storage: { ...TE, bible_mode_preference: 'te' }, data: READER_DATA, route: route('BibleChapter', { bookId: 'john', chapterNumber: 3 }) },
  { name: 'reader-bilingual', storage: { ...READER_EN, bible_mode_preference: 'bilingual' }, data: READER_DATA, route: route('BibleChapter', { bookId: 'john', chapterNumber: 3 }) },
  {
    name: 'reader-hidden',
    storage: READER_EN,
    data: READER_DATA,
    route: route('BibleChapter', { bookId: 'john', chapterNumber: 3 }),
    steps: async (qa) => {
      await qa.tap('reader-scripture-surface');
      await qa.advance(300);
    },
  },
  {
    name: 'reader-plan',
    storage: READER_EN,
    data: { ...READER_DATA, planProgress: PSALMS_PROGRESS },
    route: route('BibleChapter', { bookId: 'psalms', chapterNumber: 23, fromPlan: { planId: 'seven-days-in-the-psalms', title: 'Seven Days in the Psalms', dayCount: 7, dayNumber: 2 } }),
  },
  {
    name: 'reader-plan-sepia',
    storage: { ...READER_EN, reader_page_preference: 'sepia' },
    data: { ...READER_DATA, planProgress: PSALMS_PROGRESS },
    route: route('BibleChapter', { bookId: 'psalms', chapterNumber: 23, fromPlan: { planId: 'seven-days-in-the-psalms', title: 'Seven Days in the Psalms', dayCount: 7, dayNumber: 2 } }),
  },
  {
    name: 'reader-plan-done',
    storage: READER_EN,
    data: { ...READER_DATA, planProgress: { 'seven-days-in-the-psalms': { currentDay: 3, completedDays: [1, 2] } } },
    route: route('BibleChapter', { bookId: 'psalms', chapterNumber: 23, fromPlan: { planId: 'seven-days-in-the-psalms', title: 'Seven Days in the Psalms', dayCount: 7, dayNumber: 2 } }),
  },
  { name: 'reader-unavailable', storage: { ...TE, bible_mode_preference: 'te' }, data: READER_DATA, route: route('BibleChapter', { bookId: 'malachi', chapterNumber: 4 }) },
  {
    name: 'reader-settings',
    reduced: true,
    storage: READER_EN,
    data: READER_DATA,
    route: route('BibleChapter', { bookId: 'john', chapterNumber: 3 }),
    steps: async (qa) => {
      await qa.tap('reader-settings-button');
      await qa.advance(500);
    },
  },
  {
    name: 'reader-settings-dark',
    reduced: true,
    storage: { ...READER_EN, theme_preference: 'dark' },
    dark: true,
    data: READER_DATA,
    route: route('BibleChapter', { bookId: 'john', chapterNumber: 3 }),
    steps: async (qa) => {
      await qa.tap('reader-settings-button');
      await qa.advance(500);
    },
  },
  {
    name: 'reader-settings-sepia',
    reduced: true,
    storage: { ...READER_EN, reader_page_preference: 'sepia' },
    data: READER_DATA,
    route: route('BibleChapter', { bookId: 'john', chapterNumber: 3 }),
    steps: async (qa) => {
      await qa.tap('reader-settings-button');
      await qa.advance(500);
    },
  },
  {
    name: 'reader-settings-te',
    reduced: true,
    storage: { ...TE, bible_mode_preference: 'te' },
    data: READER_DATA,
    route: route('BibleChapter', { bookId: 'john', chapterNumber: 3 }),
    steps: async (qa) => {
      await qa.tap('reader-settings-button');
      await qa.advance(500);
    },
  },
  {
    name: 'reader-settings-more',
    reduced: true,
    storage: READER_EN,
    data: READER_DATA,
    route: route('BibleChapter', { bookId: 'john', chapterNumber: 3 }),
    steps: async (qa) => {
      await qa.tap('reader-settings-button');
      await qa.advance(500);
      await qa.tap('reader-more-settings');
      await qa.advance(500);
    },
  },
  {
    name: 'reader-picker-chapters',
    reduced: true,
    storage: READER_EN,
    data: READER_DATA,
    route: route('BibleChapter', { bookId: 'john', chapterNumber: 3 }),
    steps: async (qa) => {
      await qa.tap('chapter-selector-button');
      await qa.advance(500);
    },
  },
  {
    name: 'reader-picker-books',
    reduced: true,
    storage: READER_EN,
    data: READER_DATA,
    route: route('BibleChapter', { bookId: 'john', chapterNumber: 3 }),
    steps: async (qa) => {
      await qa.tap('chapter-selector-button');
      await qa.advance(500);
      await qa.tap('chapter-picker-back-to-books');
      await qa.advance(300);
    },
  },
  {
    name: 'reader-picker-te',
    reduced: true,
    storage: { ...TE, bible_mode_preference: 'te' },
    data: READER_DATA,
    route: route('BibleChapter', { bookId: 'john', chapterNumber: 3 }),
    steps: async (qa) => {
      await qa.tap('chapter-selector-button');
      await qa.advance(500);
      await qa.tap('chapter-picker-back-to-books');
      await qa.advance(300);
    },
  },
  {
    name: 'reader-language-sheet',
    reduced: true,
    storage: READER_EN,
    data: READER_DATA,
    route: route('BibleChapter', { bookId: 'john', chapterNumber: 3 }),
    steps: async (qa) => {
      await qa.tap('reader-language-button');
      await qa.advance(500);
    },
  },
  {
    name: 'reader-verse-sheet',
    reduced: true,
    storage: READER_EN,
    data: READER_DATA,
    route: route('BibleChapter', { bookId: 'john', chapterNumber: 3 }),
    steps: async (qa) => {
      await qa.tap('verse-3');
      await qa.advance(500);
    },
  },
  {
    name: 'reader-verse-sheet-dark',
    reduced: true,
    storage: { ...READER_EN, theme_preference: 'dark' },
    dark: true,
    data: READER_DATA,
    route: route('BibleChapter', { bookId: 'john', chapterNumber: 3 }),
    steps: async (qa) => {
      await qa.tap('verse-3');
      await qa.advance(500);
    },
  },
  {
    name: 'reader-verse-sheet-plain',
    reduced: true,
    storage: READER_EN,
    data: READER_DATA,
    route: route('BibleChapter', { bookId: 'john', chapterNumber: 3 }),
    steps: async (qa) => {
      await qa.tap('verse-4');
      await qa.advance(500);
    },
  },
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
      // A sheet or a dialog slides in with a CSS animation the fake clock cannot hold still.
      reduced: scenario.reduced,
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
  if (scenario.steps) await scenario.steps(qa);
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
      fab: rect('prayer-wall-compose') ?? rect('prayers-new-entry'),
      chips: rect('prayer-wall-filter-all'),
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
  if (m.fab) console.log('floating button                 ', `${m.fab.w}x${m.fab.h}, right gap ${390 - m.fab.right} (20), bottom gap to bar ${m.bar.top - m.fab.bottom} (18)`);
  if (m.chips) console.log('chips                           ', `${m.chips.h} high (36)`);
}
console.log(problems.length ? '\nPROBLEMS:\n' + [...new Set(problems)].join('\n') : '\nno console errors or warnings');
