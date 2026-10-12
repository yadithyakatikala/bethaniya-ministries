import { useId, useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { contentFontFamily, useTheme, useTypographyFor } from '../../../theme';
import type { LanguagePreference } from '../../../services/firebase/userProfile';

/**
 * The line a typed answer sits on.
 *
 * Idle it is a hairline in the strong border colour; focused it becomes the
 * brand's gold, thicker; with an error it turns to the danger colour. The
 * error is ALSO a sentence under the field -- colour alone never says what
 * is wrong.
 */
function Underline({
  focused,
  error,
  bottom,
}: {
  focused: boolean;
  error: boolean;
  /** How far above the bottom of the row the line sits. */
  bottom: number;
}) {
  const { colors, gold } = useTheme();
  const id = 'ul' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const place = { bottom };
  if (error)
    return (
      <View
        pointerEvents="none"
        style={[styles.line, place, { height: 2, backgroundColor: colors.danger }]}
      />
    );
  if (!focused) {
    return (
      <View
        pointerEvents="none"
        style={[
          styles.line,
          place,
          { height: 1.5, backgroundColor: colors.borderStrong },
        ]}
      />
    );
  }
  return (
    <Svg
      pointerEvents="none"
      width="100%"
      height={3}
      viewBox="0 0 100 3"
      preserveAspectRatio="none"
      style={[styles.line, place]}
    >
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={gold.base} />
          <Stop offset="0.38" stopColor={gold.high} />
          <Stop offset="0.55" stopColor={gold.dust[3]} />
          <Stop offset="1" stopColor={gold.base} />
        </LinearGradient>
      </Defs>
      <Rect width={100} height={3} rx={1.5} fill={`url(#${id})`} />
    </Svg>
  );
}

/**
 * A typed answer, set large in the heading face on a single line.
 *
 * The typed text takes its face from what was typed (a name in Latin is
 * set in the English serif, in Telugu in the Telugu serif, in both in the
 * interface face, which has both) so no letter is ever dropped to a
 * system font. `variant="age"` is the one big number.
 */
export function AnswerInput({
  value,
  onChangeText,
  placeholder,
  language,
  error,
  variant = 'text',
  unit,
  testID,
  accessibilityLabel,
  ...inputProps
}: Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
  language: LanguagePreference;
  /** The sentence shown under the field, or null. */
  error?: string | null;
  variant?: 'text' | 'age';
  /** A word after the number: "years old". */
  unit?: string;
  testID: string;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  const type = useTypographyFor(language);
  const [focused, setFocused] = useState(false);
  const big = variant === 'age';
  const family = contentFontFamily(value, { weight: 'semiBold', fallback: language });

  // The line is drawn by the row, not by the input: the age is a number and a
  // word ("34  years old") and the line runs under both, as the design draws it.
  return (
    <View>
      <View style={big ? styles.ageRow : styles.field}>
        <View style={big ? styles.ageField : styles.fieldFill}>
          <TextInput
            {...inputProps}
            testID={testID}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.inkSubtle}
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ disabled: inputProps.editable === false }}
            aria-invalid={Boolean(error)}
            underlineColorAndroid="transparent"
            onFocus={(event) => {
              setFocused(true);
              inputProps.onFocus?.(event);
            }}
            onBlur={(event) => {
              setFocused(false);
              inputProps.onBlur?.(event);
            }}
            style={[
              styles.input,
              big ? styles.ageInput : styles.textInput,
              { fontFamily: family, color: colors.ink },
            ]}
          />
        </View>
        {big && unit ? (
          <Text style={[type.bodyLarge, styles.unit, { color: colors.inkMuted }]}>
            {unit}
          </Text>
        ) : null}
        <Underline focused={focused} error={Boolean(error)} bottom={big ? 6 : 4} />
      </View>
      {error ? (
        <Text
          testID={`${testID}-error`}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[type.bodySmall, styles.error, { color: colors.danger }]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { height: 60, justifyContent: 'flex-end' },
  fieldFill: { justifyContent: 'flex-end' },
  ageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 14, height: 84 },
  ageField: { width: 92, height: 84, justifyContent: 'flex-end' },
  input: { padding: 0, margin: 0, includeFontPadding: false },
  textInput: {
    height: 54,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.2,
    fontWeight: '600',
  },
  ageInput: {
    height: 72,
    fontSize: 56,
    lineHeight: 64,
    letterSpacing: -1,
    fontWeight: '600',
  },
  line: { position: 'absolute', left: 0, right: 0, borderRadius: 2 },
  unit: { paddingBottom: 20 },
  error: { marginTop: 8 },
});
