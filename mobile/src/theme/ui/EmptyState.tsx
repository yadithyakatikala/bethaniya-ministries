import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from './AppButton';
import { useTheme } from '../useTheme';

/**
 * One shared empty-state voice -- a title, one calm sentence, and
 * optionally the action that would fill it.
 *
 * The dashed border and the absent icon are both deliberate: the app has
 * no icon library, and an empty state is a place to explain rather than
 * decorate. M3 added the optional action, because "no prayers yet" with
 * no way to add one from that screen is a dead end the user has to
 * navigate out of.
 */
export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  testID,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}) {
  const { colors, radii, spacing, type } = useTheme();
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
          gap: spacing.sm,
        },
      ]}
    >
      <Text style={[type.title, styles.centred, { color: colors.ink }]}>{title}</Text>
      <Text style={[type.bodySmall, styles.message, { color: colors.inkMuted }]}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.sm }}>
          <AppButton title={actionLabel} variant="secondary" onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  centred: { textAlign: 'center' },
  // Capped, not full-bleed: a centred sentence running the whole width of
  // a tablet is harder to read than the same sentence in three lines.
  message: { textAlign: 'center', maxWidth: 320 },
});
