import { StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Tappable } from './Tappable';
import { useTheme } from '../useTheme';
import { fontFamilies } from '../tokens';

/**
 * A sheet of choices for one setting: what it is and what it does not change,
 * then one row per choice with the current one ticked. The choice closes the
 * sheet; the tick says which is in force without relying on colour.
 */
export function ChoiceSheet({
  visible,
  testID,
  title,
  help,
  closeLabel,
  options,
  current,
  optionTestID,
  onClose,
  onChoose,
}: {
  visible: boolean;
  testID: string;
  title: string;
  help: string;
  closeLabel: string;
  options: { value: string; label: string }[];
  current: string;
  optionTestID: (value: string) => string;
  onClose: () => void;
  onChoose: (value: string) => void;
}) {
  const { colors, type } = useTheme();
  return (
    <Sheet
      visible={visible}
      testID={testID}
      title={title}
      closeLabel={closeLabel}
      onClose={onClose}
    >
      <Text style={[type.bodySmall, { color: colors.inkMuted }]}>{help}</Text>
      <View accessibilityRole="radiogroup">
        <View style={[styles.rule, { borderTopColor: colors.border }]} />
        {options.map((option) => {
          const chosen = option.value === current;
          return (
            <Tappable
              key={option.value}
              testID={optionTestID(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: chosen }}
              accessibilityLabel={option.label}
              onPress={() => onChoose(option.value)}
              style={[styles.choice, { borderBottomColor: colors.border }]}
            >
              <Text
                style={[
                  styles.choiceLabel,
                  { color: colors.ink },
                  chosen && styles.choiceChosen,
                ]}
              >
                {option.label}
              </Text>
              {chosen ? <Icon name="check" size={22} color={colors.ink} /> : null}
            </Tappable>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  rule: { borderTopWidth: 1 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    minHeight: 56,
    borderBottomWidth: 1,
  },
  choiceLabel: {
    flex: 1,
    fontFamily: fontFamilies.interfaceRegular,
    fontSize: 16,
    lineHeight: 22,
  },
  // The chosen one is also bolder, so the tick is not the only sign.
  choiceChosen: { fontFamily: fontFamilies.interfaceSemiBold, fontWeight: '600' },
});
