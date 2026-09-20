import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { EmptyState } from '../../theme/ui/EmptyState';
import { ErrorState } from '../../theme/ui/ErrorState';
import { LoadingState } from '../../theme/ui/LoadingState';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  fetchMediaPage,
  type MediaCursor,
  type MediaPost,
} from '../../services/firebase/media';
import { MediaCard } from './MediaCard';
import { useMediaInteractions } from './useMediaInteractions';

/**
 * The media feed.
 *
 * =====================================================================
 * PAGINATED, NOT SUBSCRIBED
 * =====================================================================
 * A page at a time, fetched on demand, with no real-time listener. A
 * church feed does not need to rearrange itself under a member's thumb,
 * and a listener over a collection that only grows is a read every time
 * anything in it changes -- which on this project's free plan is the
 * daily budget spent on nothing anyone asked to see. The cost of opening
 * this screen is one page of documents and nothing else.
 *
 * The end of the feed is detected by a SHORT PAGE rather than by asking
 * again and getting nothing, so scrolling to the bottom costs no extra
 * read. See ../../services/firebase/media.ts.
 *
 * =====================================================================
 * SIGNED OUT IS A FIRST-CLASS STATE
 * =====================================================================
 * The feed renders in full without an account -- that is the point of
 * the public read rule. Like, comment and save then explain that signing
 * in is needed, once, in a notice at the top rather than as four
 * identical alerts. Sharing works either way.
 */
export function MediaFeedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, spacing, type } = useTheme();
  const { t } = useTranslation();
  const interactions = useMediaInteractions();

  const [posts, setPosts] = useState<MediaPost[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [signInNotice, setSignInNotice] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const cursorRef = useRef<MediaCursor | null>(null);
  const exhaustedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  // The first page is fetched by an effect keyed on `reloadToken`, and
  // every setState it performs happens AFTER an await -- an effect that
  // sets state synchronously in its body causes the cascading render the
  // hooks lint rule (rightly) rejects. Retrying bumps the token from the
  // button's own handler, which is an event rather than an effect.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const page = await fetchMediaPage();
        if (cancelled || !mountedRef.current) return;
        setPosts(page.posts);
        cursorRef.current = page.cursor;
        exhaustedRef.current = page.cursor === null;
        setStatus('ready');
      } catch (error) {
        console.warn('[media] could not load the feed:', error);
        if (!cancelled && mountedRef.current) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const retry = useCallback(() => {
    setStatus('loading');
    cursorRef.current = null;
    exhaustedRef.current = false;
    setReloadToken((token) => token + 1);
  }, []);

  const loadMore = useCallback(async () => {
    // Three guards, all necessary: FlatList fires onEndReached more than
    // once per scroll, there is nothing to ask for once the feed is
    // exhausted, and a second page must not be requested while the first
    // is still in flight.
    if (exhaustedRef.current || loadingMore || status !== 'ready') return;
    setLoadingMore(true);
    try {
      const page = await fetchMediaPage({ cursor: cursorRef.current });
      if (!mountedRef.current) return;
      setPosts((current) => [...current, ...page.posts]);
      cursorRef.current = page.cursor;
      exhaustedRef.current = page.cursor === null;
    } catch (error) {
      // A failed NEXT page is not a failed screen: what is already on
      // screen stays, and the member can scroll again to retry.
      console.warn('[media] could not load more media:', error);
    } finally {
      if (mountedRef.current) setLoadingMore(false);
    }
  }, [loadingMore, status]);

  /** Runs an action that needs an account, or explains why it did not. */
  function guarded(action: () => void) {
    if (!interactions.canInteract) {
      setSignInNotice(true);
      return;
    }
    action();
  }

  if (status === 'loading') {
    return <LoadingState label={t('common.loading')} testID="media-loading" />;
  }

  if (status === 'error') {
    return (
      <ErrorState
        testID="media-error"
        message={t('media.loadError')}
        retryLabel={t('common.tryAgain')}
        onRetry={retry}
      />
    );
  }

  return (
    <FlatList
      testID="media-feed"
      data={posts}
      keyExtractor={(post) => post.id}
      contentContainerStyle={[
        styles.list,
        { padding: spacing.md, gap: spacing.md, backgroundColor: colors.background },
      ]}
      ListHeaderComponent={
        signInNotice || interactions.actionFailed ? (
          <View
            testID={
              interactions.actionFailed ? 'media-action-failed' : 'media-sign-in-notice'
            }
            accessibilityLiveRegion="polite"
            style={[
              styles.notice,
              {
                backgroundColor: colors.surface,
                borderColor: interactions.actionFailed ? colors.danger : colors.border,
                padding: spacing.md,
              },
            ]}
          >
            <Text style={[type.bodySmall, { color: colors.ink }]}>
              {interactions.actionFailed
                ? t('media.actionFailed')
                : t('media.signInRequired')}
            </Text>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <EmptyState
          testID="media-empty"
          title={t('media.empty')}
          message={t('media.emptyMessage')}
        />
      }
      renderItem={({ item }) => (
        <MediaCard
          post={item}
          liked={interactions.likedIds.has(item.id)}
          saved={interactions.savedIds.has(item.id)}
          onOpen={() => navigation.navigate('MediaDetail', { post: item })}
          onLike={() => guarded(() => void interactions.toggleLike(item.id))}
          onSave={() => guarded(() => void interactions.toggleSave(item))}
          onShare={() => void interactions.share(item)}
          onComment={() =>
            // Commenting lives on the detail screen, so this opens it
            // rather than growing a second comment surface in the feed.
            guarded(() => navigation.navigate('MediaDetail', { post: item }))
          }
        />
      )}
      onEndReached={() => void loadMore()}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        loadingMore ? (
          <LoadingState
            compact
            label={t('media.loadingMore')}
            testID="media-loading-more"
          />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 1 },
  notice: { borderWidth: 1, borderRadius: 12, marginBottom: 12 },
});
