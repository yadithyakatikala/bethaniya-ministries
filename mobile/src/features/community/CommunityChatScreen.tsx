import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AppButton,
  EmptyState,
  ErrorState,
  LoadingState,
  Tappable,
  useTheme,
} from '../../theme';
import { useTranslation } from '../../i18n';
import { useMemberIdentity } from '../../context/useMemberIdentity';
import {
  MAX_MESSAGE_LENGTH,
  deleteOwnMessage,
  fetchOlderMessages,
  mergeMessages,
  sendMessage,
  subscribeToRecentMessages,
  type CommunityMessage,
  type MessageCursor,
} from '../../services/firebase/communityChat';
import {
  fetchReportedItemKeys,
  reportedItemKey,
} from '../../services/firebase/reports';
import { ReportSheet } from '../moderation/ReportSheet';
import { ChatMessageBubble } from './ChatMessageBubble';

/**
 * The church's group chat -- M7.
 *
 * =====================================================================
 * ONE LISTENER, AND IT IS BOUNDED
 * =====================================================================
 * This is the only screen in the app that holds a standing real-time
 * subscription, because a chat that does not update as people type is
 * not a chat. The subscription covers the NEWEST PAGE ONLY (see
 * ../../services/firebase/communityChat.ts's `limit`), so the cost is a
 * read when something in the last thirty messages changes -- not a read
 * every time anything in a collection that grows forever changes.
 *
 * History is plain reads, one page at a time, never listened to. The
 * anchor the history pages are read from is the FIRST oldest snapshot
 * the listener delivers, kept in a ref -- the live page's oldest message
 * slides forward as new ones arrive, and paging from a moving anchor
 * skips messages.
 *
 * =====================================================================
 * NOTHING IS INSERTED OPTIMISTICALLY, AND THAT IS WHY NOTHING DOUBLES
 * =====================================================================
 * The composer sends and clears. It does not add a copy of the message
 * to the list, because the Firestore SDK applies the write locally and
 * fires the snapshot before the server has seen it -- so the message
 * already appears immediately, through the same path that renders
 * everybody else's. A hand-added row on top of that is exactly how a
 * sent message appears twice and then flickers. The duplicate is
 * prevented by construction; mergeMessages() then handles the one real
 * overlap case, where a history page and the live page share a message.
 *
 * =====================================================================
 * INVERTED, AND KEYBOARD-SAFE
 * =====================================================================
 * `inverted` puts the newest message at the bottom without measuring
 * anything and keeps the view pinned there as messages arrive. The
 * composer sits inside a KeyboardAvoidingView, with `padding` on iOS and
 * `height` on Android, which is what stops the software keyboard covering
 * the box the member is typing into.
 */
