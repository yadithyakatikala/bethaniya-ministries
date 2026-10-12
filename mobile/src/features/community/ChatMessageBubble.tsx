import { StyleSheet, Text, View } from 'react-native';
import { Avatar, Tappable, useTheme } from '../../theme';
import { fontFamilies } from '../../theme/tokens';
import { useTranslation } from '../../i18n';
import { formatMessageTimestamp } from '../../i18n/locale';
import type { CommunityMessage } from '../../services/firebase/communityChat';

/**
 * One message in the group chat -- M7.
 *
 * =====================================================================
 * OWN AND OTHER DIFFER BY MORE THAN COLOUR
 * =====================================================================
 * A member's own message is right-aligned, filled with `primary`, and
 * labelled "You"; everybody else's is left-aligned, on `surface`, and
 * labelled with the sender's name. Alignment and the name carry the
 * distinction on their own, so the bubble reads correctly without colour
 * vision and to a screen reader, which gets the whole thing as one label
 * -- "Asha said: ..." -- rather than as three unconnected text nodes.
 *
 * =====================================================================
 * A REMOVED MESSAGE LEAVES A TOMBSTONE
 * =====================================================================
 * Not a gap. An administrator removing something mid-conversation should
 * not make the thread silently reflow under the person reading it, and a
 * reply to a message that has vanished reads as a non sequitur. The
 * bubble stays and says what happened. Moderation is a soft flag for
 * exactly this reason -- see firestore.rules' community_messages block.
 *
 * THE LOOK. Others' messages sit at the left on the page's surface with a
 * hairline, in a 16-radius bubble no wider than 80% of the row; the FIRST
 * message of a run by one person has their initial in a 28-point disc beside
 * it and their name, in gold small text, above the words -- the messages after
 * it in the same run have neither, only a 28-point gap, so a run reads as one
 * voice. A member's own sit at the right, ink-filled, with no name and no disc.
 * Under the words: the time (or "Sending…"), and at the right edge Report (or
 * Delete for your own) as a word with a 44-high target made by its slop (16 + 14 + 14), so
 * the bubble stays tight. The words and the name are ONE accessible node
 * ("Asha said: ..."); the time and the action are separate stops after it, so
 * Report and Delete are reachable for a screen reader, which a node that
 * swallowed its children would hide.
 *
 * SENDING. A message whose serverTimestamp() has not resolved yet shows
 * "Sending…" instead of a time. It is the one this device has just sent
 * (nothing else can have a null timestamp), and showing an invented
 * "now" would be a small lie that becomes visible when the real time
 * differs.
 */
