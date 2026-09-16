import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../useTheme';

/** Uppercase, tracked section label used above list groups on Home, Songs, Events, etc. */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: colors.secondaryText }]}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          // A bare 13px label is an ~18dp tap target. hitSlop rather than a
          // minHeight, so the action never changes the header's height on
          // the screens that already use it.
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
          style={({ pressed }) => [styles.actionHit, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.action, { color: colors.primary }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    // A long (or translated) section title must not push the action off
    // the right edge.
    flexShrink: 1,
    marginRight: 8,
  },
  actionHit: { flexShrink: 0 },
  action: {
    fontSize: 13,
    fontWeight: '600',
  },
});
