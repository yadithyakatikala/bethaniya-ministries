import { NavigationContainer } from '@react-navigation/native';
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
import { getBookById } from '../features/bible/books';

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
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
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
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
