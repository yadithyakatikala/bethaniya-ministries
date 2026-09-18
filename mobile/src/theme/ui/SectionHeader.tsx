import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from './AppButton';
import { useTheme } from '../useTheme';

/**
 * A tracked uppercase label above a list group, with an optional action.
 *
 * M3 changed two things. The title is now the `overline` type role
 * rather than three inline properties repeated at each call site. And
 * the action is an `AppButton variant="text"`, which carries a real 44dp
 * target -- it used to be a bare Pressable whose 13px label was an
 * ~18dp target padded out with `hitSlop`. hitSlop widens where a tap
 * registers but not where a screen reader or a switch-control user finds
 * the element.
 *
 * The title keeps `flexShrink` and the action `flexShrink: 0`, so a long
 * Telugu section name wraps instead of pushing "See all" off the edge.
 */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
  testID,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  return (
    <View style={styles.row} testID={testID}>
      <Text
        style={[type.overline, styles.title, { color: colors.inkMuted }]}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <AppButton title={actionLabel} variant="text" onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: { flexShrink: 1 },
  action: { flexShrink: 0 },
});
