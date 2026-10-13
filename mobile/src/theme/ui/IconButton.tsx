import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Tappable } from './Tappable';
import { useTheme } from '../useTheme';

/**
 * A round, icon-only control: 44 across, a pill.
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
 *
 * Three looks: `plain` (just the glyph), `outlined` (a hairline ring, as
 * Share and Copy on Home) and `tinted` (a quiet filled disc, as a close
 * button on a sheet).
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
  variant?: 'plain' | 'outlined' | 'tinted';
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
          borderRadius: radii.pill,
          backgroundColor: variant === 'tinted' ? colors.surfaceRaised : 'transparent',
          borderWidth: variant === 'outlined' ? 1 : 0,
          borderColor: colors.border,
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
