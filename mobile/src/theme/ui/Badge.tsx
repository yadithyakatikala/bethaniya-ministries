import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../useTheme';

export type BadgeVariant =
  'live' | 'success' | 'warning' | 'error' | 'info' | 'featured' | 'neutral';

/**
 * A small status pill: 24 high, a tint fill with the status colour for
 * its words.
 *
 * TEXT-LED, NEVER COLOUR-ONLY. The label always says what the state is,
 * so a reader who cannot distinguish the hues still gets the
 * information; `live` additionally carries a filled dot, so "live now"
 * differs in shape as well as colour from every other badge.
 *
 * LIVE IS THE ONE PLACE RED IS ALLOWED TO BE LOUD: a solid fill. Every
 * other status is a quiet tint.
 *
 * `info` is retired from the design (S8): a category is not a status, so
 * a category chip is neutral. The variant remains so that nothing that
 * still asks for it breaks, but it paints as `neutral` -- the Info blue
 * is no longer drawn anywhere.
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
    info: { bg: colors.surfaceRaised, fg: colors.inkMuted },
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
    minHeight: 24,
    paddingHorizontal: 10,
    paddingVertical: 3,
    // A long translated label must wrap the pill, not overflow it.
    maxWidth: '100%',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { flexShrink: 1 },
});
