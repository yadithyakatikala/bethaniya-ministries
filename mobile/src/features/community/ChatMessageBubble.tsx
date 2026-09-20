import { StyleSheet, Text, View } from 'react-native';
import { Tappable, useTheme } from '../../theme';
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
}: {
  message: CommunityMessage;
  isOwn: boolean;
  alreadyReported: boolean;
  onDelete: () => void;
  onReport: () => void;
}) {
  const { colors, radii, spacing, type, minTouchTarget } = useTheme();
  const { t, appLanguage } = useTranslation();

  if (message.removed) {
    return (
      <View
        testID={`chat-message-${message.id}`}
        style={[
          styles.row,
          styles.centre,
          { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
        ]}
      >
        <Text style={[type.caption, { color: colors.inkSubtle }]}>
          {t('chat.removed')}
        </Text>
      </View>
    );
  }

  const senderLabel = isOwn ? t('chat.you') : message.authorName;
  const timeLabel = message.createdAt
    ? formatMessageTimestamp(message.createdAt, appLanguage)
    : t('chat.sending');

  return (
    <View
      testID={`chat-message-${message.id}`}
      style={[
        styles.row,
        { paddingHorizontal: spacing.md, justifyContent: isOwn ? 'flex-end' : 'flex-start' },
      ]}
    >
      <View
        // One accessible node for the whole bubble: a screen reader
        // announcing "Asha", "Good morning everyone", "9:14" as three
        // separate stops is how a chat becomes unusable without sight.
        accessible
        accessibilityLabel={t('chat.messageLabel', {
          name: senderLabel,
          text: message.text,
        })}
        style={[
          styles.bubble,
          {
            backgroundColor: isOwn ? colors.primary : colors.surface,
            borderColor: isOwn ? colors.primary : colors.border,
            borderRadius: radii.card,
            padding: spacing.md,
            gap: spacing.xs,
          },
        ]}
      >
        <Text
          style={[type.caption, { color: isOwn ? colors.onPrimary : colors.accent }]}
          numberOfLines={1}
        >
          {senderLabel}
        </Text>
        {/* No numberOfLines: a long message wraps to whatever height it
            needs. Truncating somebody's prayer request at three lines,
            with no way to expand it, is worse than a tall bubble. */}
        <Text style={[type.body, { color: isOwn ? colors.onPrimary : colors.ink }]}>
          {message.text}
        </Text>
        <View style={[styles.footer, { gap: spacing.md }]}>
          <Text
            style={[type.caption, { color: isOwn ? colors.onPrimary : colors.inkSubtle }]}
          >
            {timeLabel}
          </Text>
          {isOwn ? (
            <Tappable
              testID={`chat-delete-${message.id}`}
              accessibilityRole="button"
              accessibilityLabel={t('chat.deleteLabel')}
              onPress={onDelete}
              style={[styles.action, { minHeight: minTouchTarget }]}
            >
              <Text style={[type.caption, { color: colors.onPrimary }]}>
                {t('common.delete')}
              </Text>
            </Tappable>
          ) : (
            <Tappable
              testID={`chat-report-${message.id}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: alreadyReported }}
              disabled={alreadyReported}
              onPress={onReport}
              style={[styles.action, { minHeight: minTouchTarget }]}
            >
              <Text
                style={[
                  type.caption,
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

const styles = StyleSheet.create({
  row: { flexDirection: 'row', width: '100%' },
  centre: { justifyContent: 'center' },
  // Capped so a bubble never runs the full width of a tablet, which is
  // what makes own and other readable as two columns at a glance.
  bubble: { maxWidth: '85%', borderWidth: StyleSheet.hairlineWidth },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  action: { justifyContent: 'center' },
});
