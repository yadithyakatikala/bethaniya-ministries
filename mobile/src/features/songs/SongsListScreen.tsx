import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  subscribeToPublishedSongs,
  type PublishedSong,
} from '../../services/firebase/songs';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  Chip,
  EmptyState,
  ErrorState,
  Icon,
  SkeletonRows,
  Tappable,
  scriptOf,
  useTheme,
} from '../../theme';
import { fontFamilies } from '../../theme/tokens';
import { useTranslation } from '../../i18n';
import { TopBar } from '../common/TopBar';
import { SongCover } from './SongCover';
import { subscribeToFavoriteSongs } from './favorites';

type Props = NativeStackScreenProps<RootStackParamList, 'SongsList'>;

type Filter = 'all' | 'favourites';

/**
 * The church's published songs, one hairline row each: the cover (56, or a
 * quiet tile with a note), the title and who it is by, a filled heart if the
 * member has favourited it, and a chevron. Under a top bar, two chips -- All
 * and Favourites -- choose what is listed.
 *
 * Real-time listener, with loading / error / empty / list states. The
 * favourites are the member's own, kept on this phone (./favorites.ts), and
 * the list hears of a change made on a song's page while it waits underneath,
 * so the hearts and the Favourites chip are always current when the member
 * comes back. Choosing Favourites with none shows its own empty page, which
 * says how to add one -- never the church's "No songs yet".
 *
 * Tapping a song opens SongDetail, passing the full song as a route param
 * (see AppNavigator.tsx's doc comment for why).
 */
export function SongsListScreen({ navigation }: Props) {
  const { colors, layout } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [songs, setSongs] = useState<PublishedSong[] | null>(null);
  const [hasError, setHasError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [favourites, setFavourites] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => subscribeToFavoriteSongs(setFavourites), []);

  useEffect(() => {
    const unsubscribe = subscribeToPublishedSongs(
      (next) => {
        setSongs(next);
        setHasError(false);
      },
      () => setHasError(true)
    );
    return unsubscribe;
  }, [retryToken]);

  function retry() {
    setHasError(false);
    setSongs(null);
    setRetryToken((token) => token + 1);
  }

  const visible = useMemo(
    () =>
      filter === 'favourites'
        ? (songs ?? []).filter((song) => favourites.has(song.id))
        : (songs ?? []),
    [songs, filter, favourites]
  );

  const pad = { paddingHorizontal: layout.screenMargin };
  const loading = !songs && !hasError;

  return (
    <View
      testID="songs-screen"
      style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}
    >
      <View style={pad}>
        <TopBar title={t('songs.title')} onBack={() => navigation.goBack()} />
        <View style={styles.chips}>
          <Chip
            testID="songs-filter-all"
            label={t('songs.filterAll')}
            selected={filter === 'all'}
            onPress={() => setFilter('all')}
          />
          <Chip
            testID="songs-filter-favourites"
            label={t('songs.filterFavourites')}
            selected={filter === 'favourites'}
            onPress={() => setFilter('favourites')}
          />
        </View>
      </View>

      {hasError ? (
        <View style={[pad, styles.state]}>
          <ErrorState
            testID="songs-error"
            message={t('songs.loadError')}
            retryLabel={t('common.tryAgain')}
            onRetry={retry}
          />
        </View>
      ) : loading ? (
        <View style={[pad, styles.state]}>
          <SkeletonRows
            count={3}
            leading="thumbnail"
            label={t('common.loading')}
            testID="songs-loading"
          />
        </View>
      ) : songs && songs.length === 0 ? (
        <View style={[pad, styles.state]}>
          <EmptyState
            testID="songs-empty"
            title={t('songs.empty')}
            message={t('songs.emptyMessage')}
          />
        </View>
      ) : visible.length === 0 ? (
        <View style={[pad, styles.state]}>
          <EmptyState
            testID="songs-no-favourites"
            title={t('songs.noFavourites')}
            message={t('songs.noFavouritesMessage')}
          />
        </View>
      ) : (
        <FlatList
          testID="songs-list"
          data={visible}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={[pad, { paddingBottom: insets.bottom + 24 }]}
          ListHeaderComponent={
            <View style={[styles.rule, { borderTopColor: colors.border }]} />
          }
          renderItem={({ item }) => (
            <SongRow
              song={item}
              favourite={favourites.has(item.id)}
              onPress={() => navigation.navigate('SongDetail', { song: item })}
            />
          )}
        />
      )}
    </View>
  );
}

function SongRow({
  song,
  favourite,
  onPress,
}: {
  song: PublishedSong;
  favourite: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const { t, appLanguage } = useTranslation();
  // Telugu stacks marks above and below a letter and needs the room, whatever
  // language the interface is in -- a Telugu title can sit in an English app.
  const telugu = (text: string) =>
    appLanguage === 'te' || ['telugu', 'mixed'].includes(scriptOf(text));

  return (
    <Tappable
      testID={`song-${song.id}`}
      accessibilityRole="button"
      accessibilityLabel={[
        song.title,
        song.artist,
        favourite ? t('songs.favoritedState') : '',
      ]
        .filter(Boolean)
        .join('. ')}
      onPress={onPress}
      style={[styles.row, { borderBottomColor: colors.border }]}
    >
      <SongCover
        testID={`song-${song.id}-cover`}
        uri={song.coverUrl}
        size={56}
        radius={12}
        glyphSize={22}
      />
      <View style={styles.text}>
        <Text
          numberOfLines={2}
          style={[
            styles.title,
            telugu(song.title) && styles.titleTe,
            { color: colors.ink },
          ]}
        >
          {song.title}
        </Text>
        <Text
          numberOfLines={1}
          style={[
            styles.artist,
            telugu(song.artist) && styles.artistTe,
            { color: colors.inkMuted },
          ]}
        >
          {song.artist}
        </Text>
      </View>
      {favourite ? (
        <View testID={`song-${song.id}-favourite`}>
          <Icon name="heartf" size={20} color={colors.ink} />
        </View>
      ) : null}
      <Icon name="chev" size={20} color={colors.inkSubtle} />
    </Tappable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 4 },
  state: { marginTop: 12 },
  list: { marginTop: 12 },
  rule: { borderTopWidth: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 80,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  text: { flex: 1, minWidth: 0, gap: 1 },
  title: {
    fontFamily: fontFamilies.interfaceSemiBold,
    fontWeight: '600',
    fontSize: 16.5,
    lineHeight: 23,
  },
  titleTe: { lineHeight: 28 },
  artist: {
    fontFamily: fontFamilies.interfaceRegular,
    fontSize: 13.5,
    lineHeight: 19,
  },
  artistTe: { lineHeight: 23 },
});
