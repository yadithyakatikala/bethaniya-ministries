import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../features/auth/HomeScreen';
import { SongsListScreen } from '../features/songs/SongsListScreen';
import { SongDetailScreen } from '../features/songs/SongDetailScreen';
import type { PublishedSong } from '../services/firebase/songs';

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
 *
 * SongDetail receives the full song object as a route param rather than
 * an id the screen re-subscribes by -- SongsListScreen already holds the
 * complete, real-time PublishedSong list, so passing the object avoids a
 * redundant second Firestore subscription for a screen this simple.
 * Proportional to Day 6; a param-store or id-based re-fetch pattern can
 * be introduced later if a future day's screen needs to be linked to
 * directly (e.g. from a push notification) without coming from the list.
 */
export type RootStackParamList = {
  Home: undefined;
  SongsList: undefined;
  SongDetail: { song: PublishedSong };
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
