import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../useTheme';

/**
 * The one loading state.
 *
 * Ten screens spun their own: a bare `<ActivityIndicator />` with no
 * label, at four different paddings, and in three cases with no
 * accessibility announcement at all -- so a screen reader read a screen
 * that was busy as an empty one.
 *
 * `accessibilityRole="progressbar"` plus a real label is what makes
 * "still loading" audible. The label is optional in the API only because
 * a spinner inside an already-labelled card does not need repeating; on
 * a whole screen, pass one.
 */
export function LoadingState({
  label,
  testID,
  compact = false,
}: {
  label?: string;
  testID?: string;
  compact?: boolean;
}) {
  const { colors, spacing, type } = useTheme();
  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={[
        styles.container,
        { paddingVertical: compact ? spacing.lg : spacing.xxl, gap: spacing.md },
      ]}
    >
      <ActivityIndicator color={colors.primary} />
      {label ? (
        <Text style={[type.bodySmall, { color: colors.inkMuted }]}>{label}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
});
