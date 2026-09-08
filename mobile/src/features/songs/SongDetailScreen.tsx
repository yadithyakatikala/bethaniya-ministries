import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useTheme } from '../../theme';
import { AudioPlayer } from './AudioPlayer';
import { isFavoriteSong, toggleFavoriteSong } from './favorites';

type Props = NativeStackScreenProps<RootStackParamList, 'SongDetail'>;

/**
 * Song detail + player -- Day 6 scope. Receives the full song object as a
 * route param (see AppNavigator.tsx's doc comment). Shows title/artist/
 * lyrics, the embedded AudioPlayer, and a local-only Favorite toggle
 * (favorites.ts -- AsyncStorage-backed, no cloud sync per Day 6 scope).
 *
 * Restyled onto the shared Vespers theme: artwork-led hero (real
 * `coverUrl` when the song has one, a themed placeholder otherwise), the
 * favorite toggle as a state-and-label pill (never colour-only) rather
 * than a bare platform Button, and a proper lyrics card. Same testID/
 * behavior contract as before -- see SongDetailScreen.test.tsx.
 */
export function SongDetailScreen({ route }: Props) {
  const { song } = route.params;
  const { colors, radii, spacing } = useTheme();
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
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      testID="song-detail-screen"
    >
      {song.coverUrl ? (
        <Image
          source={{ uri: song.coverUrl }}
          style={[styles.cover, { borderRadius: radii.card }]}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View
          style={[
            styles.coverPlaceholder,
            { backgroundColor: colors.primaryTint, borderRadius: radii.card },
          ]}
        />
      )}

      <View style={styles.titleBlock}>
        <Text style={[styles.title, { color: colors.text }]}>{song.title}</Text>
        <Text style={[styles.artist, { color: colors.secondaryText }]}>
          {song.artist}
        </Text>
      </View>

      <Pressable
        testID="favorite-button"
        accessibilityRole="button"
        accessibilityState={{ selected: isFavorite }}
        onPress={() => void handleToggleFavorite()}
        style={[
          styles.favoriteButton,
          {
            borderRadius: radii.control,
            backgroundColor: isFavorite ? colors.accent : 'transparent',
            borderColor: colors.accent,
          },
        ]}
      >
        <Text
          style={[
            styles.favoriteLabel,
            { color: isFavorite ? '#FFFFFF' : colors.accent },
          ]}
        >
          {isFavorite ? 'Favorited' : 'Favorite'}
        </Text>
      </Pressable>

      <AudioPlayer audioUrl={song.audioUrl} />

      <View
        style={[
          styles.lyricsBox,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radii.card,
            padding: spacing.lg,
          },
        ]}
      >
        <Text style={[styles.lyrics, { color: colors.text }]} testID="song-lyrics">
          {song.lyrics}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', padding: 20, gap: 16 },
  cover: { width: 180, height: 180 },
  coverPlaceholder: { width: 180, height: 180 },
  titleBlock: { alignItems: 'center', gap: 2 },
  title: { fontSize: 22, fontWeight: '600', textAlign: 'center' },
  artist: { fontSize: 14, textAlign: 'center' },
  favoriteButton: {
    minHeight: 40,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteLabel: { fontSize: 14, fontWeight: '600' },
  lyricsBox: { width: '100%', borderWidth: StyleSheet.hairlineWidth },
  lyrics: { fontSize: 16, lineHeight: 25 },
});
