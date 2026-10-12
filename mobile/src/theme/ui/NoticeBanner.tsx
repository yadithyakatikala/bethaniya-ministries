import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from './AppButton';
import { useTheme } from '../useTheme';

export type NoticeTone = 'neutral' | 'warning' | 'danger';

/**
 * A notice that stays on the screen: a short title, one plain sentence,
 * and optionally one action. Three tints, each with a 1 pt border of its
 * own colour and a WORD for what it is -- never colour alone.
 *
 *   neutral   information. The raised ground.
 *   warning   a paused or suspended account, a provisional line on the
 *             legal pages.
 *   danger    something failed and the member has to do something.
 *
 * Announced politely when it appears (`accessibilityLiveRegion`).
 */
export function NoticeBanner({
  tone = 'neutral',
  title,
  message,
  actionLabel,
  onAction,
  testID,
}: {
  tone?: NoticeTone;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}) {
  const { colors, radii, type } = useTheme();
  const palette: Record<NoticeTone, { bg: string; border: string }> = {
    neutral: { bg: colors.surfaceRaised, border: colors.border },
    warning: { bg: colors.warningTint, border: colors.warning },
    danger: { bg: colors.dangerTint, border: colors.danger },
  };
  const { bg, border } = palette[tone];
  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      style={[
        styles.box,
        { backgroundColor: bg, borderColor: border, borderRadius: radii.card },
      ]}
    >
      {title ? (
        <Text style={[type.button, { color: colors.ink }]} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <Text style={[type.body, { color: colors.ink }]}>{message}</Text>
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <AppButton title={actionLabel} variant="secondary" compact onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, padding: 16, gap: 6 },
  action: { marginTop: 8, alignSelf: 'flex-start' },
});