export function CommunityChatScreen() {
  const { colors, radii, spacing, type, minTouchTarget } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { uid, displayName, canPost, suspended } = useMemberIdentity();

  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [historyExhausted, setHistoryExhausted] = useState(false);
  const [reportedKeys, setReportedKeys] = useState<ReadonlySet<string>>(new Set());
  const [reporting, setReporting] = useState<CommunityMessage | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  /**
   * The anchor history is read from. Set ONCE -- see the header.
   *
   * A ref rather than state because it is a value the HANDLERS need, not
   * one the render reads; `historyAvailable` beside it is the part the
   * render does read, because a ref's contents must not be looked at
   * during a render (the component would not re-render when it changed).
   */
  const historyCursorRef = useRef<MessageCursor | null>(null);
  const [historyAvailable, setHistoryAvailable] = useState(false);
  const mountedRef = useRef(true);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  useEffect(() => {
    const unsubscribe = subscribeToRecentMessages(
      (live, oldest) => {
        if (!mountedRef.current) return;
        if (historyCursorRef.current === null) {
          historyCursorRef.current = oldest;
          setHistoryAvailable(oldest !== null);
        }
        // Merged rather than replaced: `live` is only the newest page, so
        // assigning it would throw away any history already loaded.
        setMessages((current) => mergeMessages(current, live));
        setStatus('ready');
      },
      (error) => {
        console.warn('[chat] the message listener failed:', error);
        if (mountedRef.current) setStatus('error');
      }
    );
    return unsubscribe;
  }, [retryToken]);

  // The member's report markers, once for the whole screen.
  useEffect(() => {
    if (!uid) return undefined;
    let cancelled = false;
    void (async () => {
      try {
        const keys = await fetchReportedItemKeys(uid);
        if (!cancelled && mountedRef.current) setReportedKeys(keys);
      } catch (error) {
        // Not being able to say "already reported" is a missing
        // affordance, not a broken screen -- a second report is harmless.
        console.warn('[chat] could not read report markers:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const loadOlder = useCallback(async () => {
    const cursor = historyCursorRef.current;
    if (!cursor || loadingOlder || historyExhausted) return;
    setLoadingOlder(true);
    try {
      const page = await fetchOlderMessages(cursor);
      if (!mountedRef.current) return;
      setMessages((current) => mergeMessages(current, page.messages));
      historyCursorRef.current = page.cursor ?? cursor;
      setHistoryExhausted(page.cursor === null);
    } catch (error) {
      console.warn('[chat] could not load earlier messages:', error);
    } finally {
      if (mountedRef.current) setLoadingOlder(false);
    }
  }, [loadingOlder, historyExhausted]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || !uid || sending) return;
    setSending(true);
    setSendFailed(false);
    try {
      await sendMessage({ uid, authorName: displayName, text });
      if (mountedRef.current) setDraft('');
    } catch (error) {
      console.warn('[chat] could not send:', error);
      // The draft is deliberately kept. Losing what somebody typed
      // because the connection dropped is the failure this screen must
      // not have.
      if (mountedRef.current) setSendFailed(true);
    } finally {
      if (mountedRef.current) setSending(false);
    }
  }

  function confirmDelete(message: CommunityMessage) {
    Alert.alert(t('chat.deleteConfirmTitle'), t('chat.deleteConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          // No local removal: the listener's own snapshot takes the
          // message out, the same way it would for anybody else's screen.
          void deleteOwnMessage(message.id).catch((error) => {
            console.warn('[chat] could not delete:', error);
          });
        },
      },
    ]);
  }

  if (status === 'loading') {
    return <LoadingState label={t('common.loading')} testID="chat-loading" />;
  }

  if (status === 'error') {
    return (
      <ErrorState
        testID="chat-error"
        message={t('chat.loadError')}
        retryLabel={t('common.tryAgain')}
        onRetry={() => {
          setStatus('loading');
          setRetryToken((token) => token + 1);
        }}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      testID="chat-screen"
      style={[styles.screen, { backgroundColor: colors.paper }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top}
    >
      {/* =================================================================
          THE EMPTY STATE IS OUTSIDE THE LIST, AND HAS TO BE
          =================================================================
          `inverted` is implemented as a 180-degree transform on the
          scroll view, which every child inherits -- including
          `ListEmptyComponent`. An empty state passed that way renders
          UPSIDE DOWN on the device, which is exactly what a tester saw:
          "No messages yet / Say hello to the church family" flipped.

          Counter-rotating the empty component is the usual workaround and
          is the wrong fix: it leaves an upside-down container with an
          upside-down-again child inside it, which then mis-handles
          padding and any future content. The list only needs to be
          inverted when it HAS messages to pin to the bottom, so when
          there are none the list is not rendered at all and a plain,
          upright view takes its place.

          Both branches are flex children of the same
          KeyboardAvoidingView, above the same composer, so the
          keyboard-safe layout is identical either way. */}
      {messages.length === 0 ? (
        <View style={styles.emptyWrap} testID="chat-empty-wrap">
          <EmptyState
            testID="chat-empty"
            title={t('chat.empty')}
            message={t('chat.emptyMessage')}
          />
        </View>
      ) : (
        <FlatList
          testID="chat-list"
          // Newest at the bottom, pinned there as messages arrive, with no
          // scroll maths of our own. The data is already newest-first.
          inverted
          data={messages}
          keyExtractor={(message) => message.id}
          contentContainerStyle={[styles.list, { paddingVertical: spacing.md }]}
          // Taps must reach a bubble's Delete/Report while the keyboard is
          // open; without this the first tap only dismisses the keyboard.
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => (
            <ChatMessageBubble
              message={item}
              isOwn={item.authorUid === uid}
              alreadyReported={reportedKeys.has(
                reportedItemKey('community_message', item.id)
              )}
              onDelete={() => confirmDelete(item)}
              onReport={() => setReporting(item)}
            />
          )}
          // In an inverted list the END is the OLDEST message, so this is
          // where history paging belongs.
          onEndReached={() => void loadOlder()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingOlder ? (
              <LoadingState
                compact
                label={t('chat.loadingOlder')}
                testID="chat-loading-older"
              />
            ) : !historyExhausted && historyAvailable ? (
              <Tappable
                testID="chat-load-older"
                accessibilityRole="button"
                onPress={() => void loadOlder()}
                style={[styles.loadOlder, { minHeight: minTouchTarget }]}
              >
                <Text style={[type.label, { color: colors.primary }]}>
                  {t('chat.loadOlder')}
                </Text>
              </Tappable>
            ) : null
          }
        />
      )}

      {suspended ? (
        <View
          testID="chat-suspended"
          accessibilityLiveRegion="polite"
          style={[
            styles.composer,
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
      ) : (
        <View
          style={[
            styles.composer,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              padding: spacing.md,
              paddingBottom: spacing.md + insets.bottom,
              gap: spacing.sm,
            },
          ]}
        >
          {sendFailed ? (
            <Text
              testID="chat-send-failed"
              accessibilityLiveRegion="polite"
              style={[type.bodySmall, { color: colors.danger }]}
            >
              {t('chat.sendFailed')}
            </Text>
          ) : null}
          <View style={[styles.composerRow, { gap: spacing.sm }]}>
            <TextInput
              testID="chat-input"
              accessibilityLabel={t('chat.placeholder')}
              value={draft}
              onChangeText={setDraft}
              placeholder={t('chat.placeholder')}
              placeholderTextColor={colors.inkSubtle}
              multiline
              maxLength={MAX_MESSAGE_LENGTH}
              editable={canPost}
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceRaised,
                  borderColor: colors.border,
                  borderRadius: radii.control,
                  color: colors.ink,
                  padding: spacing.md,
                  minHeight: minTouchTarget,
                },
              ]}
            />
            <AppButton
              title={t('chat.send')}
              onPress={() => void handleSend()}
              disabled={!canPost || draft.trim().length === 0 || sending}
              loading={sending}
              testID="chat-send"
            />
          </View>
        </View>
      )}

      {reporting ? (
        <ReportSheet
          visible
          targetType="community_message"
          targetId={reporting.id}
          onClose={() => setReporting(null)}
          onReported={() =>
            setReportedKeys((current) => {
              const next = new Set(current);
              next.add(reportedItemKey('community_message', reporting.id));
              return next;
            })
          }
          testID="chat-report"
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { flexGrow: 1 },
  // Takes the space the list would have, so the composer stays pinned to
  // the bottom whether or not there are any messages.
  emptyWrap: { flex: 1, justifyContent: 'center', padding: 16 },
  loadOlder: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end' },
  input: {
    flex: 1,
    // A chat message can be long, but the box must not grow until it
    // swallows the conversation: it scrolls past this height.
    maxHeight: 120,
    textAlignVertical: 'top',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
