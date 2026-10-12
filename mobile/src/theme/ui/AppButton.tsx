import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
} from 'react-native';
import { Icon } from './Icon';
import type { IconName } from './iconShapes';
import { useTheme } from '../useTheme';

export type AppButtonVariant = 'primary' | 'secondary' | 'destructive' | 'text';

interface AppButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: AppButtonVariant;
  loading?: boolean;
  /** Stretches to the container's width. Default for primary CTAs. */
  fullWidth?: boolean;
  /** 40 high with a 14/18 label instead of 48 and 15/20. Not for the screen's one primary. */
  compact?: boolean;
  /** An icon after the label -- the arrow on "Read the chapter". */
  trailingIcon?: IconName;
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
 * The app's button: a pill, in four variants.
 *
 *   primary      ink fill (near-white at night). One per screen.
 *   secondary    a 1.5 pt strong border on the page.
 *   text         gold ink, no box -- "See all", "Share". 44 high.
 *   destructive  the error fill, only for a confirmed delete.
 *
 * 48 high (40 compact), a pill radius, the label in the `button` role
 * (15/20 semibold; compact buttons use the 14/18 `label`). A Telugu label
 * can be twice as long as its English one, so the label wraps to two
 * lines and the button grows -- it never clips.
 *
 * DISABLED IS A COLOUR, NOT AN OPACITY. This button used to fade the
 * whole control with `opacity: 0.5`, which took the label under 3:1
 * against its own fill -- the brief asks for readable disabled states.
 * Disabled now paints `disabledSurface`/`disabledInk`, which are tuned
 * for this (see ../tokens.ts). A LOADING button is not disabled-looking:
 * it keeps its own fill and shows a spinner in its label colour, and its
 * spoken name stays its label, so a screen reader still hears what it is.
 */
export function AppButton({
  title,
  variant = 'primary',
  loading = false,
  fullWidth = false,
  compact = false,
  trailingIcon,
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
  // A text button is gold INK (`accent`): the one gold that carries words.
  const label = dim
    ? colors.disabledInk
    : variant === 'primary'
      ? colors.onPrimary
      : variant === 'destructive'
        ? colors.onDanger
        : variant === 'secondary'
          ? colors.primary
          : colors.accent;

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

  const labelStyle = compact ? type.label : type.button;
  const height = variant === 'text' ? minTouchTarget : compact ? 40 : 48;

  return (
    <Pressable
      accessibilityRole="button"
      // The spinner replaces the label on screen; the label stays for a screen reader.
      accessibilityLabel={loading ? title : undefined}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      // A compact button is 40 high; its touch target is still 44.
      hitSlop={compact ? { top: 2, bottom: 2 } : undefined}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: height,
          paddingHorizontal: variant === 'text' ? 12 : compact ? 18 : 24,
          alignSelf: fullWidth ? 'stretch' : undefined,
          backgroundColor: pressedBackground(pressed),
          borderColor: border,
          borderWidth: variant === 'secondary' ? 1.5 : 0,
          borderRadius: radii.pill,
          opacity: pressed && variant === 'destructive' ? 0.85 : 1,
        },
      ]}
      {...props}
    >
      {loading ? (
        // The label stays in the layout (invisible) so the button does not
        // change width when it starts spinning; the spinner sits on top.
        <View style={styles.busy}>
          <Text
            style={[labelStyle, styles.title, styles.hidden]}
            numberOfLines={2}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {title}
          </Text>
          <View style={styles.spinner}>
            <ActivityIndicator color={label} />
          </View>
        </View>
      ) : trailingIcon ? (
        <View style={styles.content}>
          <Text style={[labelStyle, styles.title, { color: label }]} numberOfLines={2}>
            {title}
          </Text>
          <Icon name={trailingIcon} size={18} color={label} />
        </View>
      ) : (
        <Text style={[labelStyle, styles.title, { color: label }]} numberOfLines={2}>
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
  content: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
  busy: { alignItems: 'center', justifyContent: 'center' },
  hidden: { opacity: 0 },
  spinner: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Wraps to two lines (Telugu) and grows the button rather than clipping.
  title: { flexShrink: 1, textAlign: 'center' },
});
