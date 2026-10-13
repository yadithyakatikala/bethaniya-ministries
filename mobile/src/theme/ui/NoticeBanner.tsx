import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from './AppButton';
import { Icon } from './Icon';
import { useTheme } from '../useTheme';

export type NoticeTone = 'neutral' | 'warning' | 'danger';

/**
 * A notice that stays on the screen: a mark, a short title, one plain
 * sentence, and optionally one action. Three tints, each with a MARK (info or
 * alert) and WORDS for what it is -- never colour alone.
 *
 *   neutral   information. The raised ground and page ink, an "i".
 *   warning   a paused or suspended account, a provisional line on the
 *             legal pages. A triangle, and the words, in the warning colour
 *             on its tint.
 *   danger    something failed and the member has to do something. The
 *             same triangle, in the error colour on its tint.
 *
 * THE LOOK (the approved one): a 12-radius box with no border, 12 above and
 * below and 14 either side; the 20-point mark at the left, then the words at
 * 13.5/20 in the tone's colour -- the title, when there is one, semibold
 * above the sentence. Each tone's colour on its tint clears 4.5:1 in both
 * palettes (asserted in ../__tests__/contrast.test.ts).
 *
 * Announced politely when it appears (`accessibilityLiveRegion`).
 * `messageTestID` names the sentence itself, for a screen whose tests read
 * the message rather than the box (the sign-in screen's error).
 */
export function NoticeBanner({
  tone = 'neutral',
  title,
  message,
  actionLabel,
  onAction,
  testID,
  messageTestID,
}: {
  tone?: NoticeTone;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
  messageTestID?: string;
}) {
  const { colors, radii, type } = useTheme();
  const palette: Record<NoticeTone, { bg: string; ink: string }> = {
    neutral: { bg: colors.surfaceRaised, ink: colors.ink },
    warning: { bg: colors.warningTint, ink: colors.warning },
    danger: { bg: colors.dangerTint, ink: colors.danger },
  };
  const { bg, ink } = palette[tone];
  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      style={[styles.box, { backgroundColor: bg, borderRadius: radii.control }]}
    >
      <View style={styles.mark}>
        <Icon name={tone === 'neutral' ? 'info' : 'alert'} size={20} color={ink} />
      </View>
      <View style={styles.words}>
        {title ? (
          <Text style={[type.label, { color: ink }]} accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        <Text testID={messageTestID} style={[type.bodySmall, { color: ink }]}>
          {message}
        </Text>
        {actionLabel && onAction ? (
          <View style={styles.action}>
            <AppButton
              title={actionLabel}
              variant="secondary"
              compact
              onPress={onAction}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  // Level with the first line of text rather than the middle of a long one.
  mark: { marginTop: 1 },
  words: { flex: 1, minWidth: 0, gap: 2 },
  action: { marginTop: 8, alignSelf: 'flex-start' },
});
