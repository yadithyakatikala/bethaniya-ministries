import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  subscribeToPublishedSongs,
  type PublishedSong,
} from '../../services/firebase/songs';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useTheme } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'SongsList'>;

/**
 * Published-songs list -- Day 6 scope. Real-time listener +
 * loading/error/empty/list states, same shape as AnnouncementsList.tsx.
 * Tapping a song navigates to SongDetail, passing the full song object
 * as a route param (see AppNavigator.tsx's doc comment for why).
 *
 * Restyled onto the shared Vespers theme, and now renders `coverUrl`
 * when a song has one -- previously uploaded but never displayed
 * anywhere in the app (flagged as a "free win" in the UI audit).
 * SongsListScreen.test.tsx now wraps with AuthProvider/
 * PreferencesProvider the same way other theme-migrated screens do.
 */
export function SongsListScreen({ navigation }: Props) {
  const { colors, radii, spacing } = useTheme();
  const [songs, setSongs] = useState<PublishedSong[] | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToPublishedSongs(
      (next) => {
        setSongs(next);
        setHasError(false);
      },
      () => setHasError(true)
    );
    return unsubscribe;
  }, []);

  if (hasError) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.background }]}
        testID="songs-error"
      >
        <Text style={[styles.message, { color: colors.secondaryText }]}>
          Could not load songs.
        </Text>
      </View>
    );
  }

  if (!songs) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.background }]}
        testID="songs-loading"
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (songs.length === 0) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.background }]}
        testID="songs-empty"
      >
        <Text style={[styles.message, { color: colors.secondaryText }]}>
          No songs yet.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      testID="songs-list"
      data={songs}
      keyExtractor={(item) => item.id}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[
            styles.item,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.card,
              padding: spacing.md,
            },
          ]}
          testID={`song-${item.id}`}
          onPress={() => navigation.navigate('SongDetail', { song: item })}
        >
          {item.coverUrl ? (
            <Image
              source={{ uri: item.coverUrl }}
              style={[styles.cover, { borderRadius: radii.control }]}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View
              style={[
                styles.coverPlaceholder,
                { backgroundColor: colors.primaryTint, borderRadius: radii.control },
              ]}
            />
          )}
          <View style={styles.textColumn}>
            <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.artist, { color: colors.secondaryText }]}>
              {item.artist}
            </Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  message: { textAlign: 'center' },
  list: { padding: 16, gap: 10 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cover: { width: 52, height: 52 },
  coverPlaceholder: { width: 52, height: 52 },
  textColumn: { flex: 1, gap: 2 },
  title: { fontWeight: '600', fontSize: 15 },
  artist: { fontSize: 13 },
});
