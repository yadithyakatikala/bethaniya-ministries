import { StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';
import type { IconName } from './iconShapes';
import { Tappable } from './Tappable';
import { useTheme } from '../useTheme';

/**
 * The one floating action on a screen: a primary pill with a glyph and a
 * word ("+ Ask for prayer", "+ New entry"), 20 from the right edge and 18
 * above the bottom of its container.
 *
 * A word, not a bare "+": an icon alone says nothing aloud and little in
 * Telugu. It is a real button; `disabled` paints it as the design's disabled
 * pill (`disabledSurface` / `disabledInk`) and it stays announced as
 * disabled -- a suspended member sees it and is told why elsewhere on the
 * screen.
 *
 * It is positioned by this component, so the screen only mounts it where
 * it should show: not while the list is loading, not in an empty or error
 * state that carries its own button.
 */
export function FloatingAction({
  label,
  icon = 'plus',
  onPress,
  disabled = false,
  testID,
  bottom = 18,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  bottom?: number;
}) {
  const { colors, layout, radii, type } = useTheme();
  const ink = disabled ? colors.disabledInk : colors.onPrimary;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      <Tappable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={[
          styles.button,
          {
            minHeight: layout.button,
            borderRadius: radii.pill,
            backgroundColor: disabled ? colors.disabledSurface : colors.primary,
          },
        ]}
      >
        <Icon name={icon} size={20} color={ink} />
        <Text style={[type.button, { color: ink }]}>{label}</Text>
      </Tappable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 20, alignItems: 'flex-end' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 22,
  },
});
