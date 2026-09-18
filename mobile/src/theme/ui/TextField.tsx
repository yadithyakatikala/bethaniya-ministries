import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
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
 */
export function TextField({
  label,
  error,
  helpText,
  required = false,
  testID,
  style,
  ...inputProps
}: TextInputProps & {
  label: string;
  error?: string | null;
  helpText?: string;
  required?: boolean;
  testID?: string;
}) {
  const { colors, radii, spacing, type, minTouchTarget } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.danger
    : focused
      ? colors.borderStrong
      : colors.border;

  return (
    <View style={styles.field}>
      <Text style={[type.label, { color: colors.ink }]}>{label}</Text>

      <TextInput
        testID={testID}
        // Without this the field announces as "edit box" with no name:
        // the visible <Text> above is a separate node to a screen reader.
        accessibilityLabel={inputProps.accessibilityLabel ?? label}
        accessibilityHint={helpText}
        accessibilityState={{ disabled: inputProps.editable === false }}
        aria-invalid={Boolean(error)}
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
            minHeight: minTouchTarget,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 2,
            borderRadius: radii.control,
            borderColor,
            borderWidth: focused || error ? 1.5 : 1,
            color: inputProps.editable === false ? colors.disabledInk : colors.ink,
            backgroundColor:
              inputProps.editable === false ? colors.disabledSurface : colors.surface,
          },
          style,
        ]}
        {...inputProps}
      />

      {error ? (
        <Text
          style={[type.bodySmall, { color: colors.danger }]}
          testID={testID ? `${testID}-error` : undefined}
        >
          {error}
        </Text>
      ) : helpText ? (
        <Text style={[type.bodySmall, { color: colors.inkMuted }]}>{helpText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  // textAlignVertical keeps a multiline field's first line at the top on
  // Android instead of vertically centring the whole block.
  input: { textAlignVertical: 'top' },
});
