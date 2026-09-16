import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

/**
 * How far a control dims while a finger is on it. One number, in one
 * place, so every tappable surface in the app responds identically.
 */
export const PRESSED_OPACITY = 0.6;

/**
 * A Pressable that acknowledges the touch.
 *
 * React Native's Pressable has NO default press feedback -- unlike
 * TouchableOpacity, which dims itself. The app had roughly twenty-five
 * bare Pressables (the Home quick links and live banner, every More and
 * Settings row, the Bible reader controls, the audio transport, the
 * favourite toggle), so tapping any of them looked like nothing had
 * happened until the next screen appeared. On a slow connection that
 * reads as an unresponsive app and invites the double-tap that fires an
 * action twice.
 *
 * Opacity only. No scale or translate: those animate on the UI thread
 * per press and buy nothing here, and the design direction is calm
 * rather than bouncy.
 *
 * `style` still accepts everything Pressable accepts, including the
 * function form, so this is a drop-in replacement.
 */
export function Tappable({ style, disabled, ...props }: PressableProps) {
  return (
    <Pressable
      disabled={disabled}
      style={(state) => [
        (typeof style === 'function' ? style(state) : style) as StyleProp<ViewStyle>,
        // A disabled control must not pretend to respond.
        { opacity: state.pressed && !disabled ? PRESSED_OPACITY : 1 },
      ]}
      {...props}
    />
  );
}
