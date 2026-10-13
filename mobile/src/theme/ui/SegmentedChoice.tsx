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
 * Two or three views of the same thing, one chosen: a pill track with a
 * thumb.
 *
 * Introduced for M2's two language selectors and promoted out of
 * SettingsScreen in M3, because a select/radio row is a design-system
 * pattern rather than one screen's widget -- M4's reader settings (font
 * size, line height, reading width, theme) are four more of them.
 *
 * THE LOOK (the approved system): the track is a pill in the secondary
 * background; the chosen option is a thumb -- a surface with a hairline --
 * and the others are bare words on the track.
 *
 * DELIBERATELY NOT A SWITCH. Three or more options cannot be expressed
 * by a two-state control, and naming every option beats asking the user
 * to cycle until the one they want appears.
 *
 * SELECTION IS NOT COLOUR-ONLY. The chosen option differs by surface AND
 * hairline AND type weight, so it is distinguishable without colour
 * vision, and it reports `accessibilityState.selected` on a `radio`
 * inside a `radiogroup` so a screen reader announces it as a choice.
 *
 * Telugu labels are up to twice their English length ("Events" is
 * "కార్యక్రమాలు"), so the track wraps rather than shrinking the text: the
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
  /** `null` when nothing is chosen yet (a report's reason: none is assumed). */
  selected: T | null;
  onSelect: (value: T) => void;
  accessibilityLabel?: string;
}) {
  const { colors, radii, type, minTouchTarget } = useTheme();

  // More than three words do not fit a track as one row of thumbs: they are
  // a group of chips instead (a report's reasons), still one radiogroup.
  if (options.length > MAX_TRACK_OPTIONS) {
    return (
      <View
        style={styles.chips}
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
                styles.chip,
                {
                  minHeight: minTouchTarget,
                  borderRadius: radii.pill,
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderColor: active ? colors.primary : colors.border,
                  borderWidth: active ? 1.5 : 1,
                },
              ]}
            >
              <Text
                style={[type.label, { color: active ? colors.onPrimary : colors.ink }]}
              >
                {option.label}
              </Text>
            </Tappable>
          );
        })}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.track,
        { backgroundColor: colors.surfaceRaised, borderRadius: radii.pill },
      ]}
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
                borderRadius: radii.pill,
                // The thumb: a surface with a hairline. Bare words otherwise.
                backgroundColor: active ? colors.surface : 'transparent',
                borderColor: active ? colors.border : 'transparent',
                borderWidth: active ? 1 : 0,
              },
            ]}
          >
            <Text
              style={[
                active ? type.button : type.body,
                styles.label,
                { color: active ? colors.ink : colors.inkMuted },
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

/** A track holds two or three views of one thing; beyond that it is chips. */
const MAX_TRACK_OPTIONS = 3;

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, justifyContent: 'center' },
  track: { flexDirection: 'row', flexWrap: 'wrap', padding: 3, gap: 2 },
  option: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 96,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { textAlign: 'center' },
});
