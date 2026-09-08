import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../useTheme';

export type BadgeVariant =
  'live' | 'success' | 'draft' | 'featured' | 'warning' | 'neutral';

/** Small status pill -- text-led, never colour-only (pair with a leading dot/icon for LIVE). */
export function Badge({
  label,
  variant = 'neutral',
}: {
  label: string;
  variant?: BadgeVariant;
}) {
  const { colors } = useTheme();

  const palette: Record<BadgeVariant, { bg: string; fg: string }> = {
    live: { bg: colors.live, fg: '#FFFFFF' },
    success: { bg: colors.primaryTint, fg: colors.primaryPressed },
    draft: { bg: colors.surfaceRaised, fg: colors.inkMuted },
    featured: { bg: colors.liveTint, fg: colors.accent },
    warning: { bg: colors.liveTint, fg: colors.accent },
    neutral: { bg: colors.surfaceRaised, fg: colors.inkMuted },
  };
  const { bg, fg } = palette[variant];

  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
  },
});
