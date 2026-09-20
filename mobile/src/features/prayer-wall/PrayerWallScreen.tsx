import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { AppButton, EmptyState, ErrorState, LoadingState, useTheme } from '../../theme';
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
import {
  fetchReportedItemKeys,
  reportedItemKey,
} from '../../services/firebase/reports';
import { ReportSheet } from '../moderation/ReportSheet';
import { PrayerRequestCard } from './PrayerRequestCard';
import { PrayerRequestForm, type PrayerFormValues } from './PrayerRequestForm';

/**
 * The shared prayer wall -- M7.
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
 * Every setState below happens after an `await`, and every retry is
 * driven by a token bumped from an event handler, because an effect that
 * sets state in its body causes the cascading render the hooks lint rule
 * rejects -- the same shape ../media/MediaFeedScreen.tsx uses.
 */
export function PrayerWallScreen() {
  const { colors, spacing, type } = useTheme();
  const { t } = useTranslation();
  const { uid, displayName, canPost, suspended } = useMemberIdentity();

  const [requests, setRequests] = useState<PrayerRequest[]>([]);
  const [ownIds, setOwnIds] = useState<ReadonlySet<string>>(new Set());
  const [reportedKeys, setReportedKeys] = useState<ReadonlySet<string>>(new Set());
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<PrayerRequest | null>(null);
  const [reporting, setReporting] = useState<PrayerRequest | null>(null);
  const [actionFailed, setActionFailed] = useState(false);

  const cursorRef = useRef<PrayerRequestCursor | null>(null);
  const exhaustedRef = useRef(false);
  const mountedRef = useRef(true);

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
    // a second page must not be requested while the first is in flight.
    if (exhaustedRef.current || loadingMore || status !== 'ready') return;
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
      if (mountedRef.current) setLoadingMore(false);
    }
  }, [loadingMore, status]);

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

  function confirmDelete(request: PrayerRequest) {
    Alert.alert(
      t('prayerWall.deleteConfirmTitle'),
      t('prayerWall.deleteConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => void handleDelete(request),
        },
      ]
    );
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

  if (status === 'loading') {
    return <LoadingState label={t('common.loading')} testID="prayer-wall-loading" />;
  }

  if (status === 'error') {
    return (
      <ErrorState
        testID="prayer-wall-error"
        message={t('prayerWall.loadError')}
        retryLabel={t('common.tryAgain')}
        onRetry={retry}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }} testID="prayer-wall-screen">
      <FlatList
        testID="prayer-wall-list"
        data={requests}
        keyExtractor={(request) => request.id}
        contentContainerStyle={[
          styles.list,
          { padding: spacing.md, gap: spacing.md },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.inkMuted}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
            {suspended ? (
              <View
                testID="prayer-wall-suspended"
                accessibilityLiveRegion="polite"
                style={[
                  styles.notice,
                  { backgroundColor: colors.warningTint, padding: spacing.md },
                ]}
              >
                <Text style={[type.label, { color: colors.warning }]}>
                  {t('account.suspendedTitle')}
                </Text>
                <Text style={[type.bodySmall, { color: colors.warning }]}>
                  {t('account.suspendedMessage')}
                </Text>
              </View>
            ) : null}
            {actionFailed ? (
              <View
                testID="prayer-wall-action-failed"
                accessibilityLiveRegion="polite"
                style={[
                  styles.notice,
                  { backgroundColor: colors.dangerTint, padding: spacing.md },
                ]}
              >
                <Text style={[type.bodySmall, { color: colors.danger }]}>
                  {t('media.actionFailed')}
                </Text>
              </View>
            ) : null}
            <AppButton
              title={t('prayerWall.newRequest')}
              onPress={() => {
                setEditing(null);
                setComposing(true);
              }}
              disabled={!canPost}
              testID="prayer-wall-compose"
            />
            {!uid ? (
              <Text style={[type.bodySmall, { color: colors.inkMuted }]}>
                {t('prayerWall.signInRequired')}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            testID="prayer-wall-empty"
            title={t('prayerWall.empty')}
            message={t('prayerWall.emptyMessage')}
          />
        }
        renderItem={({ item }) => (
          <PrayerRequestCard
            request={item}
            isOwn={ownIds.has(item.id)}
            alreadyReported={reportedKeys.has(reportedItemKey('prayer_request', item.id))}
            onEdit={() => {
              setEditing(item);
              setComposing(true);
            }}
            onToggleAnswered={() => void handleToggleAnswered(item)}
            onDelete={() => confirmDelete(item)}
            onReport={() => setReporting(item)}
          />
        )}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <LoadingState
              compact
              label={t('prayerWall.loadingMore')}
              testID="prayer-wall-loading-more"
            />
          ) : null
        }
      />

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
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 1 },
  notice: { borderRadius: 12, gap: 4 },
});
