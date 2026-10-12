import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import {
  Chip,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FloatingAction,
  NoticeBanner,
  SkeletonRows,
  Toast,
  useTheme,
  useToast,
} from '../../theme';
import { fontFamilies } from '../../theme/tokens';
import { useTranslation } from '../../i18n';
import { useMemberIdentity } from '../../context/useMemberIdentity';
import {
  createPrayerRequest,
  deleteOwnPrayerRequest,
  fetchOwnPrayerRequestIds,
  fetchPrayerRequestPage,
  setPrayerRequestStatus,
  updatePrayerRequest,
  type PrayerRequest,
  type PrayerRequestCursor,
} from '../../services/firebase/prayerRequests';
import { fetchReportedItemKeys, reportedItemKey } from '../../services/firebase/reports';
import { ReportSheet } from '../moderation/ReportSheet';
import { PrayerRequestRow } from './PrayerRequestRow';
import { PrayerRequestForm, type PrayerFormValues } from './PrayerRequestForm';

/**
 * The most pages "Yours" will read looking for the member's own requests
 * (15 a page): a member with an orphaned index entry must not walk the whole wall.
 */
const MAX_PAGES_FOR_OWN = 10;

type Filter = 'all' | 'yours';

/**
 * The shared prayer wall -- M7, as the first view of the Prayers tab.
 *
 * =====================================================================
 * PAGINATED AND PULLED, NOT SUBSCRIBED
 * =====================================================================
 * The same decision, for the same reason, as ../media/MediaFeedScreen:
 * a listener over a collection that only grows costs a read every time
 * anything in it changes. A prayer wall is read and then left, so it is
 * pages on demand plus pull-to-refresh, and the end of the list is
 * detected by a short page rather than by an extra empty read.
 *
 * The group chat is the one place in this app that does subscribe, and
 * ../../services/firebase/communityChat.ts says why it is different.
 *
 * =====================================================================
 * KNOWING WHICH REQUESTS ARE YOURS
 * =====================================================================
 * An anonymous request carries nothing that identifies its author, on
 * purpose -- so "is this mine?" cannot be answered by looking at the
 * request. It is answered by the member's own index at
 * users/{uid}/prayerRequests, read ONCE for the whole screen. See
 * ../../services/firebase/prayerRequests.ts.
 *
 * That index is also what the "Yours" chip is built on: it shows the
 * member's requests among those loaded, and choosing it reads further
 * pages until every request in the index has turned up (or the wall
 * ends, or MAX_PAGES_FOR_OWN pages have been read) -- a skeleton, not a
 * false "you have not asked yet", is what is shown while it looks.
 *
 * =====================================================================
 * THE LAYOUT
 * =====================================================================
 * One list. The hub's title and tabs (`header`), the All | Yours chips,
 * the notices and every state (loading, error, empty) are the list's
 * HEADER, so they scroll away with it as the design draws them, and the
 * title and tabs are there in every state. "Ask for prayer" floats over
 * the list, except where a state carries its own button (empty) or has
 * nothing yet to add to (loading, error); it is disabled, and the
 * suspended notice says why, for a member whose posting is paused. A
 * confirmation ("Your request was shared") is a toast. Deleting asks
 * first, in the app's own dialog.
 *
 * Every setState below happens after an `await`, and every retry is
 * driven by a token bumped from an event handler, because an effect that
 * sets state in its body causes the cascading render the hooks lint rule
 * rejects -- the same shape ../media/MediaFeedScreen.tsx uses.
 */