export function ChatMessageBubble({
  message,
  isOwn,
  alreadyReported,
  onDelete,
  onReport,
  startsRun = true,
}: {
  message: CommunityMessage;
  isOwn: boolean;
  alreadyReported: boolean;
  onDelete: () => void;
  onReport: () => void;
  /**
   * Whether this is the first message of a run by its author (the oldest one
   * shown for them before somebody else speaks). Only then does somebody
   * else's message carry the disc and the name. Default true: alone, a bubble
   * says who it is from.
   */
  startsRun?: boolean;
}) {
  const { colors, radii, type } = useTheme();
  const { t, appLanguage } = useTranslation();
  const telugu = appLanguage === 'te';

  if (message.removed) {
    return (
      <View testID={`chat-message-${message.id}`} style={[styles.row, styles.centre]}>
        <Text style={[type.caption, styles.tombstone, { color: colors.inkSubtle }]}>
          {t('chat.removed')}
        </Text>
      </View>
    );
  }

  const senderLabel = isOwn ? t('chat.you') : message.authorName;
  const pending = !message.createdAt;
  const timeLabel = message.createdAt
    ? formatMessageTimestamp(message.createdAt, appLanguage)
    : t('chat.sending');
  const ink = isOwn ? colors.onPrimary : colors.ink;
  const showAuthor = !isOwn && startsRun;

  return (
    <View
      testID={`chat-message-${message.id}`}
      style={[
        styles.row,
        isOwn && styles.rowOwn,
        // A new voice starts a little lower than a continuing one.
        { marginTop: !isOwn && startsRun ? 10 : 0 },
      ]}
    >
      {isOwn ? null : startsRun ? (
        <View style={styles.avatar}>
          <Avatar name={message.authorName} size={28} />
        </View>
      ) : (
        <View style={styles.gap} />
      )}
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isOwn ? colors.primary : colors.surface,
            borderColor: isOwn ? colors.primary : colors.border,
            borderRadius: radii.card,
          },
        ]}
      >
        <View
          // One accessible node for the name and the words: a screen reader
          // announcing "Asha", then "Good morning everyone" as separate stops
          // is how a chat becomes tiring without sight. The time and the
          // action below are NOT inside it, so they stay reachable.
          accessible
          accessibilityLabel={t('chat.messageLabel', {
            name: senderLabel,
            text: message.text,
          })}
          style={styles.words}
        >
          {showAuthor ? (
            <Text
              testID={`chat-author-${message.id}`}
              style={[type.caption, styles.name, { color: colors.accent }]}
              numberOfLines={1}
            >
              {message.authorName}
            </Text>
          ) : null}
          {/* No numberOfLines: a long message wraps to whatever height it
              needs. Truncating somebody's prayer request at three lines,
              with no way to expand it, is worse than a tall bubble. */}
          <Text style={[styles.text, telugu && styles.textTe, { color: ink }]}>
            {message.text}
          </Text>
        </View>
        <View style={styles.footer}>
          <Text
            testID={`chat-time-${message.id}`}
            style={[
              styles.time,
              telugu && styles.timeTe,
              isOwn
                ? { color: colors.onPrimary, opacity: 0.78 }
                : { color: colors.inkSubtle },
            ]}
          >
            {timeLabel}
          </Text>
          {isOwn ? (
            // Still being sent: nothing to delete yet.
            pending ? null : (
              <Tappable
                testID={`chat-delete-${message.id}`}
                accessibilityRole="button"
                accessibilityLabel={t('chat.deleteLabel')}
                onPress={onDelete}
                hitSlop={SLOP}
              >
                <Text style={[styles.action, { color: colors.onPrimary, opacity: 0.9 }]}>
                  {t('common.delete')}
                </Text>
              </Tappable>
            )
          ) : (
            <Tappable
              testID={`chat-report-${message.id}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: alreadyReported }}
              disabled={alreadyReported}
              onPress={onReport}
              hitSlop={SLOP}
            >
              <Text
                style={[
                  styles.action,
                  { color: alreadyReported ? colors.disabledInk : colors.inkMuted },
                ]}
              >
                {alreadyReported ? t('report.alreadyReported') : t('report.action')}
              </Text>
            </Tappable>
          )}
        </View>
      </View>
    </View>
  );
}

/** The action's words are 16 high; this brings a finger's target to 44. */
const SLOP = { top: 14, bottom: 14, left: 10, right: 10 };

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowOwn: { justifyContent: 'flex-end' },
  centre: { justifyContent: 'center' },
  avatar: { marginTop: 2 },
  gap: { width: 28 },
  tombstone: { paddingVertical: 8, paddingHorizontal: 12, textAlign: 'center' },
  // Capped so a bubble never runs the full width of a tablet, which is
  // what makes own and other readable as two columns at a glance.
  bubble: {
    maxWidth: '80%',
    flexShrink: 1,
    borderWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 6,
    gap: 2,
  },
  words: { gap: 2 },
  name: { fontFamily: fontFamilies.interfaceSemiBold, fontWeight: '600' },
  text: {
    fontFamily: fontFamilies.interfaceRegular,
    fontSize: 15.5,
    lineHeight: 23,
  },
  textTe: { lineHeight: 27 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    minHeight: 26,
  },
  time: { fontFamily: fontFamilies.interfaceRegular, fontSize: 12, lineHeight: 16 },
  timeTe: { lineHeight: 20 },
  action: {
    fontFamily: fontFamilies.interfaceMedium,
    fontWeight: '500',
    fontSize: 12.5,
    lineHeight: 16,
  },
});
