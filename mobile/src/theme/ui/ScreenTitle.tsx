import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../useTheme';

/**
 * A top-level screen's own title: the headline (26/32, the serif in English)
 * in a row at least 56 high, with room at the right for the screen's icon
 * buttons ("You" has the bell and the sliders there).
 *
 * The title is a heading, so a screen reader can jump to it; the screens
 * that use it have no navigation header of their own.
 */
export function ScreenTitle({
  title,
  trailing,
  testID,
}: {
  title: string;
  trailing?: ReactNode;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  return (
    <View style={styles.row} testID={testID}>
      <Text
        accessibilityRole="header"
        style={[type.headline, styles.title, { color: colors.ink }]}
      >
        {title}
      </Text>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, minWidth: 0 },
  // The glyphs line up with the margin, not the 44-point buttons around them.
  trailing: { flexDirection: 'row', alignItems: 'center', marginRight: -10 },
});
