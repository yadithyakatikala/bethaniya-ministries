import { useCallback, useEffect, useRef, useState } from 'react';
import {
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
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  NoticeBanner,
  Tappable,
  useTheme,
} from '../../theme';
import { fontFamilies } from '../../theme/tokens';
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
import { fetchReportedItemKeys, reportedItemKey } from '../../services/firebase/reports';
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
  const { colors, layout, radii, type } = useTheme();
  const { t, appLanguage } = useTranslation();
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
  const [deleting, setDeleting] = useState<CommunityMessage | null>(null);
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

  function deleteConfirmed(message: CommunityMessage) {
    // No local removal: the listener's own snapshot takes the message out,
    // the same way it would for anybody else's screen.
    void deleteOwnMessage(message.id).catch((error) => {
      console.warn('[chat] could not delete:', error);
    });
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
          contentContainerStyle={[
            styles.list,
            { paddingHorizontal: layout.screenMargin, paddingVertical: 10 },
          ]}
          ItemSeparatorComponent={Separator}
          // Taps must reach a bubble's Delete/Report while the keyboard is
          // open; without this the first tap only dismisses the keyboard.
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item, index }) => {
            // The data is newest-first, so the message BEFORE this one in time
            // is the next in the array. This one starts a run when the one
            // before it is somebody else's (or was removed, or is not loaded).
            const before = messages[index + 1];
            const startsRun =
              !before || before.removed || before.authorUid !== item.authorUid;
            return (
              <ChatMessageBubble
                message={item}
                isOwn={item.authorUid === uid}
                startsRun={startsRun}
                alreadyReported={reportedKeys.has(
                  reportedItemKey('community_message', item.id)
                )}
                onDelete={() => setDeleting(item)}
                onReport={() => setReporting(item)}
              />
            );
          }}
          // In an inverted list the END is the OLDEST message, so this is
          // where history paging belongs.
          onEndReached={() => void loadOlder()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingOlder ? (
              <Text
                testID="chat-loading-older"
                accessibilityLiveRegion="polite"
                style={[styles.older, { color: colors.accent }]}
              >
                {t('chat.loadingOlder')}
              </Text>
            ) : !historyExhausted && historyAvailable ? (
              <Tappable
                testID="chat-load-older"
                accessibilityRole="button"
                onPress={() => void loadOlder()}
                style={styles.loadOlder}
              >
                <Text style={[styles.older, { color: colors.accent }]}>
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
          style={[
            styles.composer,
            styles.suspended,
            { borderTopColor: colors.border, backgroundColor: colors.paper },
          ]}
        >
          <NoticeBanner
            tone="warning"
            title={t('account.suspendedTitle')}
            message={t('account.suspendedMessage')}
          />
        </View>
      ) : (
        <View
          style={[
            styles.composer,
            {
              backgroundColor: colors.paper,
              borderTopColor: colors.border,
              paddingHorizontal: layout.screenMargin,
            },
          ]}
        >
          {sendFailed ? (
            <Text
              testID="chat-send-failed"
              accessibilityLiveRegion="polite"
              style={[type.help, { color: colors.danger }]}
            >
              {t('chat.sendFailed')}
            </Text>
          ) : null}
          <View style={styles.composerRow}>
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
                appLanguage === 'te' && styles.inputTe,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderStrong,
                  borderRadius: radii.control,
                  color: colors.ink,
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

      <ConfirmDialog
        visible={deleting !== null}
        testID="chat-delete-dialog"
        title={t('chat.deleteConfirmTitle')}
        message={t('chat.deleteConfirmMessage')}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('common.delete')}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const message = deleting;
          setDeleting(null);
          if (message) deleteConfirmed(message);
        }}
      />

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

/** Six points between bubbles; a new voice adds its own four on top (the bubble's margin). */
function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { flexGrow: 1 },
  separator: { height: 6 },
  // Takes the space the list would have, so the composer stays pinned to
  // the bottom whether or not there are any messages.
  emptyWrap: { flex: 1, justifyContent: 'center', padding: 16 },
  loadOlder: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
  older: {
    alignSelf: 'center',
    textAlign: 'center',
    paddingVertical: 12,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 18,
  },
  composer: {
    borderTopWidth: 1,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 8,
  },
  suspended: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16 },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    minHeight: 48,
    // A chat message can be long, but the box must not grow until it
    // swallows the conversation: it scrolls past this height.
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
    borderWidth: 1,
    fontFamily: fontFamilies.interfaceRegular,
    fontSize: 15.5,
    lineHeight: 23,
  },
  inputTe: { lineHeight: 27 },
});
