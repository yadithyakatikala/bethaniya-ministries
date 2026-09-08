import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../useTheme';

/** One shared empty-state voice -- a title plus one calm sentence, no icon library dependency. */
export function EmptyState({
  title,
  message,
  testID,
}: {
  title: string;
  message: string;
  testID?: string;
}) {
  const { colors, radii, spacing } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radii.card,
          padding: spacing.xl,
        },
      ]}
    >
      <View
        style={[
          styles.dot,
          { backgroundColor: colors.primaryTint, borderRadius: radii.control },
        ]}
      />
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.secondaryText }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 8,
  },
  dot: { width: 40, height: 40 },
  title: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  message: { fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 260 },
});
