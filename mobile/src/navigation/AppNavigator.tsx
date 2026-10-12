import { useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import { navigationRef } from './navigationRef';
import { usePreferences } from '../context/PreferencesContext';
import { bookNameLanguageFor } from '../features/bible/types';
import type { ThemeColors } from '../theme';
import { useTranslation } from '../i18n';
import { HomeScreen } from '../features/auth/HomeScreen';
import { BibleTranslationsScreen } from '../features/settings/BibleTranslationsScreen';
import { SongsListScreen } from '../features/songs/SongsListScreen';
import { SongDetailScreen } from '../features/songs/SongDetailScreen';
import type { PublishedSong } from '../services/firebase/songs';
import { EventsListScreen } from '../features/events/EventsListScreen';
import { EventDetailScreen } from '../features/events/EventDetailScreen';
import { YouTubePlayerScreen } from '../features/events/YouTubePlayerScreen';
import type { PublishedEvent } from '../services/firebase/events';
import { BibleHomeScreen } from '../features/bible/BibleHomeScreen';
import { ChaptersListScreen } from '../features/bible/ChaptersListScreen';
import { ReaderScreen } from '../features/bible/reader/ReaderScreen';
import { BibleSearchScreen } from '../features/bible/BibleSearchScreen';
import { getBookNameById } from '../features/bible/books';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { NotificationCenterScreen } from '../features/notifications/NotificationCenterScreen';
import { AnnouncementDetailScreen } from '../features/announcements/AnnouncementDetailScreen';
import type { PublishedAnnouncement } from '../services/firebase/announcements';
import { DailyVerseScreen } from '../features/daily-verses/DailyVerseScreen';
import { MediaFeedScreen } from '../features/media/MediaFeedScreen';
import { MediaDetailScreen } from '../features/media/MediaDetailScreen';
import { SavedMediaScreen } from '../features/media/SavedMediaScreen';
import type { MediaPost } from '../services/firebase/media';
import { PrayersHubScreen } from '../features/prayers/PrayersHubScreen';
import { CommunityHubScreen } from '../features/community/CommunityHubScreen';
import { CommunityPostDetailScreen } from '../features/community/CommunityPostDetailScreen';
import { YouScreen } from '../features/you/YouScreen';
import { SavedVersesScreen } from '../features/you/SavedVersesScreen';
import type { PublishedCommunityPost } from '../services/firebase/communityPosts';
import { PlanDetailScreen } from '../features/plans/PlanDetailScreen';
import { PlanDayScreen } from '../features/plans/PlanDayScreen';
import { PlanDoneScreen } from '../features/plans/PlanDoneScreen';
import type { PublishedPlan } from '../services/firebase/plans';
import type { PlanReading } from '../features/plans/planReading';
import {
  LegalScreen,
  PRIVACY_POLICY_BODY,
  PRIVACY_POLICY_TITLE,
  TERMS_BODY,
  TERMS_TITLE,
} from '../features/legal/LegalScreen';
import { TabBar, type TabRouteName } from './TabBar';
import { useKeyboardVisible } from './useKeyboardVisible';
import {
  PUSH_ANIMATION_MS,
  TAB_FADE_MS,
  animationDuration,
  pushAnimation,
  tabAnimation,
  useReducedMotion,
} from '../theme/motion';

/**
 * The five top-level routes the hand-rolled tab bar switches between -- see
 * TabBar.tsx. Songs, Events and Photos and videos are no longer among them:
 * they are on Community's shelf and open as ordinary pushed screens.
 */
const TAB_ROUTE_NAMES: ReadonlySet<string> = new Set<TabRouteName>([
  'Home',
  'BibleBooks',
  'PrayersHub',
  'CommunityHub',
  'You',
]);

/**
 * Real navigation, introduced in Day 6 -- per the user's explicit
 * approval, this replaces the state-based screen toggle that would
 * otherwise have been used, so the structure below doesn't need to be
 * replaced again as screens are added: new destinations become new entries
 * in RootStackParamList and new <Stack.Screen> registrations, without
 * touching the ones already here.
 *
 * THE SHAPE (the approved "Shape A"). Five tabs -- Home | Bible | Prayers |
 * Community | You -- each ONE destination, with its views inside it:
 *   Prayers   = Requests (the wall) and My journal      (PrayersHub)
 *   Community = Updates (announcements + posts) and Chat (CommunityHub),
 *               with a shelf to Events, Songs and Photos and videos
 *   You       = Saved and Profile, with Notifications and Settings beside
 *               the title                                (You)
 * The old fifth tab, More, is retired -- everything on it has a home above
 * -- and so are the separate Announcements, Prayers, Prayer wall, Community
 * and Chat screens: each is a view inside a hub now. Songs and Events used to
 * be tabs; they are pushed from Community's shelf.
 *
 * Detail screens (a song, an event, a post) receive the full object as a
 * route param rather than an id the screen re-subscribes by -- the list that
 * opens them already holds the complete, real-time data, so passing the
 * object avoids a redundant second Firestore subscription. YouTubePlayer
 * takes only the raw youtubeUrl string (not the whole event) -- see
 * youtube.ts for how it's parsed into a playable embed URL.
 *
 * `tab` params choose the hub's inner view when another screen sends the
 * member there ("My journal" from Saved, Profile from a notification); see
 * ./useRouteTab.ts.
 */
export type RootStackParamList = {
  Home: undefined;
  /** Bible -- Read (the books) | Plans. See ../features/bible/BibleHomeScreen.tsx. */
  BibleBooks: { tab?: 'read' | 'plans' } | undefined;
  /** Prayers -- Requests | My journal. See ../features/prayers/PrayersHubScreen.tsx. */
  PrayersHub: { tab?: 'requests' | 'journal' } | undefined;
  /** Community -- Updates | Chat. See ../features/community/CommunityHubScreen.tsx. */
  CommunityHub: { tab?: 'updates' | 'chat' } | undefined;
  /** You -- Saved | Profile. See ../features/you/YouScreen.tsx. */
  You: { tab?: 'saved' | 'profile' } | undefined;
  /** The member's notes, highlights or bookmarks, as lists. See ../features/you/SavedVersesScreen.tsx. */
  SavedVerses: { kind?: 'notes' | 'highlights' | 'bookmarks' } | undefined;
  /** Who wrote the bundled Bibles and under what licence. See ../features/settings/BibleTranslationsScreen.tsx. */
  BibleTranslations: undefined;
  SongsList: undefined;
  SongDetail: { song: PublishedSong };
  EventsList: undefined;
  EventDetail: { event: PublishedEvent };
  /** `title` is the event's name, for the player's top bar. */
  YouTubePlayer: { youtubeUrl: string; title?: string };
  BibleChapters: { bookId: string };
  /**
   * The immersive reader (M4 -- see
   * ../features/bible/reader/ReaderScreen.tsx). Deliberately the SAME
   * route it has always been: it is already outside TAB_ROUTE_NAMES and
   * already registered with headerShown: false, so the tab bar is absent
   * and the screen owns its chrome. M4 changed what the route renders,
   * not the navigation architecture.
   *
   * `verse` is optional and OPENS AT that verse -- it is how a search
   * result lands on the right line. It is a scroll target, never a
   * redirect: the book and chapter the caller asked for are what the
   * reader shows.
   *
   * `fromPlan` is set when the reading was opened from a day of a reading
   * plan: the reader then shows that plan's chip (and its Mark Complete) and
   * carries it across chapters. See ../features/plans/planReading.ts.
   */
  BibleChapter: {
    bookId: string;
    chapterNumber: number;
    verse?: number;
    fromPlan?: PlanReading;
  };
  BibleSearch: undefined;
  Settings: undefined;
  /** Church content vs local delivery history: not the same as Updates. */
  NotificationCenter: undefined;
  /** See ../features/announcements/AnnouncementDetailScreen.tsx -- same
   * "pass the full object, not just an id" reasoning as SongDetail/
   * EventDetail (the Updates feed already holds the complete, real-time
   * list). */
  AnnouncementDetail: { announcement: PublishedAnnouncement };
  /** See ../features/daily-verses/DailyVerseScreen.tsx. */
  DailyVerse: undefined;
  /**
   * M6's media feed. Reached from Home's Together section and from
   * Community's shelf -- never from the bottom bar.
   */
  MediaFeed: undefined;
  /** The full post. Takes the whole object rather than an id, the same
   *  reasoning as SongDetail/EventDetail -- the feed already holds it.
   *  SavedMediaScreen re-reads the real post before navigating, so a
   *  stale saved copy never reaches this screen. */
  MediaDetail: { post: MediaPost };
  /** The member's bookmarks. See ../features/media/SavedMediaScreen.tsx. */
  SavedMedia: undefined;
  /** See ../features/community/CommunityPostDetailScreen.tsx. Same "pass the
   * full object, not just an id" reasoning as AnnouncementDetail. */
  CommunityPostDetail: { post: PublishedCommunityPost };
  /** New V1 feature -- see ../features/plans/. */
  PlanDetail: { plan: PublishedPlan };
  PlanDay: { plan: PublishedPlan; dayNumber: number };
  /** The finish of a plan: opened in place of its last day. */
  PlanDone: { plan: PublishedPlan };
  /** Reached from Settings' "Privacy policy" / "Terms" rows -- see
   * ../features/legal/LegalScreen.tsx. */
  PrivacyPolicy: undefined;
  Terms: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Day 10: a module-level ref to the navigation tree, so
 * ../services/notifications/notificationService.ts's notification-tap
 * handler can navigate without needing a navigation prop of its own --
 * it fires from a global expo-notifications listener, outside any
 * screen's render tree. See React Navigation's own documented pattern
 * for "navigating without the navigation prop."
 */
// Defined in ./navigationRef.ts so a service can reach it without
// importing this module -- see that file for the cycle it broke.
// Re-exported here because every existing call site imports it
// from this module.
export { navigationRef };

/**
 * Renders as a sibling of the Stack.Navigator, inside the same
 * NavigationContainer -- see the module doc comment above for why a
 * hand-rolled bar (not @react-navigation/bottom-tabs) was built. Its
 * visibility and active tab are driven by NavigationContainer's
 * onStateChange below, reading navigationRef.getCurrentRoute().name --
 * the same "navigate without a navigation prop" pattern
 * notificationService.ts's tap handler already uses.
 */
function RootTabBar({ activeRoute }: { activeRoute: string | undefined }) {
  // Out of the way while the keyboard is up (see ./useKeyboardVisible.ts).
  const keyboardVisible = useKeyboardVisible();
  if (!activeRoute || !TAB_ROUTE_NAMES.has(activeRoute) || keyboardVisible) return null;
  return (
    <TabBar
      activeRoute={activeRoute}
      onNavigate={(route: TabRouteName) => {
        // `pop`: go BACK to the tab if it is already below in the stack
        // (and drop what was opened above it), instead of pushing a second
        // copy -- Home, Bible, Home, Bible would otherwise be four screens
        // deep and Back would replay them.
        if (navigationRef.isReady())
          navigationRef.navigate(route, undefined, { pop: true });
      }}
    />
  );
}

/**
 * Header, container and content theming for the whole stack.
 *
 * WHY THIS IS EXPORTED. Every pushed screen used to get
 * @react-navigation/native-stack's DEFAULT header -- white background,
 * black title -- which sat above a `colors.paper` (#141A17) body in dark
 * mode. A V1 tester reported "the whole app is not turning dark" and
 * their screenshots showed exactly that: dark content under white bars on
 * Reading Plans, Prayers, Bible and Terms of Service.
 *
 * The screen BODIES were themed all along -- every screen calls
 * useTheme() -- so only the chrome was wrong, which is why it looked like
 * a partial failure. Nothing in the suite asserted anything about
 * `screenOptions`, so a device was the first thing to notice.
 *
 * Pulling these out of the component makes them plain functions of the
 * palette, so ../theme/__tests__/darkMode.test.tsx can assert the real
 * values without mounting twenty screens and their Firebase mocks.
 */
export function buildScreenOptions(
  colors: ThemeColors,
  /** The system "reduce motion" setting -- see ./motion.ts. */
  reducedMotion = false
): NativeStackNavigationOptions {
  return {
    // The platform push transition, instead of the blanket
    // `animation: 'none'` that made every drill-down an instant cut --
    // and nothing at all when the phone asks for no animations.
    animation: pushAnimation(reducedMotion),
    animationDuration: animationDuration(reducedMotion, PUSH_ANIMATION_MS),
    headerStyle: { backgroundColor: colors.surface },
    headerTintColor: colors.ink,
    headerTitleStyle: { color: colors.ink, fontWeight: '600' },
    headerShadowVisible: false,
    // Covers the screen body, including the gap before a screen's own
    // container paints.
    contentStyle: { backgroundColor: colors.paper },
  };
}

/**
 * NavigationContainer paints its own background between screens; left at
 * the default it flashes white behind a dark-mode push.
 */
export function buildNavigationTheme(colors: ThemeColors, isDark: boolean): Theme {
  const base = isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: isDark,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.paper,
      card: colors.surface,
      text: colors.ink,
      border: colors.border,
    },
  };
}

