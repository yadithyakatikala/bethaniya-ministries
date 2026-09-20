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
import { SongsListScreen } from '../features/songs/SongsListScreen';
import { SongDetailScreen } from '../features/songs/SongDetailScreen';
import type { PublishedSong } from '../services/firebase/songs';
import { EventsListScreen } from '../features/events/EventsListScreen';
import { EventDetailScreen } from '../features/events/EventDetailScreen';
import { YouTubePlayerScreen } from '../features/events/YouTubePlayerScreen';
import type { PublishedEvent } from '../services/firebase/events';
import { BooksListScreen } from '../features/bible/BooksListScreen';
import { ChaptersListScreen } from '../features/bible/ChaptersListScreen';
import { ReaderScreen } from '../features/bible/reader/ReaderScreen';
import { BibleSearchScreen } from '../features/bible/BibleSearchScreen';
import { getBookNameById } from '../features/bible/books';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { NotificationCenterScreen } from '../features/notifications/NotificationCenterScreen';
import { MoreScreen } from '../features/more/MoreScreen';
import { AnnouncementsScreen } from '../features/announcements/AnnouncementsScreen';
import { AnnouncementDetailScreen } from '../features/announcements/AnnouncementDetailScreen';
import type { PublishedAnnouncement } from '../services/firebase/announcements';
import { DailyVerseScreen } from '../features/daily-verses/DailyVerseScreen';
import { MediaFeedScreen } from '../features/media/MediaFeedScreen';
import { MediaDetailScreen } from '../features/media/MediaDetailScreen';
import { SavedMediaScreen } from '../features/media/SavedMediaScreen';
import type { MediaPost } from '../services/firebase/media';
import { PrayersScreen } from '../features/prayers/PrayersScreen';
import { CommunityListScreen } from '../features/community/CommunityListScreen';
import { CommunityPostDetailScreen } from '../features/community/CommunityPostDetailScreen';
import { CommunityChatScreen } from '../features/community/CommunityChatScreen';
import { PrayerWallScreen } from '../features/prayer-wall/PrayerWallScreen';
import type { PublishedCommunityPost } from '../services/firebase/communityPosts';
import { PlansListScreen } from '../features/plans/PlansListScreen';
import { PlanDetailScreen } from '../features/plans/PlanDetailScreen';
import { PlanDayScreen } from '../features/plans/PlanDayScreen';
import type { PublishedPlan } from '../services/firebase/plans';
import {
  LegalScreen,
  PRIVACY_POLICY_BODY,
  PRIVACY_POLICY_TITLE,
  TERMS_BODY,
  TERMS_TITLE,
} from '../features/legal/LegalScreen';
import { TabBar, type TabRouteName } from './TabBar';

/** The five top-level routes the hand-rolled tab bar switches between -- see TabBar.tsx. */
const TAB_ROUTE_NAMES: ReadonlySet<string> = new Set([
  'Home',
  'BibleBooks',
  'SongsList',
  'EventsList',
  'More',
]);

/**
 * Real navigation, introduced in Day 6 -- per the user's explicit
 * approval, this replaces the state-based screen toggle that would
 * otherwise have been used, so the structure below doesn't need to be
 * replaced again when Day 9 (Bible Search + Profile) adds more screens:
 * new top-level destinations become new entries in RootStackParamList
 * and new <Stack.Screen> registrations, without touching the ones
 * already here.
 *
 * Matches the approved structure exactly:
 *   Home -> Songs (SongsList) -> Song Detail + Player (SongDetail)
 *   Home -> Events (EventsList) -> Event Detail (EventDetail) -> YouTube
 *     Player (YouTubePlayer), reached only via EventDetail's "WATCH LIVE"
 *     button, itself only shown when the event is actually live.
 *   Home -> Bible (BibleBooks) -> Chapters (BibleChapters) -> Chapter
 *     Reader (BibleChapter), added Day 8. Retires the orphaned Day 1
 *     BibleScreen (never wired into navigation) rather than leaving a
 *     second, dead Bible UI around -- see features/bible/dataSource.ts
 *     for the module's data-source seam and current placeholder-content
 *     status.
 *
 * SongDetail/EventDetail receive the full song/event object as a route
 * param rather than an id the screen re-subscribes by -- SongsListScreen/
 * EventsListScreen already hold the complete, real-time list, so passing
 * the object avoids a redundant second Firestore subscription for a
 * screen this simple. Proportional to Days 6-7; a param-store or
 * id-based re-fetch pattern can be introduced later if a future day's
 * screen needs to be linked to directly (e.g. from a push notification)
 * without coming from the list. YouTubePlayer takes only the raw
 * youtubeUrl string (not the whole event) -- see youtube.ts for how it's
 * parsed into a playable embed URL.
 */
