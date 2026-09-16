import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
} from 'react-native';
import { useTheme } from '../useTheme';

export type AppButtonVariant = 'primary' | 'secondary' | 'destructive';

interface AppButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: AppButtonVariant;
  loading?: boolean;
}

/** Vespers button -- 48px min height, three variants, never smaller than the 44px touch minimum. */
export function AppButton({
  title,
  variant = 'primary',
  loading = false,
  disabled,
  testID,
  ...props
}: AppButtonProps) {
  const { colors, radii } = useTheme();
  const isDisabled = disabled || loading;

  const backgroundColor =
    variant === 'primary'
      ? colors.primary
      : variant === 'destructive'
        ? colors.danger
        : 'transparent';
  const borderColor = variant === 'secondary' ? colors.primary : 'transparent';
  // NOT '#FFFFFF'. The dark palette's `primary` is a light sage and its
  // `danger` a light coral, so a white label measured 2.04:1 and 2.80:1
  // against its own button -- on the primitive that every screen's main
  // CTA is built from. The on- tokens are dark ink in dark mode, which
  // measures 8.66:1 and 6.31:1; light mode is unchanged. See ../tokens.ts.
  const textColor =
    variant === 'secondary'
      ? colors.primary
      : variant === 'destructive'
        ? colors.onDanger
        : colors.onPrimary;

  /**
   * Pressed feedback. The button had no press state at all, so tapping a
   * CTA that waits on Firebase looked like nothing had happened until the
   * spinner appeared. Colour only -- no scale or translate, so there is
   * no animation to drop frames.
   */
  function pressedBackground(pressed: boolean): string {
    if (!pressed || isDisabled) return backgroundColor;
    if (variant === 'primary') return colors.primaryPressed;
    if (variant === 'secondary') return colors.primaryTint;
    return backgroundColor;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: pressedBackground(pressed),
          borderColor,
          borderWidth: variant === 'secondary' ? 1.5 : 0,
          borderRadius: radii.control,
          opacity: isDisabled
            ? 0.5
            : pressed && variant === 'destructive'
              ? 0.8
              : 1,
        },
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 15.5,
    fontWeight: '600',
  },
});