/**
 * The five tab destinations CROSS-FADE.
 *
 * Switching tabs is a lateral move, not a drill-down, so they must not
 * slide: a slide-in would read as if the app had pushed a new screen on
 * top of the old one. They used to be an instant cut, which is the
 * "abrupt" a tester was describing -- a fade is the smallest thing that
 * says one view replaced another. Everything else gets the platform's
 * own push transition; see buildScreenOptions above and ./motion.ts.
 */
export function buildTabScreenOptions(
  reducedMotion = false
): NativeStackNavigationOptions {
  return {
    animation: tabAnimation(reducedMotion),
    animationDuration: animationDuration(reducedMotion, TAB_FADE_MS),
  };
}

export function AppNavigator() {
  const [activeRoute, setActiveRoute] = useState<string | undefined>('Home');
  const { colors, isDark } = useTheme();
  // Header titles are user-facing text and must follow the app language
  // -- they were hardcoded English, including the Bible book names.
  const { t } = useTranslation();
  // Bible book names in the header follow the BIBLE preference, not the
  // interface language -- they label scripture. bookNameLanguageFor()
  // resolves bilingual mode to the reader's own app language, since a
  // paired reader's labels are chrome rather than scripture.
  const { appLanguage, bibleMode } = usePreferences();
  const bookNameLanguage = bookNameLanguageFor(bibleMode, appLanguage);

  // The phone's own "reduce animations" setting. Read here, applied to
  // every transition in the app -- see ./motion.ts.
  const reducedMotion = useReducedMotion();

  const screenOptions = useMemo(
    () => buildScreenOptions(colors, reducedMotion),
    [colors, reducedMotion]
  );
  const tabScreenOptions = useMemo(
    () => buildTabScreenOptions(reducedMotion),
    [reducedMotion]
  );
  const navigationTheme = useMemo(
    () => buildNavigationTheme(colors, isDark),
    [colors, isDark]
  );

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      onReady={() => setActiveRoute(navigationRef.getCurrentRoute()?.name)}
      onStateChange={() => setActiveRoute(navigationRef.getCurrentRoute()?.name)}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <Stack.Navigator initialRouteName="Home" screenOptions={screenOptions}>
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{
                ...tabScreenOptions,
                title: t('nav.home'),
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="SongsList"
              component={SongsListScreen}
              options={{ title: t('songs.title'), headerShown: false }}
            />
            <Stack.Screen
              name="SongDetail"
              component={SongDetailScreen}
              options={({ route }) => ({
                title: route.params.song.title,
                headerShown: false,
              })}
            />
            <Stack.Screen
              name="EventsList"
              component={EventsListScreen}
              options={{ title: t('events.title'), headerShown: false }}
            />
            <Stack.Screen
              name="EventDetail"
              component={EventDetailScreen}
              options={({ route }) => ({
                title: route.params.event.title,
                headerShown: false,
              })}
            />
            <Stack.Screen
              name="YouTubePlayer"
              component={YouTubePlayerScreen}
              options={{ title: t('events.watchOnYouTube'), headerShown: false }}
            />
            <Stack.Screen
              name="BibleBooks"
              component={BibleHomeScreen}
              options={{
                ...tabScreenOptions,
                title: t('bible.title'),
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="BibleChapters"
              component={ChaptersListScreen}
              options={({ route }) => ({
                title:
                  getBookNameById(route.params.bookId, bookNameLanguage) ??
                  t('bible.chapters'),
                headerShown: false,
              })}
            />
            <Stack.Screen
              name="BibleChapter"
              component={ReaderScreen}
              options={({ route }) => ({
                title: getBookNameById(route.params.bookId, bookNameLanguage)
                  ? `${getBookNameById(route.params.bookId, bookNameLanguage)} ${route.params.chapterNumber}`
                  : t('bible.chapter'),
                headerShown: false,
              })}
            />
            <Stack.Screen
              name="BibleSearch"
              component={BibleSearchScreen}
              options={{ title: t('common.search'), headerShown: false }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ title: t('settings.title'), headerShown: false }}
            />
            <Stack.Screen
              name="BibleTranslations"
              component={BibleTranslationsScreen}
              options={{ title: t('settings.bibleTranslations'), headerShown: false }}
            />
            <Stack.Screen
              name="NotificationCenter"
              component={NotificationCenterScreen}
              options={{ title: t('notifications.title'), headerShown: false }}
            />
            <Stack.Screen
              name="PrayersHub"
              component={PrayersHubScreen}
              options={{
                ...tabScreenOptions,
                title: t('nav.prayers'),
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="CommunityHub"
              component={CommunityHubScreen}
              options={{
                ...tabScreenOptions,
                title: t('nav.community'),
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="You"
              component={YouScreen}
              options={{ ...tabScreenOptions, title: t('nav.you'), headerShown: false }}
            />
            <Stack.Screen
              name="SavedVerses"
              component={SavedVersesScreen}
              options={{ title: t('you.tabSaved'), headerShown: false }}
            />
            <Stack.Screen
              name="AnnouncementDetail"
              component={AnnouncementDetailScreen}
              options={({ route }) => ({
                title: route.params.announcement.title,
                headerShown: false,
              })}
            />
            <Stack.Screen
              name="DailyVerse"
              component={DailyVerseScreen}
              options={{ title: t('dailyVerse.title'), headerShown: false }}
            />
            <Stack.Screen
              name="MediaFeed"
              component={MediaFeedScreen}
              options={{ title: t('media.title') }}
            />
            <Stack.Screen
              name="MediaDetail"
              component={MediaDetailScreen}
              options={{ title: t('media.title') }}
            />
            <Stack.Screen
              name="SavedMedia"
              component={SavedMediaScreen}
              options={{ title: t('media.savedTitle') }}
            />
            <Stack.Screen
              name="CommunityPostDetail"
              component={CommunityPostDetailScreen}
              options={({ route }) => ({
                title: route.params.post.title,
                headerShown: false,
              })}
            />
            <Stack.Screen
              name="PlanDetail"
              component={PlanDetailScreen}
              options={({ route }) => ({
                title: route.params.plan.title,
                headerShown: false,
              })}
            />
            <Stack.Screen
              name="PlanDay"
              component={PlanDayScreen}
              options={({ route }) => ({
                title: `${route.params.plan.title} • ${t('plans.day')} ${route.params.dayNumber}`,
                headerShown: false,
              })}
            />
            <Stack.Screen
              name="PlanDone"
              component={PlanDoneScreen}
              options={({ route }) => ({
                title: route.params.plan.title,
                headerShown: false,
              })}
            />
            <Stack.Screen
              name="PrivacyPolicy"
              options={{ title: t('settings.privacyPolicy') }}
            >
              {() => (
                <LegalScreen title={PRIVACY_POLICY_TITLE} body={PRIVACY_POLICY_BODY} />
              )}
            </Stack.Screen>
            <Stack.Screen name="Terms" options={{ title: t('settings.terms') }}>
              {() => <LegalScreen title={TERMS_TITLE} body={TERMS_BODY} />}
            </Stack.Screen>
          </Stack.Navigator>
        </View>
        <RootTabBar activeRoute={activeRoute} />
      </View>
    </NavigationContainer>
  );
}
