import { StyleSheet, View } from 'react-native';

/**
 * A bell, drawn from plain Views.
 *
 * WHY NOT AN ICON LIBRARY. This project has no icon or SVG dependency --
 * not `@expo/vector-icons`, not `react-native-svg`, not even
 * transitively (checked against package.json and node_modules). The
 * design language is text-led by choice: the tab bar uses words, badges
 * use words, and the one existing glyph -- the disclosure chevron in
 * ../../features/more/MoreScreen.tsx -- is itself two borders on a
 * rotated View. Pulling in a whole icon font to draw one bell would add
 * a native asset and a release-build surface for a single 16dp glyph, so
 * this follows the idiom that is already here.
 *
 * Three parts: the dome (a bordered box with its top corners fully
 * rounded), the rim beneath it, and the clapper below that. `color` is
 * passed in from the theme by the caller, so the icon is correct in both
 * palettes without knowing anything about them.
 */
export function BellIcon({ color, size = 18 }: { color: string; size?: number }) {
  // Everything is expressed as a fraction of `size` so the proportions
  // hold if a caller asks for a different one.
  const domeWidth = size * 0.72;
  const domeHeight = size * 0.6;
  const stroke = Math.max(1.5, size * 0.09);

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      // Decorative: the Pressable that wraps this carries the real
      // accessibilityLabel, so the icon must not be a second thing for a
      // screen reader to land on and read out.
      accessible={false}
      importantForAccessibility="no"
    >
      <View
        style={{
          width: domeWidth,
          height: domeHeight,
          borderWidth: stroke,
          borderBottomWidth: 0,
          borderColor: color,
          borderTopLeftRadius: domeWidth / 2,
          borderTopRightRadius: domeWidth / 2,
        }}
      />
      <View
        style={{
          width: size * 0.94,
          height: stroke,
          backgroundColor: color,
          borderRadius: stroke / 2,
        }}
      />
      <View
        style={{
          width: size * 0.28,
          height: size * 0.16,
          marginTop: size * 0.08,
          backgroundColor: color,
          borderBottomLeftRadius: size * 0.14,
          borderBottomRightRadius: size * 0.14,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
});
