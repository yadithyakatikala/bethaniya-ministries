import { useState } from 'react';
import { View } from 'react-native';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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
import { getBookById } from '../features/bible/books';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { NotificationCenterScreen } from '../features/notifications/NotificationCenterScreen';
import { MoreScreen } from '../features/more/MoreScreen';
import { AnnouncementDetailScreen } from '../features/announcements/AnnouncementDetailScreen';
import type { PublishedAnnouncement } from '../services/firebase/announcements';
import { DailyVerseScreen } from '../features/daily-verses/DailyVerseScreen';
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

export function AppNavigator() {
  const [activeRoute, setActiveRoute] = useState<string | undefined>('Home');

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => setActiveRoute(navigationRef.getCurrentRoute()?.name)}
      onStateChange={() => setActiveRoute(navigationRef.getCurrentRoute()?.name)}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <Stack.Navigator initialRouteName="Home" screenOptions={{ animation: 'none' }}>
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ title: 'Home', headerShown: false }}
            />
            <Stack.Screen
              name="SongsList"
              component={SongsListScreen}
              options={{ title: 'Songs' }}
            />
            <Stack.Screen
              name="SongDetail"
              component={SongDetailScreen}
              options={({ route }) => ({ title: route.params.song.title })}
            />
            <Stack.Screen
              name="EventsList"
              component={EventsListScreen}
              options={{ title: 'Events' }}
            />
            <Stack.Screen
              name="EventDetail"
              component={EventDetailScreen}
              options={({ route }) => ({ title: route.params.event.title })}
            />
            <Stack.Screen
              name="YouTubePlayer"
              component={YouTubePlayerScreen}
              options={{ title: 'Live Stream' }}
            />
            <Stack.Screen
              name="BibleBooks"
              component={BooksListScreen}
              options={{ title: 'Bible' }}
            />
            <Stack.Screen
              name="BibleChapters"
              component={ChaptersListScreen}
              options={({ route }) => ({
                title: getBookById(route.params.bookId)?.name ?? 'Chapters',
              })}
            />
            <Stack.Screen
              name="BibleChapter"
              component={ChapterScreen}
              options={({ route }) => ({
                title: getBookById(route.params.bookId)?.name
                  ? `${getBookById(route.params.bookId)?.name} ${route.params.chapterNumber}`
                  : 'Chapter',
                headerShown: false,
              })}
            />
            <Stack.Screen
              name="BibleSearch"
              component={BibleSearchScreen}
              options={{ title: 'Search' }}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ title: 'Profile' }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ title: 'Settings' }}
            />
            <Stack.Screen
              name="NotificationCenter"
              component={NotificationCenterScreen}
              options={{ title: 'Notifications' }}
            />
            <Stack.Screen
              name="More"
              component={MoreScreen}
              options={{ title: 'More' }}
            />
            <Stack.Screen
              name="AnnouncementDetail"
              component={AnnouncementDetailScreen}
              options={({ route }) => ({ title: route.params.announcement.title })}
            />
            <Stack.Screen
              name="DailyVerse"
              component={DailyVerseScreen}
              options={{ title: 'Daily Verse', headerShown: false }}
            />
          </Stack.Navigator>
        </View>
        <RootTabBar activeRoute={activeRoute} />
      </View>
    </NavigationContainer>
  );
}
