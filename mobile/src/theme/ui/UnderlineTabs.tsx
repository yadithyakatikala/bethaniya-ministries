import { StyleSheet, Text, View } from 'react-native';
import { Tappable } from './Tappable';
import { useTheme } from '../useTheme';

export interface TabOption<T extends string> {
  value: T;
  label: string;
  testID?: string;
}

/**
 * Sections inside a screen: "Requests | My journal", "Updates | Chat".
 *
 * The chosen tab is INK with a 2 pt ink underline; the others are muted
 * words. Gold is not used here -- gold is for meaning, and "you are on
 * this tab" is not one. Selection is never colour alone: weight and the
 * underline say it too, and each tab is announced as a tab with its
 * selected state ("Requests, tab 1 of 2, selected").
 *
 * The tabs share the width equally and each is at least 44 high. A long
 * Telugu label wraps within its tab; it does not shrink.
 */
export function UnderlineTabs<T extends string>({
  tabs,
  selected,
  onSelect,
  testID,
}: {
  tabs: TabOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  testID?: string;
}) {
  const { colors, type, minTouchTarget } = useTheme();
  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      style={[styles.row, { borderBottomColor: colors.border }]}
    >
      {tabs.map((tab) => {
        const active = tab.value === selected;
        return (
          <Tappable
            key={tab.value}
            testID={tab.testID ?? (testID ? `${testID}-${tab.value}` : undefined)}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(tab.value)}
            style={[
              styles.tab,
              {
                minHeight: minTouchTarget,
                borderBottomColor: active ? colors.ink : 'transparent',
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
              {tab.label}
            </Text>
          </Tappable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderBottomWidth: 1 },
  // The 2 pt underline overlaps the row's hairline, so a chosen tab "sits" on it.
  tab: {
    flex: 1,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    marginBottom: -1,
  },
  label: { textAlign: 'center' },
});
