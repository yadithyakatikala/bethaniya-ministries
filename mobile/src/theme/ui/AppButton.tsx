import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
} from 'react-native';
import { useTheme } from '../useTheme';

export type AppButtonVariant = 'primary' | 'secondary' | 'destructive' | 'text';

interface AppButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: AppButtonVariant;
  loading?: boolean;
  /** Stretches to the container's width. Default for primary CTAs. */
  fullWidth?: boolean;
  /**
   * Looks disabled but stays pressable.
   *
   * For a form whose Continue "wakes up" once the answer is complete: while
   * it is not, the button is painted as disabled, and pressing it still
   * does something useful -- it says what is missing. A truly disabled
   * button cannot explain itself, and to a screen reader it is a dead end;
   * this one is announced as an ordinary button.
   */
  muted?: boolean;
}

/**
 * The app's button, in four variants.
 *
 * `text` is new in M3: the audit found six places drawing a bare
 * `<Pressable><Text>` for a low-emphasis action (Settings' "View" rows,
 * SectionHeader's "See all", the Bible reader's mode pill), each with
 * its own size, colour and touch target. A named variant is one
 * definition and one 44dp target.
 *
 * DISABLED IS A COLOUR, NOT AN OPACITY. This button used to fade the
 * whole control with `opacity: 0.5`, which took the label under 3:1
 * against its own fill -- the brief asks for readable disabled states.
 * Disabled now paints `disabledSurface`/`disabledInk`, which are tuned
 * for this (see ../tokens.ts). A LOADING button is not disabled-looking:
 * it keeps its own fill and shows a spinner in its label colour.
 */
export function AppButton({
  title,
  variant = 'primary',
  loading = false,
  fullWidth = false,
  muted = false,
  disabled,
  testID,
  ...props
}: AppButtonProps) {
  const { colors, radii, type, minTouchTarget } = useTheme();
  // What the button DOES (`isDisabled`) and how it LOOKS (`dim`) differ in two
  // cases: `muted` looks disabled but presses; `loading` does not press but
  // keeps its colours, with a spinner -- the design's busy state. (A busy
  // button painted as disabled reads as "unavailable", not "working".)
  const isDisabled = disabled || loading;
  const dim = disabled || muted;

  const filled = variant === 'primary' || variant === 'destructive';
  const background = dim
    ? filled
      ? colors.disabledSurface
      : 'transparent'
    : variant === 'primary'
      ? colors.primary
      : variant === 'destructive'
        ? colors.danger
        : 'transparent';

  // NOT '#FFFFFF'. `primary` and `danger` invert between the palettes,
  // so a hardcoded white label measured 2.04:1 and 2.80:1 in dark mode
  // -- on the primitive behind every screen's main call to action.
  const label = dim
    ? colors.disabledInk
    : variant === 'primary'
      ? colors.onPrimary
      : variant === 'destructive'
        ? colors.onDanger
        : variant === 'secondary'
          ? colors.primary
          : colors.primary;

  const border = dim
    ? variant === 'secondary'
      ? colors.border
      : 'transparent'
    : variant === 'secondary'
      ? colors.borderStrong
      : 'transparent';

  /** Pressed feedback. Colour only -- nothing to animate, no dropped frames. */
  function pressedBackground(pressed: boolean): string {
    if (!pressed || dim) return background;
    if (variant === 'primary') return colors.primaryPressed;
    if (variant === 'secondary' || variant === 'text') return colors.primaryTint;
    return background;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: variant === 'text' ? minTouchTarget : 48,
          paddingHorizontal: variant === 'text' ? 12 : 18,
          alignSelf: fullWidth ? 'stretch' : undefined,
          backgroundColor: pressedBackground(pressed),
          borderColor: border,
          borderWidth: variant === 'secondary' ? 1.5 : 0,
          borderRadius: radii.control,
          opacity: pressed && variant === 'destructive' ? 0.85 : 1,
        },
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={label} />
      ) : (
        <Text style={[type.label, { color: label }]} numberOfLines={2}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
