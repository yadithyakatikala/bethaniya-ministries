import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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

type Props = NativeStackScreenProps<RootStackParamList, 'SongsList'>;

/**
 * Published-songs list -- Day 6 scope. Real-time listener +
 * loading/error/empty/list states, same shape as AnnouncementsList.tsx.
 * Tapping a song navigates to SongDetail, passing the full song object
 * as a route param (see AppNavigator.tsx's doc comment for why).
 */
export function SongsListScreen({ navigation }: Props) {
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
      <View style={styles.container} testID="songs-error">
        <Text style={styles.message}>Could not load songs.</Text>
      </View>
    );
  }

  if (!songs) {
    return (
      <View style={styles.container} testID="songs-loading">
        <ActivityIndicator />
      </View>
    );
  }

  if (songs.length === 0) {
    return (
      <View style={styles.container} testID="songs-empty">
        <Text style={styles.message}>No songs yet.</Text>
      </View>
    );
  }

  return (
    <FlatList
      testID="songs-list"
      data={songs}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.item}
          testID={`song-${item.id}`}
          onPress={() => navigation.navigate('SongDetail', { song: item })}
        >
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.artist}>{item.artist}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  message: { color: '#666', textAlign: 'center' },
  list: { padding: 16, gap: 12 },
  item: {
    padding: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    gap: 4,
  },
  title: { fontWeight: '600', fontSize: 15 },
  artist: { color: '#374151', fontSize: 13 },
});
