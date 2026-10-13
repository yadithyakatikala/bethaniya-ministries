import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { AppButton, contentTextStyle, scriptOf, useTheme } from '../../theme';
import { fontFamilies } from '../../theme/tokens';
import { useTranslation } from '../../i18n';
import { TopBar } from '../common/TopBar';
import { AudioPlayer } from './AudioPlayer';
import { SongCover } from './SongCover';
import { isFavoriteSong, toggleFavoriteSong } from './favorites';

type Props = NativeStackScreenProps<RootStackParamList, 'SongDetail'>;

/**
 * Song detail + player -- Day 6 scope. Receives the full song object as a
 * route param (see AppNavigator.tsx's doc comment). Shows the cover, title and
 * artist, a Favourite pill, the embedded AudioPlayer and the lyrics, with a
 * local-only favourite (favorites.ts -- AsyncStorage-backed, no cloud sync per
 * Day 6 scope).
 *
 * THE LOOK. A top bar with Back; the cover at 196 (a quiet tile with a note
 * when the church attached none); the title in the serif of its script (the
 * design's rule S5) with the artist under it in the muted interface face, both
 * centred; the Favourite pill; the player; then "Lyrics" and the words at
 * 17/29, a blank line being a new stanza.
 *
 * The Favourite pill says its state in words and in its look, never in colour
 * alone: chosen it is the ink fill with a filled heart and "Favourited"; not
 * chosen it is the outlined pill with an open heart and "Favourite". Gold is
 * never a fill, so it is never this button's. Same testID/behavior contract as
 * before -- see SongDetailScreen.test.tsx.
 */
export function SongDetailScreen({ navigation, route }: Props) {
  const { song } = route.params;
  const { colors, layout, type } = useTheme();
  const { t, appLanguage } = useTranslation();
  const insets = useSafeAreaInsets();
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isFavoriteSong(song.id).then(
      (value) => {
        if (!cancelled) setIsFavorite(value);
      },
      // Storage that cannot be read leaves the heart open.
      () => undefined
    );
    return () => {
      cancelled = true;
    };
  }, [song.id]);

  async function handleToggleFavorite() {
    try {
      setIsFavorite(await toggleFavoriteSong(song.id));
    } catch {
      // Storage that cannot be written changes nothing: the pill stays as it was.
    }
  }

  const stanzas = song.lyrics
    .split(/\n{2,}/)
    .map((stanza) => stanza.trim())
    .filter((stanza) => stanza.length > 0);
  const telugu = (text: string) =>
    appLanguage === 'te' || ['telugu', 'mixed'].includes(scriptOf(text));

  return (
    <ScrollView
      testID="song-detail-screen"
      style={{ backgroundColor: colors.paper }}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: layout.screenMargin,
        },
      ]}
    >
      <TopBar onBack={() => navigation.goBack()} />

      <View style={styles.cover}>
        <SongCover
          testID="song-cover"
          uri={song.coverUrl}
          size={196}
          radius={16}
          glyphSize={44}
        />
      </View>

      <View style={styles.head}>
        <Text
          accessibilityRole="header"
          testID="song-title"
          style={[
            contentTextStyle(song.title, {
              size: 24,
              line: 31,
              teSize: 23,
              teLine: 36,
              weight: 'semiBold',
              fallback: appLanguage,
            }),
            styles.title,
            { color: colors.ink },
          ]}
        >
          {song.title}
        </Text>
        <Text
          testID="song-artist"
          style={[
            styles.artist,
            telugu(song.artist) && styles.artistTe,
            { color: colors.inkMuted },
          ]}
        >
          {song.artist}
        </Text>
      </View>

      <View style={styles.favourite}>
        <AppButton
          testID="favorite-button"
          title={t(isFavorite ? 'songs.favoritedState' : 'songs.favoriteAction')}
          variant={isFavorite ? 'primary' : 'secondary'}
          compact
          leadingIcon={isFavorite ? 'heartf' : 'heart'}
          onPress={() => void handleToggleFavorite()}
          // The spoken name is the visible word (a voice-control user says what
          // they see); `selected` carries the state and the hint what pressing does.
          accessibilityHint={t(isFavorite ? 'songs.unfavorite' : 'songs.favorite')}
          accessibilityState={{ selected: isFavorite }}
        />
      </View>

      <View style={styles.player}>
        <AudioPlayer audioUrl={song.audioUrl} />
      </View>

      {stanzas.length > 0 ? (
        <View style={styles.lyrics}>
          <Text style={[type.overline, { color: colors.inkMuted }]}>
            {t('songs.lyrics')}
          </Text>
          <View testID="song-lyrics" style={styles.stanzas}>
            {stanzas.map((stanza, index) => (
              <Text
                key={index}
                style={[
                  styles.stanza,
                  telugu(stanza) && styles.stanzaTe,
                  { color: colors.ink },
                ]}
              >
                {stanza}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1 },
  cover: { alignSelf: 'center', marginTop: 6 },
  head: { alignItems: 'center', marginTop: 18, gap: 2 },
  title: { textAlign: 'center' },
  artist: {
    fontFamily: fontFamilies.interfaceRegular,
    fontSize: 14.5,
    lineHeight: 20,
    textAlign: 'center',
  },
  artistTe: { lineHeight: 24 },
  favourite: { alignItems: 'center', marginTop: 14 },
  player: { marginTop: 20 },
  lyrics: { marginTop: 24, gap: 10 },
  stanzas: { gap: 16 },
  stanza: {
    fontFamily: fontFamilies.interfaceRegular,
    fontSize: 17,
    lineHeight: 29,
  },
  stanzaTe: { lineHeight: 33 },
});
