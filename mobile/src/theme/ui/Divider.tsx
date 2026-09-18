import { StyleSheet, View } from 'react-native';
import { useTheme } from '../useTheme';

/**
 * A hairline rule between rows.
 *
 * Eleven screens drew this inline as `borderTopWidth:
 * StyleSheet.hairlineWidth` plus a `borderTopColor` from the theme, and
 * three of them used a full 1px instead, which on a 3x screen is three
 * times heavier than its neighbours. One component, one weight.
 *
 * `inset` indents the rule to the text column, which is what a list of
 * rows with leading icons wants -- a rule running under the icon reads
 * as a table border rather than a separator.
 */
export function Divider({
  inset = 0,
  vertical = false,
}: {
  inset?: number;
  vertical?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      // Decorative: it must not appear in the accessibility tree.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={
        vertical
          ? {
              width: StyleSheet.hairlineWidth,
              alignSelf: 'stretch',
              backgroundColor: colors.border,
            }
          : {
              height: StyleSheet.hairlineWidth,
              marginLeft: inset,
              backgroundColor: colors.border,
            }
      }
    />
  );
}
