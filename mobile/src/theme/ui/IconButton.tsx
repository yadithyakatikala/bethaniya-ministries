import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Tappable } from './Tappable';
import { useTheme } from '../useTheme';

/**
 * A square, icon-only control.
 *
 * WHY THIS EXISTS. The audit found eight icon-only controls -- Home's
 * Profile and Announcements buttons, the Bible reader's back chevron,
 * the audio transport, the notification row's dismiss -- each a bare
 * Pressable wrapping a glyph, sized by the glyph. Several were under the
 * 44dp minimum, and none of them could be relied on to have an
 * accessibility label because nothing required one.
 *
 * `accessibilityLabel` is REQUIRED by the type here. An icon-only
 * control with no label is silent to a screen reader, which is the one
 * accessibility failure a sighted reviewer never notices.
 */
export function IconButton({
  onPress,
  accessibilityLabel,
  accessibilityHint,
  children,
  testID,
  disabled,
  variant = 'plain',
  style,
}: {
  onPress: () => void;
  /** Required -- the glyph carries no text for a screen reader. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  children: React.ReactNode;
  testID?: string;
  disabled?: boolean;
  /** `tinted` gives the button a quiet filled backdrop. */
  variant?: 'plain' | 'tinted';
  style?: ViewStyle;
}) {
  const { colors, radii, minTouchTarget } = useTheme();
  return (
    <Tappable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.base,
        {
          width: minTouchTarget,
          height: minTouchTarget,
          borderRadius: radii.control,
          backgroundColor: variant === 'tinted' ? colors.primaryTint : 'transparent',
        },
        style,
      ]}
    >
      <View style={styles.glyph}>{children}</View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  glyph: { alignItems: 'center', justifyContent: 'center' },
});
