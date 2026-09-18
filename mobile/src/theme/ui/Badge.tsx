import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../useTheme';

export type BadgeVariant =
  'live' | 'success' | 'warning' | 'error' | 'info' | 'featured' | 'neutral';

/**
 * A small status pill.
 *
 * TEXT-LED, NEVER COLOUR-ONLY. The label always says what the state is,
 * so a reader who cannot distinguish the hues still gets the
 * information; `live` additionally carries a filled dot, so "live now"
 * differs in shape as well as colour from every other badge.
 *
 * M3 gave `warning`, `error` and `info` their own hues. They used to
 * share: `warning` and `featured` were literally the same two colours
 * (`liveTint` + `accent`), and there was no `error` or `info` variant at
 * all, so a failed save and a pinned announcement looked identical.
 */
export function Badge({
  label,
  variant = 'neutral',
  testID,
}: {
  label: string;
  variant?: BadgeVariant;
  testID?: string;
}) {
  const { colors, radii, type } = useTheme();

  const palette: Record<BadgeVariant, { bg: string; fg: string }> = {
    // Solid, because live is the one state that should pull the eye.
    live: { bg: colors.live, fg: colors.onLive },
    success: { bg: colors.successTint, fg: colors.success },
    warning: { bg: colors.warningTint, fg: colors.warning },
    error: { bg: colors.dangerTint, fg: colors.danger },
    info: { bg: colors.infoTint, fg: colors.info },
    featured: { bg: colors.accentTint, fg: colors.accent },
    neutral: { bg: colors.surfaceRaised, fg: colors.inkMuted },
  };
  const { bg, fg } = palette[variant];

  return (
    <View
      testID={testID}
      style={[styles.pill, { backgroundColor: bg, borderRadius: radii.pill }]}
      accessibilityRole="text"
    >
      {variant === 'live' ? <View style={[styles.dot, { backgroundColor: fg }]} /> : null}
      <Text style={[type.caption, styles.label, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    // A long translated label must wrap the pill, not overflow it.
    maxWidth: '100%',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { flexShrink: 1 },
});
