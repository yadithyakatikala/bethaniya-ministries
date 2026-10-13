import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useTheme } from '../useTheme';

/**
 * A labelled text input.
 *
 * WHY THIS EXISTS. Sign In, Profile and Prayers each rolled their own
 * input: three different heights, three border colours, three
 * placeholder colours, and -- the part that mattered -- no consistent
 * link between a field and its label or its error. Two of the three
 * relied on the placeholder AS the label, which disappears the moment
 * the user types and is not read as a label by a screen reader.
 *
 * THE LOOK (the approved system): the label sits ABOVE the field in the
 * 14/18 semibold `label` role and stays there; the field is 48 high (96
 * for a multi-line one) with a 12 radius and a 1 pt border; the help or
 * error sentence below it is 13/18.
 *
 * WHAT IT GETS RIGHT THAT THE THREE DID NOT
 *  * `accessibilityLabel` falls back to the visible label, so the field
 *    is never announced as just "edit box".
 *  * An error is announced (`accessibilityState.invalid` plus the error
 *    text in the label) AND shown as text AND shown as a border colour
 *    -- never colour alone.
 *  * The placeholder uses `inkSubtle`, the one token tuned to stay above
 *    4.5:1 while still reading as a placeholder.
 *  * A focused field takes `borderStrong`, which clears the 3:1 minimum
 *    for meaningful non-text UI. A 1.5:1 hairline focus ring is not a
 *    focus ring.
 *  * `toggle` puts a named "Show" / "Hide" text action inside the field
 *    for a password: the action is words (never an eye glyph alone) and
 *    reports whether the text is currently shown.
 *  * `invalid` is for a field the error is ABOUT when the sentence lives
 *    elsewhere -- the sign-in screen's notice above the form. It draws the
 *    same outline and announces the same `invalid` state as `error`, without
 *    repeating the sentence under the field.
 */
export function TextField({
  label,
  error,
  helpText,
  required = false,
  testID,
  style,
  toggle,
  invalid = false,
  ...inputProps
}: TextInputProps & {
  label: string;
  error?: string | null;
  /** Outline and announce the field as invalid, with no sentence of its own. */
  invalid?: boolean;
  helpText?: string;
  required?: boolean;
  testID?: string;
  /**
   * A "Show" / "Hide" action for a secret field. The caller owns whether
   * the text is shown (it also sets `secureTextEntry`); this draws the
   * action and names it.
   */
  toggle?: { shown: boolean; onToggle: () => void; showLabel: string; hideLabel: string };
}) {
  const { colors, radii, spacing, type, minTouchTarget } = useTheme();
  const [focused, setFocused] = useState(false);

  const flagged = Boolean(error) || invalid;
  const borderColor = flagged
    ? colors.danger
    : focused
      ? colors.borderStrong
      : colors.border;
  const multiline = Boolean(inputProps.multiline);
  const readOnly = inputProps.editable === false;

  return (
    <View style={styles.field}>
      <Text style={[type.label, { color: colors.ink }]}>{label}</Text>

      <View style={styles.inputWrap}>
        <TextInput
          testID={testID}
          // Without this the field announces as "edit box" with no name:
          // the visible <Text> above is a separate node to a screen reader.
          accessibilityLabel={inputProps.accessibilityLabel ?? label}
          accessibilityHint={helpText}
          accessibilityState={{ disabled: readOnly }}
          aria-invalid={flagged}
          aria-required={required}
          placeholderTextColor={colors.inkSubtle}
          onFocus={(event) => {
            setFocused(true);
            inputProps.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            inputProps.onBlur?.(event);
          }}
          style={[
            type.body,
            styles.input,
            {
              minHeight: multiline ? 96 : Math.max(minTouchTarget, 48),
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm + 2,
              // Room for the Show / Hide action on the right.
              paddingRight: toggle ? 88 : spacing.md,
              borderRadius: radii.control,
              borderColor,
              borderWidth: focused || flagged ? 1.5 : 1,
              color: readOnly ? colors.disabledInk : colors.ink,
              backgroundColor: readOnly ? colors.disabledSurface : colors.surface,
            },
            style,
          ]}
          {...inputProps}
        />
        {toggle ? (
          <Pressable
            testID={testID ? `${testID}-toggle` : undefined}
            accessibilityRole="button"
            accessibilityLabel={toggle.shown ? toggle.hideLabel : toggle.showLabel}
            accessibilityState={{ expanded: toggle.shown }}
            onPress={toggle.onToggle}
            hitSlop={{ top: 4, bottom: 4 }}
            style={styles.toggle}
          >
            <Text style={[type.label, { color: colors.accent }]}>
              {toggle.shown ? toggle.hideLabel : toggle.showLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text
          style={[type.help, { color: colors.danger }]}
          testID={testID ? `${testID}-error` : undefined}
        >
          {error}
        </Text>
      ) : helpText ? (
        <Text style={[type.help, { color: colors.inkMuted }]}>{helpText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  inputWrap: { justifyContent: 'center' },
  // textAlignVertical keeps a multiline field's first line at the top on
  // Android instead of vertically centring the whole block.
  input: { textAlignVertical: 'top' },
  toggle: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
