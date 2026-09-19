import { StyleSheet, View } from 'react-native';
import { ICON_SIZE, strokeFor, type IconProps } from './iconGeometry';

/**
 * Icons for Home's utility actions and its feature tiles, drawn from
 * plain Views.
 *
 * WHY NOT AN ICON LIBRARY. Same reason as ./TabIcons.tsx, which these
 * follow: this project has no icon or SVG
 * dependency -- not `@expo/vector-icons`, not `react-native-svg`, not
 * even transitively. Deliberately NOT emoji either: emoji render as the
 * platform's own multicolour artwork, cannot take a theme colour, and
 * differ across Android versions.
 *
 * Every glyph takes `color` from the caller, so the same component is
 * correct in both palettes without knowing about either. That is the
 * fix for the "almost invisible dot" the tester saw in the top right of
 * Home: the old control was an 8px dot painted in `colors.primary`,
 * which on the dark paper background read as a speck rather than a
 * button.
 *
 * M3 moved the size and stroke to ./iconGeometry.ts, shared with
 * ./TabIcons.tsx. These two sets sit directly above each other on Home
 * and had drifted to two default sizes and four stroke ratios between
 * them, which is visible as an uneven weight along that edge of the
 * screen.
 */
const DEFAULT_SIZE = ICON_SIZE;

/** A head over shoulders -- Profile. */
export function PersonIcon({ color, size = DEFAULT_SIZE }: IconProps) {
  const stroke = strokeFor(size);
  const head = size * 0.38;
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={{
          width: head,
          height: head,
          borderRadius: head / 2,
          borderWidth: stroke,
          borderColor: color,
        }}
      />
      {/* Shoulders: a wide box with only its top corners rounded, so it
          reads as a torso rather than a bar. */}
      <View
        style={{
          width: size * 0.74,
          height: size * 0.34,
          marginTop: size * 0.08,
          borderWidth: stroke,
          borderBottomWidth: 0,
          borderColor: color,
          borderTopLeftRadius: size * 0.37,
          borderTopRightRadius: size * 0.37,
        }}
      />
    </View>
  );
}

/**
 * A speech bubble -- Announcements.
 *
 * Deliberately NOT a bell. Announcements and Notifications are
 * different destinations -- Announcements is church-published content in
 * Firestore, Notifications is this device's own local delivery history --
 * so they must not share a glyph. (A BellIcon component did exist for
 * Home's old notifications button; Home's top-right is now Profile +
 * Announcements per the owner's spec, and Notifications is reached from
 * More, so the bell had no remaining call site and was removed rather
 * than left as dead code. The FEATURE is untouched.)
 */
