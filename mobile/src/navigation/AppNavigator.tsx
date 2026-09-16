import { useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  createNavigationContainerRef,
  type Theme,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import { useTheme } from '../theme';
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
import { ChapterScreen } from '../features/bible/ChapterScreen';
import { BibleSearchScreen } from '../features/bible/BibleSearchScreen';
import { getBookNameById } from '../features/bible/books';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { NotificationCenterScreen } from '../features/notifications/NotificationCenterScreen';
import { MoreScreen } from '../features/more/MoreScreen';
import { AnnouncementDetailScreen } from '../features/announcements/AnnouncementDetailScreen';
import type { PublishedAnnouncement } from '../services/firebase/announcements';
import { DailyVerseScreen } from '../features/daily-verses/DailyVerseScreen';
import { PrayersScreen } from '../features/prayers/PrayersScreen';
import { CommunityListScreen } from '../features/community/CommunityListScreen';
import { CommunityPostDetailScreen } from '../features/community/CommunityPostDetailScreen';
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
  BibleChapter: { bookId: string; chapterNumber: number };
  BibleSearch: undefined;
  Profile: undefined;
  Settings: undefined;
  NotificationCenter: undefined;
  /** The fifth tab -- see ../features/more/MoreScreen.tsx and ./TabBar.tsx. */
  More: undefined;
  /** See ../features/announcements/AnnouncementDetailScreen.tsx -- same
   * "pass the full object, not just an id" reasoning as SongDetail/
   * EventDetail (AnnouncementsList already holds the complete, real-time
   * list). */
  AnnouncementDetail: { announcement: PublishedAnnouncement };
  /** See ../features/daily-verses/DailyVerseScreen.tsx. */
  DailyVerse: undefined;
  /** New V1 feature -- see ../features/prayers/PrayersScreen.tsx. Reached
   * from the More tab, not the bottom tab bar (existing
   * Home/Bible/Songs/Events/More navigation is kept unchanged per
   * explicit owner decision). */
  Prayers: undefined;
  /** New V1 feature -- see ../features/community/. Same "pass the full
   * object, not just an id" reasoning as AnnouncementDetail. */
  CommunityList: undefined;
  CommunityPostDetail: { post: PublishedCommunityPost };
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
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

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
  const { t, language } = useTranslation();

  /**
   * Header theming. Every pushed screen used the native-stack default
   * header -- white background, black title -- which sat above a
   * `colors.paper` (#141A17) screen body in dark mode. This was the most
   * visible dark-mode defect in the app: roughly twenty screens with a
   * white bar across the top.
   */
  const screenOptions = useMemo<NativeStackNavigationOptions>(
    () => ({
      // The platform push transition, instead of the blanket
      // `animation: 'none'` that made every drill-down an instant cut.
      animation: 'default',
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.ink,
      headerTitleStyle: { color: colors.ink, fontWeight: '600' },
      headerShadowVisible: false,
      contentStyle: { backgroundColor: colors.paper },
    }),
    [colors]
  );

  /**
   * NavigationContainer paints its own background between screens. Left at
   * the default it flashes white behind a dark-mode push.
   */
  const navigationTheme = useMemo<Theme>(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.paper,
        card: colors.surface,
        text: colors.ink,
        border: colors.border,
      },
    };
  }, [colors, isDark]);

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
                  getBookNameById(route.params.bookId, language) ?? t('bible.chapters'),
              })}
            />
            <Stack.Screen
              name="BibleChapter"
              component={ChapterScreen}
              options={({ route }) => ({
                title: getBookNameById(route.params.bookId, language)
                  ? `${getBookNameById(route.params.bookId, language)} ${route.params.chapterNumber}`
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