export type RootStackParamList = {
  Home: undefined;
  SongsList: undefined;
  SongDetail: { song: PublishedSong };
  EventsList: undefined;
  EventDetail: { event: PublishedEvent };
  YouTubePlayer: { youtubeUrl: string };
  BibleBooks: undefined;
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
   */
  BibleChapter: { bookId: string; chapterNumber: number; verse?: number };
  BibleSearch: undefined;
  Profile: undefined;
  Settings: undefined;
  NotificationCenter: undefined;
  /** The fifth tab -- see ../features/more/MoreScreen.tsx and ./TabBar.tsx. */
  More: undefined;
  /** The announcements list, reached from Home's top-right utility icon.
   * Announcements used to be a content block on Home; see
   * ../features/announcements/AnnouncementsScreen.tsx for why it moved.
   * Distinct from NotificationCenter -- church content vs local delivery
   * history. */
  Announcements: undefined;
  /** See ../features/announcements/AnnouncementDetailScreen.tsx -- same
   * "pass the full object, not just an id" reasoning as SongDetail/
   * EventDetail (AnnouncementsList already holds the complete, real-time
   * list). */
  AnnouncementDetail: { announcement: PublishedAnnouncement };
  /** See ../features/daily-verses/DailyVerseScreen.tsx. */
  DailyVerse: undefined;
  /**
   * M6's media feed. Reached from Home's media section and from the More
   * tab -- NOT from the bottom bar, which stays Home | Bible | Songs |
   * Events | More exactly as it was. Media is content, like
   * Announcements and Community, and those live behind More too.
   */
  MediaFeed: undefined;
  /** The full post. Takes the whole object rather than an id, the same
   *  reasoning as SongDetail/EventDetail -- the feed already holds it.
   *  SavedMediaScreen re-reads the real post before navigating, so a
   *  stale saved copy never reaches this screen. */
  MediaDetail: { post: MediaPost };
  /** The member's bookmarks. See ../features/media/SavedMediaScreen.tsx. */
  SavedMedia: undefined;
  /** New V1 feature -- see ../features/prayers/PrayersScreen.tsx. Reached
   * from the More tab, not the bottom tab bar (existing
   * Home/Bible/Songs/Events/More navigation is kept unchanged per
   * explicit owner decision). */
  Prayers: undefined;
  /** New V1 feature -- see ../features/community/. Same "pass the full
   * object, not just an id" reasoning as AnnouncementDetail. */
  CommunityList: undefined;
  CommunityPostDetail: { post: PublishedCommunityPost };
  /**
   * M7's group chat. A SEPARATE route from CommunityList, and a separate
   * collection: CommunityList is the admin-authored posts feed, this is
   * the congregation talking to each other. Reached from the More tab;
   * the bottom bar stays Home | Bible | Songs | Events | More.
   */
  CommunityChat: undefined;
  /**
   * M7's shared prayer wall. Distinct from `Prayers`, which is the
   * member's own private journal -- see ../features/prayer-wall/.
   */
  PrayerWall: undefined;
  /** New V1 feature -- see ../features/plans/. */
  PlansList: undefined;
  PlanDetail: { plan: PublishedPlan };
  PlanDay: { plan: PublishedPlan; dayNumber: number };
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
  if (!activeRoute || !TAB_ROUTE_NAMES.has(activeRoute)) return null;
  return (
    <TabBar
      activeRoute={activeRoute}
      onNavigate={(route: TabRouteName) => {
        if (navigationRef.isReady()) navigationRef.navigate(route);
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
export function buildScreenOptions(colors: ThemeColors): NativeStackNavigationOptions {
  return {
    // The platform push transition, instead of the blanket
    // `animation: 'none'` that made every drill-down an instant cut.
    animation: 'default',
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
 * The five tab destinations keep `animation: 'none'`. Switching tabs is a
 * lateral move, not a drill-down, so a slide-in would read as if the app
 * had pushed a new screen. Everything else gets the platform's own push
 * transition -- see AppNavigator's screenOptions.
 */
const TAB_SCREEN_OPTIONS: NativeStackNavigationOptions = { animation: 'none' };

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

  const screenOptions = useMemo(() => buildScreenOptions(colors), [colors]);
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
                ...TAB_SCREEN_OPTIONS,
                title: t('nav.home'),
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="SongsList"
              component={SongsListScreen}
              options={{ ...TAB_SCREEN_OPTIONS, title: t('songs.title') }}
            />
            <Stack.Screen
              name="SongDetail"
              component={SongDetailScreen}
              options={({ route }) => ({ title: route.params.song.title })}
            />
            <Stack.Screen
              name="EventsList"
              component={EventsListScreen}
              options={{ ...TAB_SCREEN_OPTIONS, title: t('events.title') }}
            />
            <Stack.Screen
              name="EventDetail"
              component={EventDetailScreen}
              options={({ route }) => ({ title: route.params.event.title })}
            />
            <Stack.Screen
              name="YouTubePlayer"
              component={YouTubePlayerScreen}
              options={{ title: t('events.watchOnYouTube') }}
            />
            <Stack.Screen
              name="BibleBooks"
              component={BooksListScreen}
              options={{ ...TAB_SCREEN_OPTIONS, title: t('bible.title') }}
            />
            <Stack.Screen
              name="BibleChapters"
              component={ChaptersListScreen}
              options={({ route }) => ({
                title:
                  getBookNameById(route.params.bookId, bookNameLanguage) ??
                  t('bible.chapters'),
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
              options={{ title: t('common.search') }}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ title: t('profile.title') }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ title: t('settings.title') }}
            />
            <Stack.Screen
              name="NotificationCenter"
              component={NotificationCenterScreen}
              options={{ title: t('notifications.title') }}
            />
            <Stack.Screen
              name="More"
              component={MoreScreen}
              options={{ ...TAB_SCREEN_OPTIONS, title: t('more.title') }}
            />
            <Stack.Screen
              name="Announcements"
              component={AnnouncementsScreen}
              options={{ title: t('announcements.title') }}
            />
            <Stack.Screen
              name="AnnouncementDetail"
              component={AnnouncementDetailScreen}
              options={({ route }) => ({ title: route.params.announcement.title })}
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
              name="Prayers"
              component={PrayersScreen}
              options={{ title: t('prayers.title') }}
            />
            <Stack.Screen
              name="CommunityList"
              component={CommunityListScreen}
              options={{ title: t('community.title') }}
            />
            <Stack.Screen
              name="CommunityPostDetail"
              component={CommunityPostDetailScreen}
              options={({ route }) => ({ title: route.params.post.title })}
            />
            <Stack.Screen
              name="CommunityChat"
              component={CommunityChatScreen}
              options={{ title: t('chat.title') }}
            />
            <Stack.Screen
              name="PrayerWall"
              component={PrayerWallScreen}
              options={{ title: t('prayerWall.title') }}
            />
            <Stack.Screen
              name="PlansList"
              component={PlansListScreen}
              options={{ title: t('plans.title') }}
            />
            <Stack.Screen
              name="PlanDetail"
              component={PlanDetailScreen}
              options={({ route }) => ({ title: route.params.plan.title })}
            />
            <Stack.Screen
              name="PlanDay"
              component={PlanDayScreen}
              options={({ route }) => ({
                title: `${route.params.plan.title} • ${t('plans.day')} ${route.params.dayNumber}`,
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
