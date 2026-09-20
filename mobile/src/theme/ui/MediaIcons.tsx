import { StyleSheet, View } from 'react-native';
import { ICON_SIZE, strokeFor, type IconProps } from './iconGeometry';

/**
 * Icons for the media feed's four actions, plus a play marker.
 *
 * Same constraint and the same technique as ./FeatureIcons.tsx and
 * ./TabIcons.tsx: this project has no icon or SVG dependency, and emoji
 * are not an option because they render as the platform's own
 * multicolour artwork and cannot take a theme colour. Every glyph here is
 * plain Views, sized and stroked from ./iconGeometry.ts so it sits at the
 * same weight as the rest of the set.
 *
 * FILLED IS NOT JUST A COLOUR. Like and Save are stateful, and the
 * brief's rule -- and the design system's -- is that state is never
 * colour alone. Each takes a `filled` prop that changes the SHAPE's
 * treatment (solid body versus outline), so "liked" is distinguishable
 * without colour vision, and each caller additionally supplies an
 * accessibility label that says which state it is in.
 */
const DEFAULT_SIZE = ICON_SIZE;

interface StatefulIconProps extends IconProps {
  filled?: boolean;
}

/**
 * A heart, built the way CSS builds one: two circles and a square
 * rotated 45 degrees, sharing a corner.
 */
export function HeartIcon({
  color,
  size = DEFAULT_SIZE,
  filled = false,
}: StatefulIconProps) {
  const stroke = strokeFor(size);
  const lobe = size * 0.5;
  const body = { backgroundColor: filled ? color : 'transparent' };
  const outline = filled
    ? {}
    : { borderWidth: stroke, borderColor: color, backgroundColor: 'transparent' };

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={{ width: size, height: size, alignItems: 'center' }}>
        <View style={[styles.heartRow, { width: lobe * 2, height: lobe }]}>
          <View
            style={[{ width: lobe, height: lobe, borderRadius: lobe / 2 }, body, outline]}
          />
          <View
            style={[
              { width: lobe, height: lobe, borderRadius: lobe / 2, marginLeft: -1 },
              body,
              outline,
            ]}
          />
        </View>
        <View
          style={[
            {
              width: lobe * 1.42,
              height: lobe * 1.42,
              transform: [{ rotate: '45deg' }],
              marginTop: -lobe * 0.72,
            },
            body,
            outline,
          ]}
        />
      </View>
    </View>
  );
}

/** A rounded speech bubble with a tail -- Comment. */
export function CommentIcon({ color, size = DEFAULT_SIZE }: IconProps) {
  const stroke = strokeFor(size);
  const bubble = size * 0.78;
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={{
          width: bubble,
          height: bubble * 0.82,
          borderRadius: bubble * 0.26,
          borderWidth: stroke,
          borderColor: color,
        }}
      />
      {/* The tail: a small square rotated so one corner points down,
          tucked under the bubble's lower-left. */}
      <View
        style={{
          position: 'absolute',
          bottom: size * 0.08,
          left: size * 0.26,
          width: size * 0.2,
          height: size * 0.2,
          borderLeftWidth: stroke,
          borderBottomWidth: stroke,
          borderColor: color,
          transform: [{ rotate: '-45deg' }],
        }}
      />
    </View>
  );
}

/** A box with an arrow leaving through its top -- Share. */
export function ShareIcon({ color, size = DEFAULT_SIZE }: IconProps) {
  const stroke = strokeFor(size);
  const head = size * 0.26;
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      {/* The tray, open at the top. */}
      <View
        style={{
          position: 'absolute',
          bottom: size * 0.08,
          width: size * 0.72,
          height: size * 0.46,
          borderWidth: stroke,
          borderTopWidth: 0,
          borderColor: color,
          borderBottomLeftRadius: stroke * 2,
          borderBottomRightRadius: stroke * 2,
        }}
      />
      {/* The shaft. */}
      <View
        style={{
          position: 'absolute',
          top: size * 0.14,
          width: stroke,
          height: size * 0.44,
          backgroundColor: color,
        }}
      />
      {/* The arrowhead: two strokes meeting at the top. */}
      <View
        style={{
          position: 'absolute',
          top: size * 0.16,
          width: head,
          height: head,
          borderTopWidth: stroke,
          borderLeftWidth: stroke,
          borderColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

/** A bookmark ribbon with a notched foot -- Save. */
export function BookmarkIcon({
  color,
  size = DEFAULT_SIZE,
  filled = false,
}: StatefulIconProps) {
  const stroke = strokeFor(size);
  const width = size * 0.6;
  const height = size * 0.78;
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={{
          width,
          height,
          borderWidth: stroke,
          borderColor: color,
          backgroundColor: filled ? color : 'transparent',
          borderTopLeftRadius: stroke,
          borderTopRightRadius: stroke,
          overflow: 'hidden',
        }}
      >
        {/* The notch: a rotated square in the background colour would
            need to know the background, so instead the foot is cut by a
            transparent triangle drawn with borders. */}
        <View
          style={{
            position: 'absolute',
            bottom: -width * 0.36,
            left: 0,
            width: 0,
            height: 0,
            borderLeftWidth: width / 2,
            borderRightWidth: width / 2,
            borderBottomWidth: width * 0.42,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: color,
          }}
        />
      </View>
    </View>
  );
}

/** A solid triangle -- the play marker over a video thumbnail. */
export function PlayIcon({ color, size = DEFAULT_SIZE }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={{
          width: 0,
          height: 0,
          // A right-pointing triangle: the LEFT border is the visible
          // face, the other two are transparent spacers.
          borderTopWidth: size * 0.3,
          borderBottomWidth: size * 0.3,
          borderLeftWidth: size * 0.5,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: color,
          marginLeft: size * 0.08,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  heartRow: { flexDirection: 'row' },
});
