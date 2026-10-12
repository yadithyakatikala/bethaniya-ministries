import { StyleSheet, Text } from 'react-native';
import { Tappable } from './Tappable';
import { useTheme } from '../useTheme';

/**
 * A chip: a filter or a category you can choose. A pill, 36 high, with a
 * 44-point hit area.
 *
 * Chosen = the ink fill with the on-ink label (never gold: gold stays
 * thin). Not chosen = a hairline outline on the page. The chosen state
 * is announced (`selected`) and differs in fill, not only colour hue, so
 * it reads without colour vision.
 *
 * A label is words, never an icon alone; a long Telugu label wraps the
 * chip's text, it does not shrink.
 */
export function Chip({
  label,
  selected = false,
  onPress,
  testID,
  accessibilityHint,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
  accessibilityHint?: string;
}) {
  const { colors, radii, type } = useTheme();
  return (
    <Tappable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      // 36 high, but a finger gets 44.
      hitSlop={{ top: 4, bottom: 4 }}
      style={[
        styles.chip,
        {
          borderRadius: radii.pill,
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text
        style={[type.label, { color: selected ? colors.onPrimary : colors.ink }]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
});
