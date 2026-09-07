import { useEffect, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { AudioPlayer } from './AudioPlayer';
import { isFavoriteSong, toggleFavoriteSong } from './favorites';

type Props = NativeStackScreenProps<RootStackParamList, 'SongDetail'>;

/**
 * Song detail + player -- Day 6 scope. Receives the full song object as a
 * route param (see AppNavigator.tsx's doc comment). Shows title/artist/
 * lyrics, the embedded AudioPlayer, and a local-only Favorite toggle
 * (favorites.ts -- AsyncStorage-backed, no cloud sync per Day 6 scope).
 */
export function SongDetailScreen({ route }: Props) {
  const { song } = route.params;
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void isFavoriteSong(song.id).then((value) => {
      if (!cancelled) setIsFavorite(value);
    });
    return () => {
      cancelled = true;
    };
  }, [song.id]);

  async function handleToggleFavorite() {
    const next = await toggleFavoriteSong(song.id);
    setIsFavorite(next);
  }

  return (
    <ScrollView contentContainerStyle={styles.container} testID="song-detail-screen">
      <Text style={styles.title}>{song.title}</Text>
      <Text style={styles.artist}>{song.artist}</Text>

      <Button
        title={isFavorite ? 'Unfavorite' : 'Favorite'}
        onPress={() => void handleToggleFavorite()}
        testID="favorite-button"
      />

      <AudioPlayer audioUrl={song.audioUrl} />

      <View style={styles.lyricsBox}>
        <Text style={styles.lyrics} testID="song-lyrics">
          {song.lyrics}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', padding: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  artist: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  lyricsBox: { width: '100%', paddingTop: 8 },
  lyrics: { fontSize: 15, lineHeight: 22, color: '#111827' },
});
