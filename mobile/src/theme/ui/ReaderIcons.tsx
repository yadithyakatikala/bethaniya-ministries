import { StyleSheet, View } from 'react-native';
import { ICON_SIZE, strokeFor, type IconProps } from './iconGeometry';

/**
 * The Bible reader's glyphs, drawn from plain Views like the rest of the
 * set -- see ./iconGeometry.ts for why this app has no icon dependency,
 * and for the one stroke ratio every glyph here uses.
 *
 * FOUR GLYPHS, NOT FOURTEEN. The verse action sheet's buttons are
 * LABELLED ("Highlight", "Bookmark", "Add note", "Share", "Copy")
 * rather than iconographic: a row of five unlabelled glyphs is
 * ambiguous, unreadable to a screen reader without five more
 * accessibility strings, and gives a Telugu interface nothing to
 * translate. So icons here are only for the reader's chrome, where
 * space genuinely is the constraint, plus the two per-verse indicators
 * that have to be small.
 */
const DEFAULT_SIZE = ICON_SIZE;

/**
 * Three sliders -- the reading-settings control.
 *
 * Sliders rather than a cog: this opens type size, line spacing and
 * column width, not application settings, and the app already has a
 * Settings screen that a cog would point at.
 */
export function ReaderSettingsIcon({ color, size = DEFAULT_SIZE }: IconProps) {
  const stroke = strokeFor(size);
  const knob = size * 0.22;
  // Knob positions differ per row so the glyph reads as three
  // independently-set controls rather than a list.
  const rows: { offset: number; key: string }[] = [
    { offset: 0.22, key: 'top' },
    { offset: 0.58, key: 'middle' },
    { offset: 0.38, key: 'bottom' },
  ];
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      {rows.map((row, index) => (
        <View
          key={row.key}
          style={[
            styles.sliderRow,
            { width: size * 0.84, marginTop: index === 0 ? 0 : size * 0.16 },
          ]}
        >
          <View
            style={{
              height: stroke,
              backgroundColor: color,
              borderRadius: stroke / 2,
              flex: 1,
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: size * 0.84 * row.offset - knob / 2,
              width: knob,
              height: knob,
              borderRadius: knob / 2,
              borderWidth: stroke,
              borderColor: color,
              backgroundColor: 'transparent',
            }}
          />
        </View>
      ))}
    </View>
  );
}

/** A list of chapters -- opens the book/chapter picker. */
export function ChapterListIcon({ color, size = DEFAULT_SIZE }: IconProps) {
  const stroke = strokeFor(size);
  const dot = stroke * 1.7;
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      {['one', 'two', 'three'].map((key, index) => (
        <View
          key={key}
          style={[styles.listRow, { marginTop: index === 0 ? 0 : size * 0.2 }]}
        >
          <View
            style={{
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: color,
            }}
          />
          <View
            style={{
              width: size * 0.56,
              height: stroke,
              backgroundColor: color,
              borderRadius: stroke / 2,
            }}
          />
        </View>
      ))}
    </View>
  );
}

/**
 * A ribbon. `filled` is the bookmarked state.
 *
 * The notch is two border-triangles rather than a shape cut out of the
 * background: a bookmarked verse may be sitting on any of the four
 * highlight tints, so anything drawn in "the background colour" would
 * be visible as a wrong-coloured wedge.
 */
export function BookmarkIcon({ color, size = DEFAULT_SIZE, filled = false }: IconProps) {
  const stroke = strokeFor(size);
  const width = size * 0.56;
  const bodyHeight = size * 0.5;
  const tail = size * 0.2;
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={{ width, alignItems: 'center' }}>
        <View
          style={{
            width,
            height: bodyHeight,
            borderWidth: stroke,
            borderBottomWidth: filled ? 0 : stroke,
            borderColor: color,
            backgroundColor: filled ? color : 'transparent',
            borderTopLeftRadius: stroke,
            borderTopRightRadius: stroke,
          }}
        />
        {filled ? (
          // No gap: the two triangles must meet to form one notch.
          <View style={styles.tailRow}>
            <View
              style={{
                width: 0,
                height: 0,
                borderTopWidth: tail,
                borderTopColor: color,
                borderRightWidth: width / 2,
                borderRightColor: 'transparent',
              }}
            />
            <View
              style={{
                width: 0,
                height: 0,
                borderTopWidth: tail,
                borderTopColor: color,
                borderLeftWidth: width / 2,
                borderLeftColor: 'transparent',
              }}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** A page with rules -- the "this verse has a note" indicator. */
export function NoteIcon({ color, size = DEFAULT_SIZE }: IconProps) {
  const stroke = strokeFor(size);
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={{
          width: size * 0.62,
          height: size * 0.76,
          borderWidth: stroke,
          borderColor: color,
          borderRadius: size * 0.1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: size * 0.12,
        }}
      >
        <View
          style={{
            width: size * 0.34,
            height: stroke,
            backgroundColor: color,
          }}
        />
        <View
          style={{
            width: size * 0.34,
            height: stroke,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tailRow: { flexDirection: 'row' },
});