export function AnnouncementIcon({ color, size = DEFAULT_SIZE }: IconProps) {
  const stroke = strokeFor(size);
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={{
          width: size * 0.9,
          height: size * 0.66,
          borderWidth: stroke,
          borderColor: color,
          borderRadius: size * 0.2,
        }}
      />
      {/* Tail, bottom-left, pointing down-left. */}
      <View
        style={{
          width: size * 0.22,
          height: size * 0.22,
          marginTop: -size * 0.11,
          marginRight: size * 0.34,
          borderRightWidth: stroke,
          borderBottomWidth: stroke,
          borderColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

/**
 * Praying hands -- Prayers.
 *
 * REDRAWN IN M3. The V1 glyph was two outlined bars leaning together
 * over a rule, and visual QA reported exactly that: it did not read as
 * praying hands. Two things were wrong.
 *
 * First, it was OUTLINED at 0.2 x size. At the 20dp this renders at, a
 * 4dp-wide box with a 1.7dp border leaves a 0.6dp sliver of interior --
 * optically a solid bar with a seam, not a hand. These palms are FILLED,
 * which is the deliberate exception to the outline idiom the rest of the
 * set follows: below about 24dp a filled silhouette is the only thing
 * that reads. Nothing else in the set is this narrow, so nothing else
 * needs the exception.
 *
 * Second, it had no apex. Praying hands are recognised by the point
 * where the fingertips meet and by the wrists splaying below it. Each
 * palm is now rotated 15 degrees about its own centre, which converges
 * the tops and separates the bottoms in one transform, and the tops are
 * rounded only on their OUTER corner so the two inner edges meet as a
 * peak rather than a dome. The band across the lower third is the
 * crossed thumbs -- the detail that separates "praying hands" from "a
 * chevron".
 */
export function PrayerIcon({ color, size = DEFAULT_SIZE }: IconProps) {
  const stroke = strokeFor(size);
  const palm = { width: size * 0.26, height: size * 0.66 };
  const tip = palm.width * 0.85;
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={styles.handRow}>
        <View
          style={{
            ...palm,
            backgroundColor: color,
            borderTopLeftRadius: tip,
            borderTopRightRadius: tip * 0.15,
            borderBottomLeftRadius: palm.width * 0.35,
            borderBottomRightRadius: palm.width * 0.2,
            transform: [{ rotate: '-15deg' }],
          }}
        />
        <View
          style={{
            ...palm,
            marginLeft: -stroke * 0.4,
            backgroundColor: color,
            borderTopRightRadius: tip,
            borderTopLeftRadius: tip * 0.15,
            borderBottomRightRadius: palm.width * 0.35,
            borderBottomLeftRadius: palm.width * 0.2,
            transform: [{ rotate: '15deg' }],
          }}
        />
      </View>
      {/* Crossed thumbs, over the wrists. */}
      <View
        style={{
          width: size * 0.56,
          height: stroke * 1.4,
          marginTop: -size * 0.16,
          backgroundColor: color,
          borderRadius: stroke,
        }}
      />
    </View>
  );
}

/** Two overlapping people -- Community. */
export function PeopleIcon({ color, size = DEFAULT_SIZE }: IconProps) {
  const stroke = strokeFor(size);
  const head = size * 0.3;
  const person = (scale: number) => ({
    head: {
      width: head * scale,
      height: head * scale,
      borderRadius: (head * scale) / 2,
      borderWidth: stroke,
      borderColor: color,
    },
    body: {
      width: size * 0.46 * scale,
      height: size * 0.26 * scale,
      marginTop: size * 0.05,
      borderWidth: stroke,
      borderBottomWidth: 0,
      borderColor: color,
      borderTopLeftRadius: size * 0.25,
      borderTopRightRadius: size * 0.25,
    },
  });
  const back = person(0.82);
  const front = person(1);
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={[styles.row, { alignItems: 'flex-end' }]}>
        {/* The smaller figure sits behind and to the left. */}
        <View style={[styles.box, { marginRight: -size * 0.12, opacity: 0.85 }]}>
          <View style={back.head} />
          <View style={back.body} />
        </View>
        <View style={styles.box}>
          <View style={front.head} />
          <View style={front.body} />
        </View>
      </View>
    </View>
  );
}

/** A page with rules -- a reading plan's day list. */
export function PlanIcon({ color, size = DEFAULT_SIZE }: IconProps) {
  const stroke = strokeFor(size);
  const rule = (width: number, key: string) => (
    <View
      key={key}
      style={{
        width,
        height: stroke,
        backgroundColor: color,
        borderRadius: stroke / 2,
        marginBottom: size * 0.1,
      }}
    />
  );
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={{
          width: size * 0.74,
          height: size * 0.9,
          borderWidth: stroke,
          borderColor: color,
          borderRadius: size * 0.12,
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: size * 0.1,
        }}
      >
        {rule(size * 0.4, 'one')}
        {rule(size * 0.4, 'two')}
        {rule(size * 0.24, 'three')}
      </View>
    </View>
  );
}

/**
 * A directional chevron -- back, forward, drill-down.
 *
 * Shared in M4 because the app drew this inline in four places (the
 * Bible reader's back control, More's row chevrons, Settings' rows) at
 * two stroke weights and two sizes -- the same drift
 * ./iconGeometry.ts exists to stop.
 *
 * Two borders on a square, rotated: the corner they form is the
 * chevron. `left` points back, which is what the reader's top-left
 * control needs.
 */
export function ChevronIcon({
  color,
  size = DEFAULT_SIZE,
  direction = 'right',
}: IconProps & { direction?: 'left' | 'right' | 'up' | 'down' }) {
  const stroke = strokeFor(size);
  const arm = size * 0.42;
  const rotation = {
    right: '45deg',
    left: '-135deg',
    up: '-45deg',
    down: '135deg',
  }[direction];
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={{
          width: arm,
          height: arm,
          borderRightWidth: stroke,
          borderTopWidth: stroke,
          borderColor: color,
          transform: [{ rotate: rotation }],
        }}
      />
    </View>
  );
}

/** Two crossed bars. Dismisses a sheet -- see ./Sheet.tsx. */
export function CloseIcon({ color, size = DEFAULT_SIZE }: IconProps) {
  const stroke = strokeFor(size);
  const bar = {
    position: 'absolute' as const,
    width: size * 0.62,
    height: stroke,
    backgroundColor: color,
    borderRadius: stroke / 2,
  };
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={[bar, { transform: [{ rotate: '45deg' }] }]} />
      <View style={[bar, { transform: [{ rotate: '-45deg' }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  // flex-start, not flex-end: the palms are rotated about their centres,
  // so aligning their TOPS is what keeps the apex level.
  handRow: { flexDirection: 'row', alignItems: 'flex-start' },
});
