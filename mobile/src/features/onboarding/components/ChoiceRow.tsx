import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme, useTypographyFor } from '../../../theme';
import type { LanguagePreference } from '../../../services/firebase/userProfile';

/**
 * One answer among a few, as a whole row.
 *
 * Used for gender and for language: two or three named choices read better
 * as large rows than as chips, and a row is a target nobody misses.
 * Nothing is preselected by the caller unless there is a real current
 * value. SELECTION IS NOT COLOUR-ONLY: a selected row also gets a filled
 * tick in its circle and reports `selected` to a screen reader.
 *
 * A chosen row is marked in INK -- a dark border, a raised ground and an
 * ink-filled circle -- not in gold: gold stays thin (a hairline, a small
 * mark), never a fill or a ground (the approved design's rule S2).
 */
export function ChoiceRow({
  label,
  sublabel,
  selected,
  onPress,
  language,
  hasError = false,
  testID,
}: {
  label: string;
  /** A second line, e.g. the language's own name for itself. */
  sublabel?: string;
  selected: boolean;
  onPress: () => void;
  /** The language the label is set in -- decides the heading face. */
  language: LanguagePreference;
  hasError?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const type = useTypographyFor(language);
  const border = selected ? colors.ink : hasError ? colors.danger : colors.border;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={sublabel ? `${label}, ${sublabel}` : label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor: border,
          backgroundColor: selected ? colors.surfaceRaised : colors.surface,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.text}>
        <Text style={[type.title, { color: colors.ink }]}>{label}</Text>
        {sublabel ? (
          <Text style={[type.caption, { color: colors.inkMuted }]}>{sublabel}</Text>
        ) : null}
      </View>
      <View
        style={[
          styles.radio,
          {
            borderColor: selected ? colors.ink : colors.borderStrong,
            backgroundColor: selected ? colors.ink : 'transparent',
          },
        ]}
      >
        {selected ? (
          <Svg width={14} height={14} viewBox="0 0 14 14">
            <Path
              d="M2.5 7.5l3 3 6-7"
              fill="none"
              stroke={colors.paper}
              strokeWidth={2.3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  text: { flexShrink: 1, gap: 1 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