export function PrayerWallScreen({ header }: { header?: ReactNode }) {
  const { colors, layout, type } = useTheme();
  const { t } = useTranslation();
  const { uid, displayName, canPost, suspended } = useMemberIdentity();
  const toast = useToast();

  const [requests, setRequests] = useState<PrayerRequest[]>([]);
  const [ownIds, setOwnIds] = useState<ReadonlySet<string>>(new Set());
  const [reportedKeys, setReportedKeys] = useState<ReadonlySet<string>>(new Set());
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchingOwn, setSearchingOwn] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<PrayerRequest | null>(null);
  const [reporting, setReporting] = useState<PrayerRequest | null>(null);
  const [deleting, setDeleting] = useState<PrayerRequest | null>(null);
  const [actionFailed, setActionFailed] = useState(false);

  const cursorRef = useRef<PrayerRequestCursor | null>(null);
  const exhaustedRef = useRef(false);
  const mountedRef = useRef(true);
  /** One page request at a time, whoever asks: scrolling, or the "Yours" chip. */
  const pagingRef = useRef(false);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // The member's own index and their report markers are fetched
        // alongside the first page, not per row: three reads for the
        // whole screen rather than three per request.
        const [page, own, reported] = await Promise.all([
          fetchPrayerRequestPage(),
          uid ? fetchOwnPrayerRequestIds(uid) : Promise.resolve(new Set<string>()),
          uid ? fetchReportedItemKeys(uid) : Promise.resolve(new Set<string>()),
        ]);
        if (cancelled || !mountedRef.current) return;
        setRequests(page.requests);
        setOwnIds(own);
        setReportedKeys(reported);
        cursorRef.current = page.cursor;
        exhaustedRef.current = page.cursor === null;
        setStatus('ready');
      } catch (error) {
        console.warn('[prayerWall] could not load requests:', error);
        if (!cancelled && mountedRef.current) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken, uid]);

  const reload = useCallback(() => {
    cursorRef.current = null;
    exhaustedRef.current = false;
    setReloadToken((token) => token + 1);
  }, []);

  const retry = useCallback(() => {
    setStatus('loading');
    reload();
  }, [reload]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const page = await fetchPrayerRequestPage();
      if (!mountedRef.current) return;
      // REPLACED, not merged: a pull-to-refresh means "show me the top of
      // the list as it is now", and merging would leave a request an
      // administrator has just removed sitting above the fold.
      setRequests(page.requests);
      cursorRef.current = page.cursor;
      exhaustedRef.current = page.cursor === null;
      setStatus('ready');
    } catch (error) {
      console.warn('[prayerWall] could not refresh:', error);
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    // Three guards: FlatList fires onEndReached more than once per
    // scroll, there is nothing to ask for once the list is exhausted, and
    // a second page must not be requested while another is in flight.
    if (exhaustedRef.current || pagingRef.current || status !== 'ready') return;
    pagingRef.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchPrayerRequestPage({ cursor: cursorRef.current });
      if (!mountedRef.current) return;
      setRequests((current) => [...current, ...page.requests]);
      cursorRef.current = page.cursor;
      exhaustedRef.current = page.cursor === null;
    } catch (error) {
      // A failed NEXT page is not a failed screen.
      console.warn('[prayerWall] could not load more:', error);
    } finally {
      pagingRef.current = false;
      if (mountedRef.current) setLoadingMore(false);
    }
  }, [status]);

  /**
   * Choosing "Yours": reads further pages until every request in the
   * member's own index has been loaded, the wall ends, or the cap is hit.
   */
  async function chooseFilter(next: Filter) {
    setFilter(next);
    if (next !== 'yours' || status !== 'ready' || pagingRef.current) return;
    const loaded = new Set(requests.map((request) => request.id));
    const missing = () => [...ownIds].some((id) => !loaded.has(id));
    if (exhaustedRef.current || !missing()) return;

    pagingRef.current = true;
    setSearchingOwn(true);
    try {
      let pages = 0;
      while (!exhaustedRef.current && missing() && pages < MAX_PAGES_FOR_OWN) {
        const page = await fetchPrayerRequestPage({ cursor: cursorRef.current });
        if (!mountedRef.current) return;
        setRequests((current) => [...current, ...page.requests]);
        for (const request of page.requests) loaded.add(request.id);
        cursorRef.current = page.cursor;
        exhaustedRef.current = page.cursor === null;
        pages += 1;
      }
    } catch (error) {
      console.warn('[prayerWall] could not look for your requests:', error);
    } finally {
      pagingRef.current = false;
      if (mountedRef.current) setSearchingOwn(false);
    }
  }

  async function handleSubmit(values: PrayerFormValues) {
    if (!uid) return;
    setActionFailed(false);
    if (editing) {
      await updatePrayerRequest(editing.id, {
        title: values.title,
        body: values.body,
        category: values.category,
        status: editing.status,
      });
      setEditing(null);
    } else {
      await createPrayerRequest({
        uid,
        authorName: displayName,
        title: values.title,
        body: values.body,
        category: values.category,
        anonymous: values.anonymous,
      });
      toast.show(t('prayers.shared'));
    }
    // Reloaded rather than spliced in locally: the new request's
    // createdAt comes from the server, so the list's own order is the
    // only thing that knows where it belongs.
    reload();
  }

  async function handleToggleAnswered(request: PrayerRequest) {
    setActionFailed(false);
    try {
      const next = request.status === 'answered' ? 'open' : 'answered';
      await setPrayerRequestStatus(request.id, next);
      if (!mountedRef.current) return;
      setRequests((current) =>
        current.map((item) => (item.id === request.id ? { ...item, status: next } : item))
      );
    } catch (error) {
      console.warn('[prayerWall] could not change status:', error);
      if (mountedRef.current) setActionFailed(true);
    }
  }

  async function handleDelete(request: PrayerRequest) {
    if (!uid) return;
    setActionFailed(false);
    try {
      await deleteOwnPrayerRequest(uid, request.id);
      if (!mountedRef.current) return;
      setRequests((current) => current.filter((item) => item.id !== request.id));
      setOwnIds((current) => {
        const next = new Set(current);
        next.delete(request.id);
        return next;
      });
    } catch (error) {
      console.warn('[prayerWall] could not delete:', error);
      if (mountedRef.current) setActionFailed(true);
    }
  }

  function openComposer() {
    setEditing(null);
    setComposing(true);
  }

  const pad = { paddingHorizontal: layout.screenMargin };
  const ready = status === 'ready';
  const visible =
    filter === 'yours' ? requests.filter((r) => ownIds.has(r.id)) : requests;
  const rows = ready ? visible : [];
  const emptyAll = ready && filter === 'all' && requests.length === 0;
  const emptyYours = ready && filter === 'yours' && visible.length === 0 && !searchingOwn;
  // A state that carries its own "Ask for prayer", or has nothing yet to add to, has no floating one.
  const showFab = ready && visible.length > 0;

  return (
    <View style={styles.screen} testID="prayer-wall-screen">
      <FlatList
        testID="prayer-wall-list"
        data={rows}
        keyExtractor={(request) => request.id}
        contentContainerStyle={styles.list}
        // The tabs and chips are on the list; a tap on a row action while a
        // field elsewhere holds focus must not only dismiss the keyboard.
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.inkMuted}
          />
        }
        ListHeaderComponent={
          <View>
            {header ? <View style={pad}>{header}</View> : null}

            <View style={[pad, styles.chips]}>
              <Chip
                testID="prayer-wall-filter-all"
                label={t('prayers.filterAll')}
                selected={filter === 'all'}
                onPress={() => void chooseFilter('all')}
              />
              <Chip
                testID="prayer-wall-filter-yours"
                label={t('prayers.filterYours')}
                selected={filter === 'yours'}
                onPress={() => void chooseFilter('yours')}
              />
            </View>

            <View style={[pad, styles.body]}>
              {suspended ? (
                <NoticeBanner
                  tone="warning"
                  testID="prayer-wall-suspended"
                  title={t('account.suspendedTitle')}
                  message={t('account.suspendedMessage')}
                />
              ) : null}
              {actionFailed ? (
                <NoticeBanner
                  tone="danger"
                  testID="prayer-wall-action-failed"
                  message={t('media.actionFailed')}
                />
              ) : null}
              {!uid ? (
                <Text style={[type.help, { color: colors.inkMuted }]}>
                  {t('prayerWall.signInRequired')}
                </Text>
              ) : null}

              {status === 'loading' || searchingOwn ? (
                <SkeletonRows
                  count={3}
                  leading="none"
                  label={t('common.loading')}
                  testID="prayer-wall-loading"
                />
              ) : null}
              {status === 'error' ? (
                <ErrorState
                  testID="prayer-wall-error"
                  title={t('prayerWall.loadError')}
                  message={t('prayerWall.loadErrorMessage')}
                  retryLabel={t('common.tryAgain')}
                  onRetry={retry}
                />
              ) : null}
              {emptyAll ? (
                <EmptyState
                  testID="prayer-wall-empty"
                  title={t('prayerWall.empty')}
                  message={t('prayerWall.emptyMessage')}
                  actionLabel={canPost ? t('prayerWall.newRequest') : undefined}
                  onAction={openComposer}
                  actionTestID="prayer-wall-compose"
                />
              ) : null}
              {emptyYours ? (
                <EmptyState
                  testID="prayer-wall-no-own"
                  title={t('prayers.noOwn')}
                  message={t('prayers.noOwnMessage')}
                  actionLabel={canPost ? t('prayerWall.newRequest') : undefined}
                  onAction={openComposer}
                  actionTestID="prayer-wall-compose"
                />
              ) : null}
              {rows.length > 0 ? (
                <View style={[styles.rule, { borderTopColor: colors.border }]} />
              ) : null}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={pad}>
            <PrayerRequestRow
              request={item}
              isOwn={ownIds.has(item.id)}
              alreadyReported={reportedKeys.has(
                reportedItemKey('prayer_request', item.id)
              )}
              onEdit={() => {
                setEditing(item);
                setComposing(true);
              }}
              onToggleAnswered={() => void handleToggleAnswered(item)}
              onDelete={() => setDeleting(item)}
              onReport={() => setReporting(item)}
            />
          </View>
        )}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <Text
              testID="prayer-wall-loading-more"
              accessibilityLiveRegion="polite"
              style={[styles.more, { color: colors.inkMuted }]}
            >
              {t('prayerWall.loadingMore')}
            </Text>
          ) : null
        }
      />

      {showFab ? (
        <FloatingAction
          testID="prayer-wall-compose"
          label={t('prayerWall.newRequest')}
          disabled={!canPost}
          onPress={openComposer}
        />
      ) : null}

      <Toast message={toast.message} />

      {composing ? (
        <PrayerRequestForm
          visible
          editing={editing}
          onClose={() => {
            setComposing(false);
            setEditing(null);
          }}
          onSubmit={handleSubmit}
        />
      ) : null}

      {reporting ? (
        <ReportSheet
          visible
          targetType="prayer_request"
          targetId={reporting.id}
          onClose={() => setReporting(null)}
          onReported={() =>
            setReportedKeys((current) => {
              const next = new Set(current);
              next.add(reportedItemKey('prayer_request', reporting.id));
              return next;
            })
          }
          testID="prayer-wall-report"
        />
      ) : null}

      <ConfirmDialog
        visible={deleting !== null}
        testID="prayer-wall-delete-dialog"
        title={t('prayerWall.deleteConfirmTitle')}
        message={t('prayerWall.deleteConfirmMessage')}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('common.delete')}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const request = deleting;
          setDeleting(null);
          if (request) void handleDelete(request);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // Room under the last row for the floating button.
  list: { flexGrow: 1, paddingBottom: 96 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 14 },
  body: { marginTop: 8, gap: 12 },
  rule: { borderTopWidth: 1 },
  more: {
    paddingVertical: 18,
    textAlign: 'center',
    fontFamily: fontFamilies.interfaceMedium,
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 18,
  },
});
