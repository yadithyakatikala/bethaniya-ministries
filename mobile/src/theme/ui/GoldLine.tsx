import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { brandGold } from '../tokens';
import { useTheme } from '../useTheme';

/**
 * Gold, kept thin: the places the brand's metal appears as a LINE.
 *
 * The design's rule is that gold is lines, small text and brand marks --
 * never a fill, a background or an icon colour. These are the lines:
 *
 *   GoldRule    a hairline under a section's label, fading out to the right
 *               ("the page's gold thread" above the Verse of the Day)
 *   GoldBar     a vertical bar standing beside a quoted block or the row that
 *               says where you left off (3 across; a Prophet Verse's is 2)
 *   GoldFill    the filled part of a 3-point progress line
 *   GoldRibbon  the tab bar's marker over the selected tab
 *   GoldThread  the short line under the portrait on the loading screen,
 *               fading out at BOTH ends
 *
 * They are the same five-stop metal the opening writes the name in, drawn
 * as a gradient by react-native-svg (already bundled), so there is no
 * image file and the stops follow the active palette. All three are
 * decorative and hidden from the accessibility tree: a line carries no
 * words.
 */
function Gradient({
  id,
  direction,
  stops,
}: {
  id: string;
  direction: 'horizontal' | 'vertical';
  stops: { offset: number; color: string; opacity?: number }[];
}) {
  return (
    <Defs>
      <LinearGradient
        id={id}
        x1="0"
        y1="0"
        x2={direction === 'horizontal' ? '1' : '0'}
        y2={direction === 'horizontal' ? '0' : '1'}
      >
        {stops.map((stop) => (
          <Stop
            key={stop.offset}
            offset={stop.offset}
            stopColor={stop.color}
            stopOpacity={stop.opacity ?? 1}
          />
        ))}
      </LinearGradient>
    </Defs>
  );
}

function gradientId(prefix: string, raw: string): string {
  return prefix + raw.replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * A 1-point rule, the full width of its container, fading out to the right.
 *
 * `tone="photo"` is for a rule drawn over a photograph's dark veil: it takes
 * the NIGHT palette's brighter metal whatever the active theme, because the
 * daytime gold (a dark brown) would vanish on a dark veil.
 *
 * It sits in a View of its own so it is a positioned sibling like every
 * other piece of the card: an unpositioned SVG can be painted UNDER a
 * positioned veil on the web, and the web is where this is checked.
 */
export function GoldRule({
  tone = 'page',
  testID,
}: {
  tone?: 'page' | 'photo';
  testID?: string;
}) {
  const { gold } = useTheme();
  const metal = tone === 'photo' ? brandGold.dark : gold;
  const id = gradientId('gr', useId());
  return (
    <View
      style={styles.rule}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      <Svg width="100%" height={1} viewBox="0 0 100 1" preserveAspectRatio="none">
        <Gradient
          id={id}
          direction="horizontal"
          stops={[
            { offset: 0, color: metal.base },
            { offset: 0.38, color: metal.high },
            { offset: 0.7, color: metal.base },
            { offset: 1, color: metal.base, opacity: 0 },
          ]}
        />
        <Rect x="0" y="0" width="100" height="1" fill={`url(#${id})`} opacity={0.9} />
      </Svg>
    </View>
  );
}

/**
 * A vertical bar as tall as the row it stands in (`alignSelf: stretch`),
 * brightest at the top and deepest at the foot, with rounded ends.
 */
export function GoldBar({
  width = 3,
  testID,
}: {
  /** Across, in points. A Prophet Verse's is 2; a reading position's is 3. */
  width?: number;
  testID?: string;
}) {
  const { gold } = useTheme();
  const id = gradientId('gb', useId());
  return (
    <View
      testID={testID}
      style={[styles.bar, { width, borderRadius: width }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 1 100"
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
      >
        <Gradient
          id={id}
          direction="vertical"
          stops={[
            { offset: 0, color: gold.high },
            { offset: 0.55, color: gold.base },
            { offset: 1, color: gold.rim },
          ]}
        />
        <Rect x="0" y="0" width="1" height="100" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/**
 * The filled part of a 3-point progress line: it fills its own box, so the
 * caller sets the width (a percentage) and this paints the metal in it.
 */
export function GoldFill({ testID }: { testID?: string }) {
  const { gold } = useTheme();
  const id = gradientId('gf', useId());
  return (
    <View
      testID={testID}
      style={styles.fill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 1"
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
      >
        <Gradient
          id={id}
          direction="horizontal"
          stops={[
            { offset: 0, color: gold.base },
            { offset: 1, color: gold.high },
          ]}
        />
        <Rect x="0" y="0" width="100" height="1" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/**
 * The ribbon that hangs from the top edge of the tab bar over the selected
 * tab: 24 across, 4 down, square at the top (it comes out of the edge) and
 * rounded at the foot, in the metal's base-high-base run.
 */
export function GoldRibbon({ testID }: { testID?: string }) {
  const { gold } = useTheme();
  const id = gradientId('gl', useId());
  return (
    <View
      testID={testID}
      style={styles.ribbon}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 1"
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
      >
        <Gradient
          id={id}
          direction="horizontal"
          stops={[
            { offset: 0, color: gold.base },
            { offset: 0.5, color: gold.high },
            { offset: 1, color: gold.base },
          ]}
        />
        <Rect x="0" y="0" width="100" height="1" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/**
 * A short line that fades out at both ends and is brightest in the middle:
 * the loading screen's, under the portrait (132 across, 2 down).
 */
export function GoldThread({
  width = 132,
  height = 2,
  testID,
}: {
  width?: number;
  height?: number;
  testID?: string;
}) {
  const { gold } = useTheme();
  const id = gradientId('gt', useId());
  return (
    <View
      testID={testID}
      style={{ width, height }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 1" preserveAspectRatio="none">
        <Gradient
          id={id}
          direction="horizontal"
          stops={[
            { offset: 0, color: gold.base, opacity: 0 },
            { offset: 0.22, color: gold.base },
            { offset: 0.5, color: gold.high },
            { offset: 0.78, color: gold.base },
            { offset: 1, color: gold.base, opacity: 0 },
          ]}
        />
        <Rect x="0" y="0" width="100" height="1" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  ribbon: {
    width: 24,
    height: 4,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    overflow: 'hidden',
  },
  rule: { height: 1 },
  bar: { alignSelf: 'stretch', overflow: 'hidden' },
  fill: { flex: 1, overflow: 'hidden' },
});
