import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  NoticeBanner,
  Skeleton,
  useTheme,
} from '../../theme';
import { useTranslation } from '../../i18n';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { TopBar } from '../common/TopBar';
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
 * THE LOOK. A top bar -- Back, "Photos and videos", and the member's saved
 * posts at the right as a bookmark -- over posts that run edge to edge
 * (./MediaCard.tsx). A notice, when there is one, sits above the first post.
 * Waiting is a picture-shaped block and two lines, not a spinner; "loading more"
 * is a quiet line at the foot.
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
  const { colors, layout, type } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const interactions = useMediaInteractions();

  const [posts, setPosts] = useState<MediaPost[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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

  /**
   * M7: pull-to-refresh.
   *
   * Deliberately NOT the retry path above -- that one blanks the screen
   * to a spinner, which is right for "this failed, try again" and wrong
   * for "show me what is new". This one keeps the posts on screen behind
   * the platform's own refresh indicator and REPLACES the list when the
   * new first page arrives; merging would leave a post an administrator
   * has just unpublished sitting above the fold.
   */
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const page = await fetchMediaPage();
      if (!mountedRef.current) return;
      setPosts(page.posts);
      cursorRef.current = page.cursor;
      exhaustedRef.current = page.cursor === null;
      setStatus('ready');
    } catch (error) {
      // A failed refresh leaves what is already on screen alone: the
      // member asked for newer posts, not to lose the ones they had.
      console.warn('[media] could not refresh the feed:', error);
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
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

  const bar = (
    <View style={{ paddingHorizontal: layout.screenMargin }}>
      <TopBar
        title={t('community.goToMedia')}
        onBack={() => navigation.goBack()}
        trailing={
          <IconButton
            testID="media-saved-button"
            accessibilityLabel={t('media.savedTitle')}
            onPress={() => navigation.navigate('SavedMedia')}
          >
            <Icon name="bookmark" size={24} />
          </IconButton>
        }
      />
    </View>
  );

  const screen = (children: React.ReactNode) => (
    <View
      testID="media-screen"
      style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}
    >
      {bar}
      {children}
    </View>
  );

  if (status === 'loading') {
    return screen(
      <View
        testID="media-loading"
        accessibilityRole="progressbar"
        accessibilityLabel={t('common.loading')}
        accessibilityState={{ busy: true }}
      >
        {/* The shape of what is coming: a picture, then two lines. */}
        <View style={styles.skeletonPicture}>
          <Skeleton height={undefined} radius={0} />
        </View>
        <View style={styles.skeletonLines}>
          <Skeleton width="70%" height={16} />
          <Skeleton width="40%" height={13} />
        </View>
      </View>
    );
  }

  if (status === 'error') {
    return screen(
      <View style={[styles.state, { paddingHorizontal: layout.screenMargin }]}>
        <ErrorState
          testID="media-error"
          message={t('media.loadError')}
          retryLabel={t('common.tryAgain')}
          onRetry={retry}
        />
      </View>
    );
  }

  const noticeShown = signInNotice || interactions.actionFailed;

  return screen(
    <FlatList
      testID="media-feed"
      data={posts}
      keyExtractor={(post) => post.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refresh()}
          tintColor={colors.inkMuted}
        />
      }
      ListHeaderComponent={
        noticeShown ? (
          <View style={[styles.notice, { marginHorizontal: layout.screenMargin }]}>
            <NoticeBanner
              testID={
                interactions.actionFailed ? 'media-action-failed' : 'media-sign-in-notice'
              }
              tone={interactions.actionFailed ? 'danger' : 'neutral'}
              message={
                interactions.actionFailed
                  ? t('media.actionFailed')
                  : t('media.signInRequired')
              }
            />
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={{ paddingHorizontal: layout.screenMargin }}>
          <EmptyState
            testID="media-empty"
            title={t('media.empty')}
            message={t('media.emptyMessage')}
          />
        </View>
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
          <Text
            testID="media-loading-more"
            accessibilityRole="progressbar"
            accessibilityState={{ busy: true }}
            style={[type.caption, styles.more, { color: colors.inkMuted }]}
          >
            {t('media.loadingMore')}
          </Text>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { flexGrow: 1, paddingBottom: 40 },
  state: { marginTop: 8 },
  notice: { marginTop: 8, marginBottom: 12 },
  skeletonPicture: { aspectRatio: 4 / 3, marginTop: 8 },
  skeletonLines: { padding: 20, gap: 10 },
  more: { textAlign: 'center', paddingVertical: 18 },
});
