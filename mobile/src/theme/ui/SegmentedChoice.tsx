import { StyleSheet, Text, View } from 'react-native';
import { Tappable } from './Tappable';
import { useTheme } from '../useTheme';

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  /** Read after the label by a screen reader -- what choosing this does. */
  hint?: string;
}

/**
 * A row of named choices, one selected.
 *
 * Introduced for M2's two language selectors and promoted out of
 * SettingsScreen in M3, because a select/radio row is a design-system
 * pattern rather than one screen's widget -- M4's reader settings (font
 * size, line height, reading width, theme) are four more of them.
 *
 * DELIBERATELY NOT A SWITCH. Three or more options cannot be expressed
 * by a two-state control, and naming every option beats asking the user
 * to cycle until the one they want appears.
 *
 * SELECTION IS NOT COLOUR-ONLY. The selected option differs by fill AND
 * border weight AND type weight, so it is distinguishable without colour
 * vision, and it reports `accessibilityState.selected` on a `radio`
 * inside a `radiogroup` so a screen reader announces it as a choice.
 *
 * Telugu labels are up to twice their English length ("Events" is
 * "కార్యక్రమాలు"), so the row wraps rather than shrinking the text: the
 * brief's rule is not to solve layout by making Telugu unreadable.
 */
export function SegmentedChoice<T extends string>({
  testID,
  options,
  selected,
  onSelect,
  accessibilityLabel,
}: {
  testID: string;
  options: ChoiceOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  accessibilityLabel?: string;
}) {
  const { colors, radii, type, minTouchTarget } = useTheme();
  return (
    <View
      style={styles.row}
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Tappable
            key={option.value}
            testID={`${testID}-${option.value}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            accessibilityHint={option.hint}
            onPress={() => onSelect(option.value)}
            style={[
              styles.option,
              {
                minHeight: minTouchTarget,
                borderRadius: radii.control,
                backgroundColor: active ? colors.primaryTint : 'transparent',
                // `primary`, not `borderStrong`: the selected chip's
                // border sits on its OWN tinted fill, where borderStrong
                // measures 2.7:1 -- under the 3:1 minimum for a border
                // that carries meaning. `primary` measures ~14:1 there.
                borderColor: active ? colors.primary : colors.border,
                borderWidth: active ? 1.5 : 1,
              },
            ]}
          >
            <Text
              style={[
                active ? type.label : type.body,
                { color: active ? colors.primary : colors.inkMuted },
              ]}
            >
              {option.label}
            </Text>
          </Tappable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 2 },
  option: {
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
});
