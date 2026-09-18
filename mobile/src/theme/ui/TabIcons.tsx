import { StyleSheet, View } from 'react-native';
import { ICON_SIZE, strokeFor, type IconProps } from './iconGeometry';

/**
 * The five bottom-navigation glyphs, drawn from plain Views.
 *
 * WHY NOT AN ICON LIBRARY. Checked first, as required: this project has
 * no icon or SVG dependency -- no `@expo/vector-icons`, no
 * `react-native-svg`, not even transitively. Adding an icon font for five
 * 22dp glyphs would ship a native asset and a new release-build surface
 * for something the app can draw itself, so these follow the idiom
 * already established by ./FeatureIcons.tsx and by MoreScreen's
 * disclosure chevron (two borders on a rotated View).
 *
 * Deliberately NOT emoji: emoji render as the platform's own multicolour
 * artwork, cannot take a theme colour, and look nothing like each other
 * across Android versions.
 *
 * Every glyph takes its `color` from the caller, so the tab bar passes
 * `colors.primary` when selected and `colors.inkMuted` when not, and both
 * palettes are correct without these components knowing about either.
 * Each is sized on a square `size` box so all five sit on one baseline.
 */
const DEFAULT_SIZE = ICON_SIZE;

/** A house: a triangular roof over a square body. */
export function HomeIcon({ color, size = DEFAULT_SIZE, filled = false }: IconProps) {
  const stroke = strokeFor(size);
  const roof = size * 0.5;
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      {/* Roof: a CSS triangle via transparent side borders. */}
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: roof,
          borderRightWidth: roof,
          borderBottomWidth: roof * 0.72,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: color,
        }}
      />
      <View
        style={{
          width: size * 0.62,
          height: size * 0.42,
          borderWidth: stroke,
          borderTopWidth: 0,
          borderColor: color,
          backgroundColor: filled ? color : 'transparent',
        }}
      />
    </View>
  );
}

/** An open book: two leaves with a spine between them. */
export function BookIcon({ color, size = DEFAULT_SIZE, filled = false }: IconProps) {
  const stroke = strokeFor(size);
  const leaf = { width: size * 0.42, height: size * 0.66 };
  return (
    <View style={[styles.box, styles.row, { width: size, height: size }]}>
      <View
        style={{
          ...leaf,
          borderWidth: stroke,
          borderRightWidth: 0,
          borderColor: color,
          borderTopLeftRadius: size * 0.1,
          borderBottomLeftRadius: size * 0.1,
          backgroundColor: filled ? color : 'transparent',
        }}
      />
      {/* Spine */}
      <View style={{ width: stroke, height: leaf.height, backgroundColor: color }} />
      <View
        style={{
          ...leaf,
          borderWidth: stroke,
          borderLeftWidth: 0,
          borderColor: color,
          borderTopRightRadius: size * 0.1,
          borderBottomRightRadius: size * 0.1,
          backgroundColor: filled ? color : 'transparent',
        }}
      />
    </View>
  );
}

/**
 * A quaver -- Songs.
 *
 * REDRAWN IN M3. Visual QA called the V1 geometry weak, and it was: the
 * head was an OUTLINED circle of 0.34 x size, so at 22dp a 7.5dp circle
 * carried a 1.8dp border and read as a ring rather than a note head;
 * the flag was a straight horizontal bar, which is a flagpole, not a
 * quaver's flag; and the head sat square rather than tilted, so the
 * whole glyph looked like a corner bracket with a dot.
 *
 * Three fixes. The head is FILLED (an outlined note head is not a note
 * head at this size) and tilted -20 degrees, which is what makes it read
 * as a note rather than a bullet. The flag is built from a box with only
 * its top and right borders and a large top-right radius, which curves
 * away from the stem the way a real flag does. And the stem is inset
 * from the glyph box so the flag's curve has room, instead of being
 * clipped at the edge.
 *
 * The head follows the same active/inactive rule as the rest of the set:
 * solid when the tab is selected, an outlined ring when it is not. At
 * 0.38 x size the ring has enough interior to read as one, which the
 * 0.34 version did not.
 */
export function MusicIcon({ color, size = DEFAULT_SIZE, filled = false }: IconProps) {
  const stroke = strokeFor(size);
  const head = size * 0.38;
  const stemHeight = size * 0.66;
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={{ width: size * 0.78, height: size * 0.86 }}>
        {/* Stem */}
        <View
          style={{
            position: 'absolute',
            right: size * 0.14,
            top: 0,
            width: stroke,
            height: stemHeight,
            backgroundColor: color,
            borderRadius: stroke / 2,
          }}
        />
        {/* Flag: a curve hooking down and away from the top of the stem. */}
        <View
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: size * 0.28,
            height: size * 0.3,
            borderTopWidth: stroke,
            borderRightWidth: stroke,
            borderColor: color,
            borderTopRightRadius: size * 0.26,
          }}
        />
        {/* Note head, tilted. */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: head,
            height: head * 0.76,
            borderRadius: head / 2,
            borderWidth: filled ? 0 : stroke,
            borderColor: color,
            backgroundColor: filled ? color : 'transparent',
            transform: [{ rotate: '-20deg' }],
          }}
        />
      </View>
    </View>
  );
}

/** A calendar: a page with two binding tabs and a header rule. */
export function CalendarIcon({ color, size = DEFAULT_SIZE, filled = false }: IconProps) {
  const stroke = strokeFor(size);
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      {/* Binding tabs */}
      <View style={[styles.row, { width: size * 0.62, justifyContent: 'space-between' }]}>
        <View style={{ width: stroke, height: size * 0.14, backgroundColor: color }} />
        <View style={{ width: stroke, height: size * 0.14, backgroundColor: color }} />
      </View>
      <View
        style={{
          width: size * 0.82,
          height: size * 0.66,
          borderWidth: stroke,
          borderColor: color,
          borderRadius: size * 0.1,
          overflow: 'hidden',
        }}
      >
        {/* Header rule -- always filled, so the shape reads as a calendar
            rather than a plain box even when unselected. */}
        <View style={{ height: size * 0.16, backgroundColor: color }} />
        {filled ? (
          <View style={{ flex: 1, backgroundColor: color, opacity: 0.35 }} />
        ) : null}
      </View>
    </View>
  );
}

/** Three stacked rules -- the conventional "more" affordance. */
export function MoreIcon({ color, size = DEFAULT_SIZE, filled = false }: IconProps) {
  const stroke = strokeFor(size);
  const bar = (width: number, key: string) => (
    <View
      key={key}
      style={{
        width,
        height: stroke,
        backgroundColor: color,
        borderRadius: stroke / 2,
      }}
    />
  );
  return (
    <View
      style={[
        styles.box,
        { width: size, height: size, justifyContent: 'center', gap: size * 0.16 },
      ]}
    >
      {bar(size * 0.78, 'top')}
      {bar(size * 0.78, 'middle')}
      {/* The last rule shortens when unselected, so selected/unselected
          differ in shape as well as in colour. */}
      {bar(filled ? size * 0.78 : size * 0.5, 'bottom')}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'flex-end' },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
});
