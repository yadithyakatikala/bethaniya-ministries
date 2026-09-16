import { StyleSheet, View } from 'react-native';

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
 */
interface IconProps {
  color: string;
  size?: number;
}

const DEFAULT_SIZE = 20;

/** A head over shoulders -- Profile. */
export function PersonIcon({ color, size = DEFAULT_SIZE }: IconProps) {
  const stroke = Math.max(1.5, size * 0.09);
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
  const stroke = Math.max(1.5, size * 0.09);
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
 * Two forms angled together over a base -- Prayers.
 *
 * A literal praying-hands glyph is not drawable legibly from Views at
 * this size, so this is the conventional minimal abstraction: two shapes
 * leaning into each other, resting on a base.
 */
export function PrayerIcon({ color, size = DEFAULT_SIZE }: IconProps) {
  const stroke = Math.max(1.5, size * 0.085);
  const hand = { width: size * 0.2, height: size * 0.62 };
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={[styles.row, { height: size * 0.72 }]}>
        <View
          style={{
            ...hand,
            borderWidth: stroke,
            borderColor: color,
            borderTopLeftRadius: hand.width,
            borderTopRightRadius: hand.width * 0.4,
            transform: [{ rotate: '-10deg' }],
          }}
        />
        <View
          style={{
            ...hand,
            borderWidth: stroke,
            borderColor: color,
            borderTopRightRadius: hand.width,
            borderTopLeftRadius: hand.width * 0.4,
            transform: [{ rotate: '10deg' }],
          }}
        />
      </View>
      {/* Base */}
      <View
        style={{
          width: size * 0.62,
          height: stroke,
          marginTop: size * 0.04,
          backgroundColor: color,
          borderRadius: stroke / 2,
        }}
      />
    </View>
  );
}

/** Two overlapping people -- Community. */
export function PeopleIcon({ color, size = DEFAULT_SIZE }: IconProps) {
  const stroke = Math.max(1.5, size * 0.085);
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
  const stroke = Math.max(1.5, size * 0.085);
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

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
});
