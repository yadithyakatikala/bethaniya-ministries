import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Tappable } from '../../../theme/ui/Tappable';
import { BookmarkIcon, NoteIcon } from '../../../theme/ui/ReaderIcons';
import { useTheme } from '../../../theme';
import type { VerseAnnotation } from './useVerseAnnotations';

/** The indicator glyphs sit in the number gutter, so they must be small. */
const INDICATOR_SIZE = 13;

/**
 * One verse: its number, its text, and whatever the member has done
 * to it.
 *
 * SELECTION IS NEVER COLOUR ALONE. A selected verse gets a left rule as
 * well as a tint -- a 3dp bar is visible without colour vision, and the
 * row reports `accessibilityState.selected` so a screen reader says so.
 * The same rule applies to the highlight and note indicators: they are
 * distinct SHAPES in the gutter (a ribbon, a page) and each contributes
 * a spoken word to the row's accessibility label, so nothing about a
 * verse's state is carried by hue.
 *
 * IT IS A BUTTON, not a text block with a tap handler. That is what
 * makes it a stop for a screen reader and what makes "tap a verse to act
 * on it" discoverable rather than a hidden gesture.
 *
 * The children are the verse TEXT -- one Text for a single translation,
 * two for a paired bilingual row. This component deliberately knows
 * nothing about which, so there is one definition of what a verse row
 * looks like rather than two that drift.
 */
export function VerseRow({
  label,
  annotation,
  selected,
  onPress,
  stateLabels,
  textForAccessibility,
  onLayout,
  children,
  testID,
}: {
  /** "16", or "39-40" for a merged Telugu range. */
  label: string;
  annotation: VerseAnnotation;
  selected: boolean;
  onPress: () => void;
  /** Translated words for highlighted / bookmarked / has-a-note. */
  stateLabels: string[];
  textForAccessibility: string;
  onLayout?: (event: LayoutChangeEvent) => void;
  children: ReactNode;
  testID?: string;
}) {
  const { colors, radii, spacing, type, highlights, reading } = useTheme();

  const highlightTint = annotation.highlight ? highlights[annotation.highlight] : null;

  return (
    <Tappable
      testID={testID}
      onLayout={onLayout}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      // The number first, then the text, then the states: a screen
      // reader should say which verse this is before reading it.
      accessibilityLabel={[label, textForAccessibility, ...stateLabels].join('. ')}
      onPress={onPress}
      style={[
        styles.row,
        {
          gap: spacing.md - 2,
          borderRadius: radii.chip,
          // Negative margin against the padding, so a highlighted row's
          // tint extends past the text column rather than inset from it
          // -- a highlight that stops short of the words reads as a box.
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm,
          marginHorizontal: -spacing.sm,
          backgroundColor:
            highlightTint ?? (selected ? colors.primaryTint : 'transparent'),
          borderLeftWidth: selected ? 3 : 0,
          borderLeftColor: colors.primary,
          paddingLeft: selected ? spacing.sm - 3 : spacing.sm,
        },
      ]}
    >
      <View style={[styles.gutter, { width: reading.verseNumberColumn }]}>
        <Text style={[type.scriptureReference, { color: colors.accent }]}>{label}</Text>
        {annotation.bookmarked || annotation.note ? (
          <View style={styles.indicators}>
            {annotation.bookmarked ? (
              <BookmarkIcon color={colors.accent} size={INDICATOR_SIZE} filled />
            ) : null}
            {annotation.note ? (
              <NoteIcon color={colors.inkMuted} size={INDICATOR_SIZE} />
            ) : null}
          </View>
        ) : null}
      </View>
      <View style={styles.body}>{children}</View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  // flex-start rather than baseline: the gutter now holds indicators
  // under the number, so the two columns align at their tops.
  gutter: { alignItems: 'flex-start', gap: 4 },
  indicators: { flexDirection: 'row', gap: 2 },
  body: { flex: 1, gap: 4 },
});
