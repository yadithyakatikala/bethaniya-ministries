import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  EmptyState,
  ErrorState,
  Icon,
  NoticeBanner,
  SkeletonRows,
  Tappable,
  useTheme,
} from '../../theme';
import { fontFamilies } from '../../theme/tokens';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { usePreferences } from '../../context/PreferencesContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  fetchMediaPost,
  fetchSavedMedia,
  type SavedMedia,
} from '../../services/firebase/media';
import { TopBar } from '../common/TopBar';
import { posterFor } from './mediaUrl';
import { PlayMarker } from './MediaParts';

/** Why a saved post did not open: it is gone, or it could not be read right now. */
type OpenProblem = 'gone' | 'failed';

/**
 * The posts this member has bookmarked.
 *
 * THE LOOK. A top bar ("Saved media"), then rows between hairlines: a
 * 72-point rounded thumbnail (a small play marker on a video's), the caption
 * in up to three lines, a chevron.
 *
 * ONE QUERY, NOT ONE READ PER SAVE. A save carries a small copy of the
 * post -- its type, url and caption -- so this list renders from the
 * member's own subcollection without touching /media at all. See
 * ../../services/firebase/media.ts for why the copy exists and what it
 * costs (it can go stale if an administrator edits a caption).
 *
 * Opening one re-reads the REAL post, so the detail screen is never the
 * stale copy: a member who taps through sees what the post says now,
 * including a caption or verse that changed since they saved it. A post
 * that has since been deleted or unpublished simply cannot be opened, and
 * says so ("This post is no longer available.") rather than opening an
 * empty screen -- which is not the same as a failed read, and does not say
 * "could not load".
 */
export function SavedMediaScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, layout } = useTheme();
  const { t } = useTranslation();
  const { appLanguage } = usePreferences();
  const insets = useSafeAreaInsets();
  const { status, user } = useAuth();
  const uid = status === 'authenticated' ? (user?.uid ?? null) : null;

  const [saved, setSaved] = useState<SavedMedia[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openProblem, setOpenProblem] = useState<OpenProblem | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const mountedRef = useRef(true);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  // Same shape as MediaFeedScreen's loader: every setState happens after
  // an await, so the effect never sets state synchronously in its body.
  useEffect(() => {
    if (!uid) return undefined;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchSavedMedia(uid);
        if (!cancelled && mountedRef.current) setSaved(rows);
      } catch (error) {
        console.warn('[media] could not read your saved media:', error);
        if (!cancelled && mountedRef.current) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, reloadToken]);

  const retry = useCallback(() => {
    setFailed(false);
    setSaved(null);
    setReloadToken((token) => token + 1);
  }, []);

  async function open(id: string) {
    setOpenProblem(null);
    try {
      const post = await fetchMediaPost(id);
      if (!post) {
        // Deleted or unpublished since it was saved.
        setOpenProblem('gone');
        return;
      }
      navigation.navigate('MediaDetail', { post });
    } catch (error) {
      console.warn('[media] could not open that saved post:', error);
      setOpenProblem('failed');
    }
  }

  const screen = (children: React.ReactNode) => (
    <View
      testID="saved-media-screen"
      style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}
    >
      <View style={{ paddingHorizontal: layout.screenMargin }}>
        <TopBar title={t('media.savedTitle')} onBack={() => navigation.goBack()} />
      </View>
      {children}
    </View>
  );

  const pad = { paddingHorizontal: layout.screenMargin };

  if (!uid) {
    return screen(
      <View style={[styles.state, pad]}>
        <EmptyState
          testID="saved-media-signed-out"
          title={t('media.savedEmpty')}
          message={t('media.signInRequired')}
        />
      </View>
    );
  }

  if (failed) {
    return screen(
      <View style={[styles.state, pad]}>
        <ErrorState
          testID="saved-media-error"
          message={t('media.loadError')}
          retryLabel={t('common.tryAgain')}
          onRetry={retry}
        />
      </View>
    );
  }

  if (saved === null) {
    return screen(
      <View style={[styles.state, pad]}>
        <SkeletonRows
          count={3}
          leading="thumbnail"
          label={t('common.loading')}
          testID="saved-media-loading"
        />
      </View>
    );
  }

  return screen(
    <FlatList
      testID="saved-media-list"
      data={saved}
      keyExtractor={(row) => row.id}
      contentContainerStyle={[styles.list, pad]}
      ListHeaderComponent={
        openProblem ? (
          <View style={styles.notice}>
            <NoticeBanner
              testID="saved-media-open-failed"
              tone="danger"
              message={
                openProblem === 'gone' ? t('media.unavailable') : t('media.loadError')
              }
            />
          </View>
        ) : null
      }
      ListEmptyComponent={
        <EmptyState
          testID="saved-media-empty"
          title={t('media.savedEmpty')}
          message={t('media.savedEmptyMessage')}
        />
      }
      renderItem={({ item, index }) => (
        <Tappable
          testID={`saved-media-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={item.caption || t('media.openPost')}
          onPress={() => void open(item.id)}
          style={[
            styles.row,
            { borderBottomColor: colors.border },
            index === 0 && { borderTopColor: colors.border, borderTopWidth: 1 },
          ]}
        >
          <View style={styles.thumbFrame}>
            {posterFor(item) ? (
              <Image
                source={{ uri: posterFor(item) ?? undefined }}
                style={[styles.thumb, { backgroundColor: colors.surfaceRaised }]}
                accessibilityLabel={t('media.imageLabel')}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.thumb, { backgroundColor: colors.surfaceRaised }]} />
            )}
            {item.type === 'video' ? (
              <View style={styles.thumbPlay} pointerEvents="none">
                <PlayMarker
                  size={32}
                  testID={`saved-media-play-${item.id}`}
                  label={t('media.playVideo')}
                />
              </View>
            ) : null}
          </View>
          <Text
            style={[
              styles.caption,
              appLanguage === 'te' && styles.captionTe,
              { color: colors.ink },
            ]}
            numberOfLines={3}
          >
            {item.caption}
          </Text>
          <Icon name="chev" size={20} color={colors.inkSubtle} />
        </Tappable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  state: { marginTop: 8 },
  list: { flexGrow: 1, paddingTop: 12, paddingBottom: 32 },
  notice: { marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 96,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  thumbFrame: { width: 72, height: 72, borderRadius: 12, overflow: 'hidden' },
  thumb: { width: 72, height: 72 },
  thumbPlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    flex: 1,
    minWidth: 0,
    fontFamily: fontFamilies.interfaceRegular,
    fontSize: 15.5,
    lineHeight: 23,
  },
  captionTe: { lineHeight: 27 },
});
